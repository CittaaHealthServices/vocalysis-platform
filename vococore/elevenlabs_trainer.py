"""
ElevenLabs Training Data Generator — VocoCore Service
======================================================
Runs inside the VocoCore Flask service (Railway deployment).
Called by POST /retrain endpoint to:
  1. Generate Indian voice audio via ElevenLabs API
  2. Extract acoustic features
  3. Fine-tune the ML model
  4. Hot-swap the running ml_scorer singleton

Environment variables required:
  ELEVENLABS_API_KEY   — from Railway env vars
  VOCOCORE_INTERNAL_KEY — internal auth (already set)
"""

import os
import sys
import json
import time
import logging
import tempfile
import threading
import numpy as np
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

HERE       = Path(__file__).parent
MODELS_DIR = HERE / "training" / "saved_models"
AUDIO_DIR  = HERE / "training" / "elevenlabs_audio"

for d in [MODELS_DIR, AUDIO_DIR]:
    d.mkdir(parents=True, exist_ok=True)

CLASS_LABELS = ["normal", "depression_risk", "anxiety_risk", "stress_risk"]

# ── Indian voice prompts (condensed — same as elevenlabs_pipeline.py) ─────────
PROMPTS = {
    "normal": [
        "Good morning. Today was a productive day at work. I finished the quarterly report and had a good meeting with the team. I feel rested and ready for tomorrow.",
        "The project deadline is next week but we are on track. I spoke with my manager and she is happy with the progress. I will complete it by Friday easily.",
        "I went for a walk in the evening after dinner. The weather was pleasant. I spoke with my family on video call. Everyone is doing well back home in Chennai.",
        "I completed my morning yoga session and had a healthy breakfast. I feel energetic and positive today. Work is going smoothly and my health is good.",
        "Today I finished my shift at the factory on time. The machines were running well. I am going home to rest and eat with my family. A good day overall.",
        "I delivered all my packages before five o'clock today. The traffic was manageable and the customers were friendly. I feel satisfied with my work today.",
    ],
    "depression_risk": [
        "I don't know. I have been sitting at my desk for hours. I cannot seem to focus on anything. Everything feels very heavy. I have not been sleeping well for weeks.",
        "I missed the meeting again today. I just could not get up in the morning. I feel like nothing I do matters. What is the point. I do not know what is happening to me.",
        "My friend called but I did not answer. I did not have the energy to talk to anyone. I have been eating very little. I just stay in my room mostly now.",
        "Everything feels grey. I wake up tired even after sleeping for ten hours. I cancelled plans with family again this weekend. I feel guilty but I could not go.",
        "I have not been going to work regularly. I feel very tired all the time. My body aches and I do not want to do anything. My wife is worried but I cannot explain.",
    ],
    "anxiety_risk": [
        "Oh god the presentation is tomorrow and I have not finished the slides yet. What if the client is not happy. What if I say something wrong. I have been rehearsing all night.",
        "My heart is beating so fast right now. I keep checking my email every five minutes. Did my manager reply. Did I make a mistake in the code. I cannot sit still.",
        "I know I should sleep but my mind will not stop. I keep thinking about all the things that could go wrong tomorrow. The deadline the review the presentation everything at once.",
        "I do not know if I will keep my job next month. The factory is talking about layoffs. I have loans to repay and my children's school fees are due. I cannot breathe thinking about it.",
        "Every time my phone rings I think it is bad news. My mother is sick and I am far from home. I cannot focus on work and I cannot afford to go back yet.",
    ],
    "stress_risk": [
        "I have three deadlines this week and my manager just added another task. I am working twelve hours a day and still falling behind. I am so frustrated I want to scream.",
        "The client changed the requirements again. Third time this month. I told my team but everyone is already stretched thin. I had to stay until midnight yesterday.",
        "I do not have time for lunch. I eat at my desk while working. My back hurts from sitting. I know I should take a break but there is simply no time. The pressure is relentless.",
        "The contractor is shouting at us to work faster but the materials are not coming on time. It is not our fault but we are the ones getting blamed. I am very angry and stressed.",
        "I drove for eleven hours today with only one short break. My eyes are burning and my back is very stiff. The company wants more deliveries but there are only twenty four hours in a day.",
    ],
}

VOICE_SETTINGS = {
    "normal":          {"stability": 0.65, "similarity_boost": 0.75, "style": 0.20},
    "depression_risk": {"stability": 0.88, "similarity_boost": 0.80, "style": 0.04},
    "anxiety_risk":    {"stability": 0.28, "similarity_boost": 0.70, "style": 0.58},
    "stress_risk":     {"stability": 0.38, "similarity_boost": 0.75, "style": 0.48},
}

# Global retrain status (polled by /retrain/status endpoint)
_retrain_status = {"state": "idle", "progress": "", "started_at": None, "error": None}


def get_retrain_status():
    return dict(_retrain_status)


def _update_status(state, progress="", error=None):
    _retrain_status["state"]    = state
    _retrain_status["progress"] = progress
    _retrain_status["error"]    = error
    if state == "running" and _retrain_status["started_at"] is None:
        _retrain_status["started_at"] = datetime.now().isoformat()


# ── Audio generation ──────────────────────────────────────────────────────────

def _generate_samples(api_key):
    """Generate audio clips using ElevenLabs API. Returns {class: [filepath]}"""
    from elevenlabs.client import ElevenLabs
    from elevenlabs import VoiceSettings

    client = ElevenLabs(api_key=api_key)

    # Pick best voice (prefer Indian accent)
    voices = client.voices.get_all().voices
    preferred = ["Meera", "Priya", "Arjun", "Charlie", "Daniel", "Rachel"]
    voice = voices[0]  # fallback
    for name in preferred:
        for v in voices:
            if name.lower() in v.name.lower():
                voice = v
                break
        else:
            continue
        break

    logger.info(f"Using voice: {voice.name} ({voice.voice_id})")
    _update_status("running", f"Using voice: {voice.name}")

    generated = {c: [] for c in CLASS_LABELS}
    total = sum(len(p) for p in PROMPTS.values())
    done = 0

    for class_name in CLASS_LABELS:
        class_dir = AUDIO_DIR / class_name
        class_dir.mkdir(exist_ok=True)
        settings = VOICE_SETTINGS[class_name]

        for i, prompt in enumerate(PROMPTS[class_name]):
            out_path = class_dir / f"{i:03d}.mp3"

            if out_path.exists() and out_path.stat().st_size > 1000:
                generated[class_name].append(out_path)
                done += 1
                continue

            try:
                audio_gen = client.generate(
                    text=prompt,
                    voice=voice.voice_id,
                    model="eleven_multilingual_v2",
                    voice_settings=VoiceSettings(
                        stability=settings["stability"],
                        similarity_boost=settings["similarity_boost"],
                        style=settings.get("style", 0.3),
                        use_speaker_boost=True,
                    ),
                )
                audio_bytes = b"".join(audio_gen)
                out_path.write_bytes(audio_bytes)
                generated[class_name].append(out_path)
                done += 1
                _update_status("running", f"Generated {done}/{total} clips ({class_name} {i+1})")
                time.sleep(1.1)  # rate limit

            except Exception as e:
                logger.error(f"ElevenLabs generate failed [{class_name}][{i}]: {e}")
                done += 1
                time.sleep(3)

    return generated


# ── Feature extraction ────────────────────────────────────────────────────────

def _extract_features(audio_path):
    """Extract 56 features from audio file. Returns dict or None."""
    import librosa
    import librosa.feature

    try:
        import parselmouth
        HAS_PM = True
    except ImportError:
        HAS_PM = False

    try:
        y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
        if len(y) < sr * 2:
            return None

        hop = int(0.010 * sr)
        n_fft = int(0.025 * sr)
        feats = {}

        # F0
        if HAS_PM:
            snd = parselmouth.Sound(y, sampling_frequency=sr)
            f0_arr = snd.to_pitch(time_step=0.01).selected_array('frequency')
            voiced = f0_arr[f0_arr > 0]
        else:
            f0_arr, _, _ = librosa.pyin(y, fmin=75, fmax=400, sr=sr)
            voiced = f0_arr[~np.isnan(f0_arr)] if f0_arr is not None else np.array([])

        feats["f0_mean"] = float(np.mean(voiced)) if len(voiced) > 0 else 174.0
        feats["f0_std"]  = float(np.std(voiced))  if len(voiced) > 0 else 34.0
        feats["f0_min"]  = float(np.min(voiced))  if len(voiced) > 0 else 106.0
        feats["f0_max"]  = float(np.max(voiced))  if len(voiced) > 0 else 242.0

        rms_frames = librosa.feature.rms(y=y, frame_length=n_fft, hop_length=hop)[0]
        voiced_mask = rms_frames > np.percentile(rms_frames, 20)
        feats["voiced_ratio"] = float(voiced_mask.mean())
        feats["pause_ratio"]  = 1.0 - feats["voiced_ratio"]

        transitions = max(1, np.sum(np.diff(voiced_mask.astype(int)) > 0))
        dur = len(y) / sr
        feats["speech_rate"] = float(transitions / dur * 0.5)
        feats["duration"]    = float(dur)
        feats["energy_mean"] = float(np.mean(rms_frames))
        feats["energy_std"]  = float(np.std(rms_frames))
        feats["energy_rms"]  = float(np.sqrt(np.mean(y**2)))

        if HAS_PM:
            try:
                snd2 = parselmouth.Sound(y, sampling_frequency=sr)
                pp   = parselmouth.praat.call(snd2, "To PointProcess (periodic, cc)", 75, 400)
                feats["jitter"]  = float(parselmouth.praat.call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) or 0.021)
                feats["shimmer"] = float(parselmouth.praat.call([snd2, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) or 0.073)
                hnr_o = parselmouth.praat.call(snd2, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
                feats["hnr"] = float(parselmouth.praat.call(hnr_o, "Get mean", 0, 0) or 20.5)
            except Exception:
                feats["jitter"] = 0.021; feats["shimmer"] = 0.073; feats["hnr"] = 20.5
        else:
            feats["jitter"] = 0.021; feats["shimmer"] = 0.073; feats["hnr"] = 20.5

        S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
        feats["spectral_centroid"]     = float(np.mean(librosa.feature.spectral_centroid(S=S, freq=freqs)[0]))
        feats["spectral_bandwidth"]    = float(np.mean(librosa.feature.spectral_bandwidth(S=S, freq=freqs)[0]))
        feats["spectral_rolloff"]      = float(np.mean(librosa.feature.spectral_rolloff(S=S, freq=freqs)[0]))
        feats["spectral_contrast_mean"]= float(np.mean(librosa.feature.spectral_contrast(S=S, freq=freqs)[0]))
        feats["zero_crossing_rate"]    = float(np.mean(librosa.feature.zero_crossing_rate(y, frame_length=n_fft, hop_length=hop)[0]))
        feats["spectral_flatness"]     = float(np.mean(librosa.feature.spectral_flatness(S=S)[0]))

        mfccs  = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop, n_fft=n_fft)
        mfcc_d = librosa.feature.delta(mfccs)
        for i in range(13):
            feats[f"mfcc_{i+1}"]  = float(np.mean(mfccs[i]))
            feats[f"mfcc_d{i+1}"] = float(np.mean(mfcc_d[i]))

        feats["articulation_rate"]    = feats["speech_rate"] * 1.05
        feats["mean_pause_duration"]  = feats["pause_ratio"] * dur / transitions
        feats["num_pauses"]           = float(transitions)
        feats["tempo"]                = float(librosa.beat.tempo(y=y, sr=sr)[0])
        feats["rhythm_regularity"]    = float(min(1.0, 1.0 - np.std(
            np.diff(np.where(np.diff(voiced_mask.astype(int)) != 0)[0]) if transitions > 1 else [0]
        ) / max(1, hop)))

        chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop)
        feats["chroma_mean"] = float(np.mean(chroma))
        feats["chroma_std"]  = float(np.std(chroma))

        mel = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=n_fft, hop_length=hop, n_mels=128)
        mel_db = librosa.power_to_db(mel)
        n3 = mel_db.shape[0] // 3
        feats["mel_energy_low"]  = float(np.mean(librosa.db_to_power(mel_db[:n3])))
        feats["mel_energy_mid"]  = float(np.mean(librosa.db_to_power(mel_db[n3:2*n3])))
        feats["mel_energy_high"] = float(np.mean(librosa.db_to_power(mel_db[2*n3:])))

        return feats
    except Exception as e:
        logger.error(f"Feature extraction failed for {audio_path}: {e}")
        return None


FEATURE_NAMES = [
    "f0_mean","f0_std","f0_min","f0_max","speech_rate","pause_ratio","voiced_ratio",
    "energy_mean","energy_std","energy_rms",
    "spectral_centroid","spectral_bandwidth","spectral_rolloff",
    "spectral_contrast_mean","zero_crossing_rate","spectral_flatness",
    "jitter","shimmer","hnr",
    *[f"mfcc_{i}" for i in range(1,14)],
    *[f"mfcc_d{i}" for i in range(1,14)],
    "duration","articulation_rate","mean_pause_duration","num_pauses","tempo","rhythm_regularity",
    "chroma_mean","chroma_std","mel_energy_low","mel_energy_mid","mel_energy_high",
]


def _build_feature_matrix(generated):
    rows, labels = [], []
    total = sum(len(v) for v in generated.values())
    done = 0
    for class_name in CLASS_LABELS:
        for path in generated[class_name]:
            feats = _extract_features(path)
            done += 1
            _update_status("running", f"Extracting features {done}/{total}")
            if feats is None:
                continue
            rows.append([feats.get(f, 0.0) for f in FEATURE_NAMES])
            labels.append(CLASS_LABELS.index(class_name))

    X = np.nan_to_num(np.array(rows, dtype=np.float64))
    y = np.array(labels)
    return X, y


# ── Model fine-tuning ─────────────────────────────────────────────────────────

def _engineer(X):
    idx = {n: i for i, n in enumerate(FEATURE_NAMES)}
    f0m = X[:, idx["f0_mean"]];    f0s = X[:, idx["f0_std"]]
    sr  = X[:, idx["speech_rate"]]; pr  = X[:, idx["pause_ratio"]]
    en  = X[:, idx["energy_mean"]]; ji  = X[:, idx["jitter"]]
    sh  = X[:, idx["shimmer"]];     hn  = X[:, idx["hnr"]]
    m1  = X[:, idx["mfcc_1"]];     m2  = X[:, idx["mfcc_2"]]
    ml  = X[:, idx["mel_energy_low"]]; mh = X[:, idx["mel_energy_high"]]
    ex = np.column_stack([
        f0s/(f0m+1e-6), sr/(pr+1e-6), en/(ji+1e-6), ji*sh, hn*en,
        (mh-ml)/(ml+1e-6), f0m*sr, pr*(ji+sh),
        np.abs(m1)/(np.abs(m2)+1e-6), f0s*sh, sr*en, hn/(sh+1e-6),
    ])
    return np.hstack([X, ex])


def _finetune(X_real, y_real):
    import joblib
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestClassifier, VotingClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, f1_score
    from xgboost import XGBClassifier

    _update_status("running", "Loading synthetic base dataset...")

    # Load synthetic data for blending
    try:
        sys.path.insert(0, str(HERE / "training"))
        from train_production import generate_dataset, augment_data
        X_syn, y_syn = generate_dataset(n_per_class=800, noise_factor=0.08, seed=42)
        X_syn, y_syn = augment_data(X_syn, y_syn, factor=2, seed=99)
    except Exception as e:
        logger.warning(f"Synthetic data load failed: {e} — using real only")
        X_syn = np.empty((0, len(FEATURE_NAMES)))
        y_syn = np.array([])

    # Real data × 3 for emphasis
    X_real_w = np.tile(X_real, (3, 1))
    y_real_w = np.tile(y_real, 3)

    if len(X_syn) > 0:
        X_all = np.vstack([X_syn, X_real_w])
        y_all = np.concatenate([y_syn, y_real_w])
    else:
        X_all = X_real_w
        y_all = y_real_w

    X_eng = _engineer(X_all)
    X_real_eng = _engineer(X_real)

    X_tr, X_te, y_tr, y_te = train_test_split(X_eng, y_all, test_size=0.15,
                                               random_state=42, stratify=y_all)
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)
    X_real_s = scaler.transform(X_real_eng)

    _update_status("running", f"Training ensemble on {len(X_tr)} samples...")

    model = VotingClassifier([
        ("xgb", XGBClassifier(n_estimators=400, max_depth=7, learning_rate=0.05,
                               subsample=0.85, colsample_bytree=0.80,
                               eval_metric="mlogloss", n_jobs=-1, random_state=42)),
        ("rf",  RandomForestClassifier(n_estimators=250, max_features="sqrt",
                                       class_weight="balanced_subsample",
                                       n_jobs=-1, random_state=42)),
    ], voting="soft", n_jobs=-1)

    model.fit(X_tr_s, y_tr)

    acc       = accuracy_score(y_te, model.predict(X_te_s))
    f1        = f1_score(y_te, model.predict(X_te_s), average="weighted")
    real_acc  = accuracy_score(y_real, model.predict(X_real_s))

    logger.info(f"Fine-tuned — test acc {acc*100:.1f}%  real acc {real_acc*100:.1f}%  F1 {f1*100:.1f}%")

    model_path  = MODELS_DIR / "vocacore_ensemble_v3_india_real.joblib"
    scaler_path = MODELS_DIR / "vocacore_scaler_v3_india_real.joblib"
    meta_path   = MODELS_DIR / "vocacore_meta_v3_india_real.json"

    joblib.dump(model,  model_path)
    joblib.dump(scaler, scaler_path)

    meta = {
        "version":             "3.0-india-real",
        "timestamp":           datetime.now().isoformat(),
        "calibration":         "Indian voices — ElevenLabs + synthetic",
        "demographics":        "blue_collar 40% | white_collar 40% | mixed 20%",
        "classes":             CLASS_LABELS,
        "n_features_base":     len(FEATURE_NAMES),
        "n_features_total":    X_eng.shape[1],
        "test_accuracy":       float(acc),
        "test_f1":             float(f1),
        "real_audio_accuracy": float(real_acc),
        "real_audio_samples":  int(len(X_real)),
        "model_path":          str(model_path),
        "scaler_path":         str(scaler_path),
    }
    meta_path.write_text(json.dumps(meta, indent=2))

    return model, scaler, meta


# ── Hot-swap ml_scorer singleton ─────────────────────────────────────────────

def _hotswap_scorer():
    """Reload ml_scorer singleton with the new v3 model."""
    try:
        import ml_scorer
        ml_scorer._scorer_instance = None   # clear singleton
        new_scorer = ml_scorer.get_scorer() # reloads from disk (picks v3 if present)
        logger.info(f"Hot-swap complete — scorer version: {new_scorer._meta.get('version')}")
        return new_scorer.is_loaded
    except Exception as e:
        logger.error(f"Hot-swap failed: {e}")
        return False


# ── Main retrain routine (runs in background thread) ─────────────────────────

def run_retrain_background(api_key):
    """Full retrain pipeline. Call from background thread."""
    try:
        _update_status("running", "Starting ElevenLabs generation...")
        logger.info("=== ElevenLabs retrain pipeline started ===")

        # 1. Generate audio
        generated = _generate_samples(api_key)
        total_clips = sum(len(v) for v in generated.values())
        logger.info(f"Generated {total_clips} audio clips")

        # 2. Extract features
        _update_status("running", "Extracting acoustic features...")
        X_real, y_real = _build_feature_matrix(generated)
        logger.info(f"Extracted features from {len(X_real)} clips")

        if len(X_real) < 8:
            raise RuntimeError(f"Too few samples ({len(X_real)}) — check ElevenLabs API / audio quality")

        # 3. Fine-tune
        _update_status("running", "Fine-tuning ML model...")
        model, scaler, meta = _finetune(X_real, y_real)

        # 4. Hot-swap
        _update_status("running", "Hot-swapping ml_scorer...")
        swapped = _hotswap_scorer()

        acc     = meta.get("test_accuracy", 0)
        real_acc = meta.get("real_audio_accuracy", 0)

        _update_status(
            "complete",
            f"Done — test acc {acc*100:.1f}%  real audio acc {real_acc*100:.1f}%  "
            f"hot-swap={'ok' if swapped else 'failed'}"
        )
        logger.info("=== ElevenLabs retrain pipeline complete ===")

    except Exception as e:
        logger.error(f"Retrain pipeline failed: {e}", exc_info=True)
        _update_status("error", error=str(e))


def start_retrain(api_key):
    """Start retrain in background thread. Returns immediately."""
    if _retrain_status["state"] == "running":
        return False, "Retrain already in progress"

    _retrain_status["started_at"] = None  # reset
    t = threading.Thread(target=run_retrain_background, args=(api_key,), daemon=True)
    t.start()
    return True, "Retrain started"
