"""
language_detector.py — Vocalysis / VocoCore™

Lightweight acoustic-fingerprint-based Indian language detector.

No STT / no transcription needed — detects language family from
prosodic and spectral acoustic features extracted from the raw audio
(or optionally from a pre-computed feature dict).

Supported targets
-----------------
    hi   — Hindi
    ta   — Tamil
    te   — Telugu
    kn   — Kannada
    en   — Indian English
    ml   — Malayalam
    mr   — Marathi
    bn   — Bengali

Acoustic basis
--------------
Based on cross-linguistic studies of Indian languages:

  • Hindi / Marathi:   F0 mean 150–185 Hz; moderate speech rate (~4.5 syl/s);
                       HNR > 12 dB; low jitter
  • Tamil / Telugu:    F0 mean 180–220 Hz; slower rate (~4.0 syl/s);
                       higher shimmer variance; distinct retroflexion in rhythm
  • Kannada:           F0 mean 170–200 Hz; moderate rate; distinct pause patterns
  • Malayalam:         F0 mean 175–215 Hz; rapid rate (~5.0 syl/s); rich formant structure
  • Indian English:    F0 mean 145–175 Hz; faster rate (>4.8 syl/s);
                       higher spectral centroid; lower pause ratio
  • Bengali:           F0 mean 160–195 Hz; moderate rate; distinctive tonal pattern

References: Ramakrishnan & Sundarajan (2019), INTERSPEECH; Narayanan & Alwan (2014)

Interface (matches app.py usage)
---------------------------------
    lang_result = detect_language(audio_array, sample_rate, language_hint)
    features_calibrated = apply_language_calibration(features, lang_result)

    lang_result keys: language, display_name, confidence, method, band, scores
"""

from __future__ import annotations
import logging
import numpy as np
from typing import Dict, Optional

logger = logging.getLogger(__name__)


# ── Language profiles (acoustic norms for healthy adult speakers) ─────────────
# Each profile: f0_mean_range (Hz), speech_rate (syl/s), hnr (dB),
#               pause_ratio, spectral_centroid_hz

_PROFILES: Dict[str, Dict] = {
    'hi': {
        'name':                 'Hindi',
        'f0_mean':              (150, 185),
        'speech_rate':          (4.0, 5.2),
        'hnr':                  (12, 22),
        'pause_ratio':          (0.18, 0.32),
        'spectral_centroid_hz': (1500, 2800),
        'shimmer_max':          0.040,
    },
    'ta': {
        'name':                 'Tamil',
        'f0_mean':              (178, 225),
        'speech_rate':          (3.5, 4.8),
        'hnr':                  (10, 20),
        'pause_ratio':          (0.22, 0.38),
        'spectral_centroid_hz': (1600, 2900),
        'shimmer_max':          0.055,
    },
    'te': {
        'name':                 'Telugu',
        'f0_mean':              (175, 220),
        'speech_rate':          (3.8, 5.0),
        'hnr':                  (10, 20),
        'pause_ratio':          (0.20, 0.36),
        'spectral_centroid_hz': (1550, 2850),
        'shimmer_max':          0.052,
    },
    'kn': {
        'name':                 'Kannada',
        'f0_mean':              (168, 205),
        'speech_rate':          (3.8, 5.0),
        'hnr':                  (11, 21),
        'pause_ratio':          (0.20, 0.35),
        'spectral_centroid_hz': (1520, 2800),
        'shimmer_max':          0.048,
    },
    'ml': {
        'name':                 'Malayalam',
        'f0_mean':              (172, 218),
        'speech_rate':          (4.5, 5.8),
        'hnr':                  (11, 22),
        'pause_ratio':          (0.15, 0.28),
        'spectral_centroid_hz': (1600, 3000),
        'shimmer_max':          0.048,
    },
    'en': {
        'name':                 'Indian English',
        'f0_mean':              (140, 178),
        'speech_rate':          (4.5, 6.0),
        'hnr':                  (13, 24),
        'pause_ratio':          (0.12, 0.25),
        'spectral_centroid_hz': (1800, 3200),
        'shimmer_max':          0.038,
    },
    'mr': {
        'name':                 'Marathi',
        'f0_mean':              (152, 190),
        'speech_rate':          (4.0, 5.3),
        'hnr':                  (12, 22),
        'pause_ratio':          (0.18, 0.32),
        'spectral_centroid_hz': (1500, 2800),
        'shimmer_max':          0.040,
    },
    'bn': {
        'name':                 'Bengali',
        'f0_mean':              (158, 198),
        'speech_rate':          (4.2, 5.5),
        'hnr':                  (11, 21),
        'pause_ratio':          (0.18, 0.30),
        'spectral_centroid_hz': (1550, 2850),
        'shimmer_max':          0.044,
    },
}

# Map hint codes to our internal codes
_HINT_MAP = {
    'hi': 'hi', 'hindi': 'hi',
    'ta': 'ta', 'tamil': 'ta',
    'te': 'te', 'telugu': 'te',
    'kn': 'kn', 'kannada': 'kn',
    'ml': 'ml', 'malayalam': 'ml',
    'mr': 'mr', 'marathi': 'mr',
    'bn': 'bn', 'bengali': 'bn',
    'en': 'en', 'en-in': 'en', 'english': 'en', 'indian english': 'en',
}


def _in_range(val: float, lo: float, hi: float) -> float:
    """Score 1.0 if in range, decays smoothly outside."""
    if val is None or val == 0:
        return 0.5  # neutral — no evidence
    if lo <= val <= hi:
        return 1.0
    dist = min(abs(val - lo), abs(val - hi))
    span = hi - lo or 1
    return max(0.0, 1.0 - dist / span)


def _extract_acoustic_features_from_audio(
    audio_array: np.ndarray,
    sample_rate: int,
) -> Dict[str, float]:
    """
    Extract lightweight acoustic features directly from audio for language detection.
    Falls back gracefully if librosa is unavailable.
    """
    feats: Dict[str, float] = {}
    try:
        import librosa

        # F0 (fundamental frequency) — using pyin for robustness
        try:
            f0_arr, voiced_flag, _ = librosa.pyin(
                audio_array.astype(np.float32),
                fmin=50, fmax=500,
                sr=sample_rate,
            )
            voiced_f0 = f0_arr[voiced_flag] if voiced_flag is not None else np.array([])
            feats['f0_mean'] = float(np.nanmean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        except Exception:
            feats['f0_mean'] = 0.0

        # Speech rate proxy: zero-crossing rate (correlates with rate)
        zcr = librosa.feature.zero_crossing_rate(audio_array)[0]
        feats['speech_rate'] = float(np.mean(zcr) * 200)  # rough syl/s approximation

        # Spectral centroid
        sc = librosa.feature.spectral_centroid(y=audio_array.astype(np.float32), sr=sample_rate)[0]
        feats['spectral_centroid'] = float(np.mean(sc))

        # Pause ratio: fraction of frames below energy threshold
        rms = librosa.feature.rms(y=audio_array)[0]
        threshold = np.mean(rms) * 0.1
        feats['pause_ratio'] = float(np.mean(rms < threshold))

        # HNR proxy via spectral flatness (inverse)
        flatness = librosa.feature.spectral_flatness(y=audio_array.astype(np.float32))[0]
        feats['hnr'] = float((1.0 - np.mean(flatness)) * 25)  # map 0..1 → 0..25 dB

    except ImportError:
        logger.warning('librosa not available — language detection using defaults only')

    return feats


def detect_language(
    audio_array: np.ndarray,
    sample_rate: int,
    language_hint: Optional[str] = None,
) -> Dict:
    """
    Estimate the spoken Indian language from raw audio + optional hint.

    Parameters
    ----------
    audio_array    : np.ndarray — raw audio samples (mono, float32 preferred)
    sample_rate    : int        — audio sample rate in Hz
    language_hint  : str|None  — optional ISO code hint from client (hi|te|ta|kn|en-in|...)

    Returns
    -------
    dict with keys:
        language     : str   — ISO 639-1 code of best-guess language (hi/ta/te/kn/ml/en/mr/bn)
        display_name : str   — Human-readable name (e.g. "Tamil")
        confidence   : float — 0..1 probability estimate
        band         : str   — 'low' / 'medium' / 'high'
        method       : str   — 'hint' | 'acoustic' | 'hint+acoustic'
        scores       : dict  — per-language affinity scores (for debugging)
    """
    # ── 1. Check if hint alone is sufficient ─────────────────────────────────
    normalized_hint = _HINT_MAP.get((language_hint or '').lower().strip())

    if normalized_hint and normalized_hint in _PROFILES:
        profile = _PROFILES[normalized_hint]
        logger.info('Language from hint: %s (%s)', profile['name'], normalized_hint)
        return {
            'language':     normalized_hint,
            'display_name': profile['name'],
            'confidence':   0.90,
            'band':         'high',
            'method':       'hint',
            'scores':       {normalized_hint: 1.0},
        }

    # ── 2. Acoustic detection ─────────────────────────────────────────────────
    feats = _extract_acoustic_features_from_audio(audio_array, sample_rate)

    f0    = feats.get('f0_mean', 0)
    rate  = feats.get('speech_rate', 0)
    hnr   = feats.get('hnr', 0)
    pause = feats.get('pause_ratio', 0)
    sc    = feats.get('spectral_centroid', 0)
    shim  = feats.get('shimmer', 0)

    affinity_scores: Dict[str, float] = {}

    for lang, profile in _PROFILES.items():
        s  = _in_range(f0,    *profile['f0_mean'])              * 0.30
        s += _in_range(rate,  *profile['speech_rate'])           * 0.25
        s += _in_range(hnr,   *profile['hnr'])                   * 0.20
        s += _in_range(pause, *profile['pause_ratio'])            * 0.15
        s += _in_range(sc,    *profile['spectral_centroid_hz'])   * 0.10

        # Shimmer penalty
        shim_max = profile.get('shimmer_max', 0.05)
        if shim > shim_max * 1.5:
            s *= 0.9

        affinity_scores[lang] = round(s, 4)

    best_lang  = max(affinity_scores, key=lambda k: affinity_scores[k])
    best_score = affinity_scores[best_lang]

    sorted_vals = sorted(affinity_scores.values(), reverse=True)
    runner_up   = sorted_vals[1] if len(sorted_vals) > 1 else 0
    margin      = best_score - runner_up

    if margin > 0.12:
        band = 'high'
    elif margin > 0.05:
        band = 'medium'
    else:
        band = 'low'

    confidence = round(min(best_score, 1.0), 3)
    method = 'acoustic'

    logger.info(
        'Language detection: %s (%s) conf=%.3f band=%s margin=%.4f',
        _PROFILES[best_lang]['name'], best_lang, confidence, band, margin,
    )

    return {
        'language':     best_lang,
        'display_name': _PROFILES[best_lang]['name'],
        'confidence':   confidence,
        'band':         band,
        'method':       method,
        'scores':       affinity_scores,
    }


def apply_language_calibration(features: dict, lang_result: dict) -> dict:
    """
    Adjust feature values based on detected language before ML inference.

    For each language, shifts the expected Indian population means so that
    acoustic thresholds are interpreted relative to the correct sub-population.

    Parameters
    ----------
    features    : dict — Feature dict from FeatureExtractor.extract()
    lang_result : dict — Result dict from detect_language()

    Returns
    -------
    dict — Calibrated copy of features (original is not mutated)
    """
    iso_code = lang_result.get('language', 'hi') if isinstance(lang_result, dict) else str(lang_result)

    # Calibration offsets relative to the default Indian-Hindi baseline.
    # Positive = this language's speakers naturally score HIGHER for this feature.
    # Small empirical adjustments to reduce false positives for non-Hindi speakers.
    CALIBRATION: Dict[str, Dict[str, float]] = {
        'hi': {'f0_mean': 0.0,   'speech_rate': 0.0,   'pause_ratio': 0.00},
        'ta': {'f0_mean': +15.0, 'speech_rate': -0.3,  'pause_ratio': +0.04},
        'te': {'f0_mean': +12.0, 'speech_rate': -0.2,  'pause_ratio': +0.03},
        'kn': {'f0_mean': +8.0,  'speech_rate': -0.1,  'pause_ratio': +0.02},
        'ml': {'f0_mean': +10.0, 'speech_rate': +0.3,  'pause_ratio': -0.03},
        'en': {'f0_mean': -15.0, 'speech_rate': +0.4,  'pause_ratio': -0.05},
        'mr': {'f0_mean': +2.0,  'speech_rate': +0.0,  'pause_ratio': 0.00},
        'bn': {'f0_mean': +5.0,  'speech_rate': +0.1,  'pause_ratio': 0.00},
    }

    offsets = CALIBRATION.get(iso_code, CALIBRATION['hi'])

    # Apply offsets: create a shallow copy, adjust numeric fields
    calibrated = dict(features)
    for field, delta in offsets.items():
        if field in calibrated and calibrated[field] is not None:
            try:
                calibrated[field] = calibrated[field] + delta
            except TypeError:
                pass  # skip non-numeric nested fields

    confidence = lang_result.get('confidence', 1.0) if isinstance(lang_result, dict) else 1.0
    calibrated['_language_calibration'] = {
        'iso': iso_code,
        'offsets': offsets,
        'confidence': confidence,
    }

    return calibrated
