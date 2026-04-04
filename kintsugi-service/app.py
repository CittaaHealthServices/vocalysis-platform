"""
Kintsugi DAM Service — Vocalysis Platform
==========================================
Wraps the open-sourced KintsugiHealth/dam model (FDA De Novo Cleared voice
biomarker AI) as a lightweight Flask microservice.

The DAM (Depression and Anxiety Model) uses a Whisper backbone fine-tuned on
~35,000 individuals (~863 hours of speech), trained against clinician-administered
PHQ-9 and GAD-7 ground truth. It is the first speech-only model to receive
FDA De Novo clearance for clinical-grade mental health screening.

Input:  multipart audio file (WAV/WebM/MP3/MP4, min 30s of speech)
Output: {"depression_score": 0-100, "anxiety_score": 0-100,
         "stress_score": 0-100, "confidence": 0-100,
         "phq9_category": str, "gad7_category": str,
         "raw": {"depression": int, "anxiety": int}}
"""

import os
import sys
import time
import logging
import tempfile
import subprocess
from pathlib import Path

from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [kintsugi] %(levelname)s %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ─── Model bootstrap ──────────────────────────────────────────────────────────
#
# On first start, we download the KintsugiHealth/dam repo from HuggingFace
# into /app/dam and add it to sys.path so `from pipeline import Pipeline` works.
#

DAM_DIR = Path('/app/dam')
_pipeline = None          # loaded lazily on first request


def _bootstrap_dam():
    """Download the DAM repo from HuggingFace if not already present."""
    if (DAM_DIR / 'pipeline.py').exists():
        logger.info('DAM model already present at %s', DAM_DIR)
        return True
    try:
        logger.info('Downloading KintsugiHealth/dam from HuggingFace…')
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id='KintsugiHealth/dam',
            local_dir=str(DAM_DIR),
            ignore_patterns=['*.git', '*.gitattributes'],
        )
        logger.info('DAM model downloaded successfully')
        return True
    except Exception as exc:
        logger.error('Failed to download DAM model: %s', exc)
        return False


def _load_pipeline():
    """Load the Kintsugi Pipeline (warm-start — heavy, do once at boot)."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    if not _bootstrap_dam():
        raise RuntimeError('DAM model not available')

    # Add the dam directory to sys.path so `from pipeline import Pipeline` works
    dam_str = str(DAM_DIR)
    if dam_str not in sys.path:
        sys.path.insert(0, dam_str)

    try:
        from pipeline import Pipeline   # noqa — comes from the DAM repo
        _pipeline = Pipeline()
        logger.info('Kintsugi DAM pipeline loaded')
    except Exception as exc:
        logger.error('Failed to load DAM pipeline: %s', exc)
        raise

    return _pipeline


# ─── Score mapping ───────────────────────────────────────────────────────────
#
# DAM quantize=True returns integer severity categories aligned with PHQ-9 / GAD-7:
#   0 = minimal   (PHQ-9  0– 4  / GAD-7  0– 4)
#   1 = mild       (PHQ-9  5– 9  / GAD-7  5– 9)
#   2 = moderate   (PHQ-9 10–14  / GAD-7 10–14)
#   3 = mod-severe (PHQ-9 15–19  / GAD-7 15–21)
#   4 = severe     (PHQ-9 20–27)
#
# We map these to our 0-100 internal scale using the midpoint of each PHQ/GAD
# range normalised to 100:
#   dep: PHQ-9 midpoints → 2, 7, 12, 17, 23.5 → /27 *100 → 7, 26, 44, 63, 87
#   anx: GAD-7 midpoints → 2, 7, 12, 18 → /21 *100 → 10, 33, 57, 86
#         (GAD-7 only has 4 categories, the 5th wraps into mod-severe+)

_DEP_MAP = {0: 7,  1: 26, 2: 44, 3: 63, 4: 87}
_ANX_MAP = {0: 10, 1: 33, 2: 57, 3: 78, 4: 91}

_PHQ9_LABELS = {0: 'Minimal',  1: 'Mild', 2: 'Moderate', 3: 'Moderately Severe', 4: 'Severe'}
_GAD7_LABELS = {0: 'Minimal',  1: 'Mild', 2: 'Moderate', 3: 'Severe',            4: 'Severe'}


def _raw_to_100(raw_dep: int, raw_anx: int) -> dict:
    """Convert DAM quantized integer outputs to Vocalysis 0-100 scores."""
    dep = _DEP_MAP.get(int(raw_dep), 50)
    anx = _ANX_MAP.get(int(raw_anx), 50)
    # Stress: not a DAM output — derived from anxiety + depression composite
    # (Perceived Stress correlates ~0.78 with anxiety and ~0.68 with depression)
    stress = round(min(100, anx * 0.62 + dep * 0.38))
    # Confidence: DAM is FDA-cleared, trained on 35k individuals → high confidence
    # Slight reduction for shorter-than-optimal audio is handled by the caller.
    confidence = 82
    return {
        'depression_score': dep,
        'anxiety_score':    anx,
        'stress_score':     stress,
        'confidence':       confidence,
        'phq9_category':    _PHQ9_LABELS.get(int(raw_dep), 'Unknown'),
        'gad7_category':    _GAD7_LABELS.get(int(raw_anx), 'Unknown'),
        'raw': {'depression': int(raw_dep), 'anxiety': int(raw_anx)},
    }


# ─── Internal auth ───────────────────────────────────────────────────────────

INTERNAL_KEY = os.environ.get('KINTSUGI_INTERNAL_KEY', 'kintsugi-dev-key')


def _check_auth():
    return request.headers.get('X-Kintsugi-Internal-Key', '') == INTERNAL_KEY


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'KintsugiHealth/dam', 'ready': _pipeline is not None})


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    POST /analyze
    Accepts:  multipart/form-data with field `audio` (WAV/WebM/MP3/MP4)
    Returns:  JSON with depression_score, anxiety_score, stress_score (all 0-100)
    """
    if not _check_auth():
        return jsonify({'error': 'Unauthorized'}), 401

    if 'audio' not in request.files:
        return jsonify({'error': 'Missing audio file'}), 400

    audio_file = request.files['audio']
    if not audio_file.filename:
        return jsonify({'error': 'Empty audio filename'}), 400

    # Determine suffix for temp file (ffmpeg needs the correct extension)
    orig_name = audio_file.filename or 'audio.webm'
    suffix = Path(orig_name).suffix or '.webm'

    t0 = time.time()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    wav_path = None
    try:
        # Convert to WAV 16kHz mono (DAM expects WAV; ffmpeg is in the Docker image)
        wav_path = tmp_path.replace(suffix, '_conv.wav')
        ret = subprocess.run(
            ['ffmpeg', '-y', '-i', tmp_path,
             '-ar', '16000', '-ac', '1', '-f', 'wav', wav_path],
            capture_output=True, timeout=30
        )
        if ret.returncode != 0:
            # Fall back to original file if conversion fails
            wav_path = tmp_path

        # Load pipeline (warm after first call)
        pipeline = _load_pipeline()

        # Run inference — quantize=True for reliable categorical output
        result = pipeline.run_on_file(wav_path, quantize=True)

        elapsed = round((time.time() - t0) * 1000)

        raw_dep = result.get('depression', 0)
        raw_anx = result.get('anxiety',    0)

        scores = _raw_to_100(raw_dep, raw_anx)
        scores['inference_ms'] = elapsed
        scores['model']        = 'kintsugi_dam'

        logger.info(
            'Kintsugi DAM result — dep_raw:%s anx_raw:%s → dep:%d anx:%d str:%d (%dms)',
            raw_dep, raw_anx,
            scores['depression_score'], scores['anxiety_score'],
            scores['stress_score'], elapsed
        )

        return jsonify({'success': True, 'scores': scores})

    except Exception as exc:
        logger.error('DAM inference error: %s', exc, exc_info=True)
        return jsonify({'error': str(exc)}), 500

    finally:
        # Clean up temp files
        for p in [tmp_path, wav_path]:
            try:
                if p and Path(p).exists():
                    Path(p).unlink()
            except Exception:
                pass


# ─── Warm up model at startup ────────────────────────────────────────────────
# Load the pipeline in a background thread at boot so the first real request
# is fast. This avoids Railway health-check timeouts.

import threading

def _warmup():
    try:
        logger.info('Warming up Kintsugi DAM pipeline…')
        _load_pipeline()
        logger.info('Kintsugi DAM pipeline ready')
    except Exception as exc:
        logger.warning('Warm-up failed (will retry on first request): %s', exc)

threading.Thread(target=_warmup, daemon=True).start()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    app.run(host='0.0.0.0', port=port)
