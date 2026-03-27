"""
VocoCore ML Scorer — Cittaa Health Services
===========================================
Loads the trained Indian-calibrated sklearn ensemble (v2.1-india) and scores
acoustic feature vectors extracted by extractor.py.

Falls back to DeterministicScorer if model file is absent.

Model: XGBoost + RandomForest soft-voting ensemble
Calibration: Hindi / Telugu / Tamil / Kannada / Indian English
Demographics: Blue-collar 40% | White-collar 40% | Mixed 20%
Accuracy: 96.44% | F1: 96.45% | AUC: 0.9955
"""

import os
import json
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
_HERE       = Path(__file__).parent
_MODEL_PATH  = _HERE / "training" / "saved_models" / "vocacore_ensemble_v2.joblib"
_SCALER_PATH = _HERE / "training" / "saved_models" / "vocacore_scaler_v2.joblib"
_META_PATH   = _HERE / "training" / "saved_models" / "vocacore_meta_v2.json"

# 56 base features the model was trained on (must match train_production.py)
FEATURE_NAMES = [
    "f0_mean", "f0_std", "f0_min", "f0_max", "speech_rate",
    "pause_ratio", "voiced_ratio",
    "energy_mean", "energy_std", "energy_rms",
    "spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
    "spectral_contrast_mean", "zero_crossing_rate", "spectral_flatness",
    "jitter", "shimmer", "hnr",
    "mfcc_1",  "mfcc_2",  "mfcc_3",  "mfcc_4",  "mfcc_5",
    "mfcc_6",  "mfcc_7",  "mfcc_8",  "mfcc_9",  "mfcc_10",
    "mfcc_11", "mfcc_12", "mfcc_13",
    "mfcc_d1",  "mfcc_d2",  "mfcc_d3",  "mfcc_d4",  "mfcc_d5",
    "mfcc_d6",  "mfcc_d7",  "mfcc_d8",  "mfcc_d9",  "mfcc_d10",
    "mfcc_d11", "mfcc_d12", "mfcc_d13",
    "duration", "articulation_rate", "mean_pause_duration",
    "num_pauses", "tempo", "rhythm_regularity",
    "chroma_mean", "chroma_std", "mel_energy_low", "mel_energy_mid", "mel_energy_high",
]

CLASS_LABELS = ["normal", "depression_risk", "anxiety_risk", "stress_risk"]

# Indian-calibrated thresholds for fallback interpretation
# (used to build 0-100 scores from class probabilities)
_INDIAN_NORMALS = {
    "f0_mean":    174.0,   # Hz blended Indian average
    "speech_rate": 4.4,   # syl/s Indian average
    "jitter":      0.021,  # Indian jitter norm
    "hnr":         20.5,   # dB
    "pause_ratio": 0.22,   # Indian cultural norm (NOT depression marker alone)
}


def _map_extractor_features(feat: dict) -> np.ndarray:
    """
    Map feature dict from extractor.py to the 56-feature vector expected by the model.

    The extractor uses slightly different key names (e.g. 'jitter_local' instead of 'jitter').
    This function handles all alias mappings and fills missing features with Indian norms.

    Returns: np.ndarray shape (56,)
    """
    # ── Alias map: extractor key → model key ─────────────────────────────────
    aliases = {
        # Pitch
        "f0_mean_hz":        "f0_mean",
        "pitch_mean":        "f0_mean",
        "f0_mean_voiced":    "f0_mean",
        "f0_sd":             "f0_std",
        "f0_std_hz":         "f0_std",
        "pitch_std":         "f0_std",
        "f0_min_hz":         "f0_min",
        "f0_max_hz":         "f0_max",
        "f0_range_hz":       None,          # derived below
        # Voice quality
        "jitter_local":      "jitter",
        "jitter_ppq5":       "jitter",
        "shimmer_local":     "shimmer",
        "shimmer_apq3":      "shimmer",
        "shimmer_apq5":      "shimmer",
        "hnr_db":            "hnr",
        "harmonic_noise":    "hnr",
        # Spectral
        "spectral_centroid_mean": "spectral_centroid",
        "spec_centroid":     "spectral_centroid",
        "spectral_bw":       "spectral_bandwidth",
        "spec_bandwidth":    "spectral_bandwidth",
        "spectral_rolloff_mean": "spectral_rolloff",
        "spec_rolloff":      "spectral_rolloff",
        "contrast_mean":     "spectral_contrast_mean",
        "zcr":               "zero_crossing_rate",
        "zcr_mean":          "zero_crossing_rate",
        "spec_flatness":     "spectral_flatness",
        # Energy
        "rms":               "energy_rms",
        "rms_mean":          "energy_rms",
        "rms_energy":        "energy_rms",
        "energy":            "energy_mean",
        "energy_rms_mean":   "energy_rms",
        # Speech rate / prosody
        "rate_syllables":    "speech_rate",
        "syllable_rate":     "speech_rate",
        "speaking_rate":     "speech_rate",
        "pause_fraction":    "pause_ratio",
        "silence_fraction":  "pause_ratio",
        "voice_fraction":    "voiced_ratio",
        "voiced_fraction":   "voiced_ratio",
        # Temporal
        "total_duration":    "duration",
        "audio_duration":    "duration",
        "artic_rate":        "articulation_rate",
        "articulation":      "articulation_rate",
        "mean_pause_dur":    "mean_pause_duration",
        "pause_duration":    "mean_pause_duration",
        "n_pauses":          "num_pauses",
        "pause_count":       "num_pauses",
        "bpm":               "tempo",
        "rhythm_reg":        "rhythm_regularity",
        "regularity":        "rhythm_regularity",
        # Chroma / mel
        "chroma":            "chroma_mean",
        "chroma_mean_val":   "chroma_mean",
        "mel_low":           "mel_energy_low",
        "mel_mid":           "mel_energy_mid",
        "mel_high":          "mel_energy_high",
    }

    # Flatten aliases into feat
    mapped = dict(feat)
    for alias, canonical in aliases.items():
        if alias in feat and canonical and canonical not in mapped:
            mapped[canonical] = feat[alias]

    # ── Derive f0_min / f0_max from mean/std if not present ──────────────────
    if "f0_min" not in mapped and "f0_mean" in mapped and "f0_std" in mapped:
        mapped["f0_min"] = mapped["f0_mean"] - 2 * mapped["f0_std"]
    if "f0_max" not in mapped and "f0_mean" in mapped and "f0_std" in mapped:
        mapped["f0_max"] = mapped["f0_mean"] + 2 * mapped["f0_std"]

    # ── Derive energy_rms from energy_mean if absent ──────────────────────────
    if "energy_rms" not in mapped and "energy_mean" in mapped:
        mapped["energy_rms"] = mapped["energy_mean"] * 1.28
    if "energy_std" not in mapped and "energy_mean" in mapped:
        mapped["energy_std"] = mapped["energy_mean"] * 0.45

    # ── Fill MFCCs 1-13 ───────────────────────────────────────────────────────
    # Try mfcc_0..mfcc_12 (librosa) → model uses mfcc_1..mfcc_13
    for i in range(1, 14):
        key = f"mfcc_{i}"
        if key not in mapped:
            # Try zero-indexed librosa keys
            alt = f"mfcc_{i-1}"
            mapped[key] = mapped.get(alt, 0.0)

    # Fill MFCC deltas (set to 0 if not computed — model is robust to this)
    for i in range(1, 14):
        if f"mfcc_d{i}" not in mapped:
            mapped[f"mfcc_d{i}"] = 0.0

    # ── Indian-calibrated defaults for missing features ───────────────────────
    # These represent healthy Indian voice norms, NOT pathological values.
    defaults = {
        "f0_mean":              174.0,
        "f0_std":                34.0,
        "f0_min":               106.0,
        "f0_max":               242.0,
        "speech_rate":            4.4,
        "pause_ratio":            0.22,
        "voiced_ratio":           0.72,
        "energy_mean":            0.050,
        "energy_std":             0.023,
        "energy_rms":             0.064,
        "spectral_centroid":   2200.0,
        "spectral_bandwidth":  1800.0,
        "spectral_rolloff":    3850.0,
        "spectral_contrast_mean": 28.5,
        "zero_crossing_rate":    0.084,
        "spectral_flatness":     0.031,
        "jitter":                0.021,
        "shimmer":               0.073,
        "hnr":                  20.5,
        "duration":               4.0,
        "articulation_rate":      4.5,
        "mean_pause_duration":    0.24,
        "num_pauses":             2.8,
        "tempo":                118.0,
        "rhythm_regularity":      0.74,
        "chroma_mean":            0.47,
        "chroma_std":             0.18,
        "mel_energy_low":         0.38,
        "mel_energy_mid":         0.35,
        "mel_energy_high":        0.27,
    }
    for feat_name, default_val in defaults.items():
        if feat_name not in mapped:
            mapped[feat_name] = default_val

    # ── Build ordered feature vector ─────────────────────────────────────────
    row = np.array([float(mapped.get(f, 0.0)) for f in FEATURE_NAMES], dtype=np.float64)
    row = np.nan_to_num(row, nan=0.0, posinf=0.0, neginf=0.0)
    return row


def _engineer_features(X: np.ndarray) -> np.ndarray:
    """Add 12 clinically-motivated interaction features (must match train_production.py)."""
    idx = {n: i for i, n in enumerate(FEATURE_NAMES)}

    f0_mean  = X[idx["f0_mean"]]
    f0_std   = X[idx["f0_std"]]
    sr       = X[idx["speech_rate"]]
    pr       = X[idx["pause_ratio"]]
    energy   = X[idx["energy_mean"]]
    jitter   = X[idx["jitter"]]
    shimmer  = X[idx["shimmer"]]
    hnr      = X[idx["hnr"]]
    mfcc1    = X[idx["mfcc_1"]]
    mfcc2    = X[idx["mfcc_2"]]
    mel_low  = X[idx["mel_energy_low"]]
    mel_high = X[idx["mel_energy_high"]]

    extra = np.array([
        f0_std / (f0_mean + 1e-6),
        sr / (pr + 1e-6),
        energy / (jitter + 1e-6),
        jitter * shimmer,
        hnr * energy,
        (mel_high - mel_low) / (mel_low + 1e-6),
        f0_mean * sr,
        pr * (jitter + shimmer),
        abs(mfcc1) / (abs(mfcc2) + 1e-6),
        f0_std * shimmer,
        sr * energy,
        hnr / (shimmer + 1e-6),
    ])
    return np.concatenate([X, extra])


class MLScorer:
    """
    Primary ML scorer using the trained Indian-calibrated ensemble.

    Loads vocacore_ensemble_v2.joblib + scaler and runs inference on
    acoustic feature vectors produced by extractor.py.

    Falls back gracefully to None if model files are missing.
    """

    def __init__(self):
        self._model  = None
        self._scaler = None
        self._meta   = {}
        self._loaded = False
        self._load()

    def _load(self):
        """Load model and scaler from disk."""
        try:
            import joblib
            if not _MODEL_PATH.exists():
                logger.warning(f"ML model not found at {_MODEL_PATH} — using fallback scorer")
                return
            if not _SCALER_PATH.exists():
                logger.warning(f"Scaler not found at {_SCALER_PATH}")
                return

            self._model  = joblib.load(_MODEL_PATH)
            self._scaler = joblib.load(_SCALER_PATH)

            if _META_PATH.exists():
                self._meta = json.loads(_META_PATH.read_text())

            self._loaded = True
            version = self._meta.get("version", "?")
            acc     = self._meta.get("test_accuracy", 0)
            logger.info(
                f"VocoCore ML model loaded (v{version}) — "
                f"test acc {acc*100:.1f}% | "
                f"{self._meta.get('calibration', 'Indian voices')} | "
                f"{self._meta.get('demographics', '')}"
            )
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def score(self, features_dict: dict) -> dict:
        """
        Score a feature dict from extractor.py using the trained ML model.

        Args:
            features_dict: Raw feature dict from FeatureExtractor.extract()

        Returns:
            dict with:
                ml_class          — str: 'normal' | 'depression_risk' | 'anxiety_risk' | 'stress_risk'
                ml_confidence     — float 0-1
                depression_score  — float 0-100
                anxiety_score     — float 0-100
                stress_score      — float 0-100
                normal_score      — float 0-100
                class_probabilities — dict {class: probability}
                model_version     — str
                is_ml_scored      — bool True
        """
        if not self._loaded:
            raise RuntimeError("ML model not loaded")

        # Map features → 56-dim vector
        x56 = _map_extractor_features(features_dict)

        # Add 12 engineered features → 68-dim
        x68 = _engineer_features(x56)

        # Scale
        x_scaled = self._scaler.transform(x68.reshape(1, -1))

        # Inference
        probs = self._model.predict_proba(x_scaled)[0]   # shape (4,)
        pred_idx = int(np.argmax(probs))
        pred_class = CLASS_LABELS[pred_idx]

        class_probs = {CLASS_LABELS[i]: float(probs[i]) for i in range(len(CLASS_LABELS))}

        # Convert class probabilities to 0-100 clinical scores
        # depression/anxiety/stress: probability × 100 (model is well-calibrated)
        depression_score = round(class_probs["depression_risk"] * 100, 1)
        anxiety_score    = round(class_probs["anxiety_risk"]    * 100, 1)
        stress_score     = round(class_probs["stress_risk"]     * 100, 1)
        normal_score     = round(class_probs["normal"]          * 100, 1)

        # Emotional stability = inverse of distress probability
        max_distress = max(depression_score, anxiety_score, stress_score)
        stability_score = round(max(0.0, 100.0 - max_distress), 1)

        return {
            "ml_class":           pred_class,
            "ml_confidence":      round(float(probs[pred_idx]), 4),
            "depression_score":   depression_score,
            "anxiety_score":      anxiety_score,
            "stress_score":       stress_score,
            "normal_score":       normal_score,
            "emotional_stability_score": stability_score,
            "class_probabilities": class_probs,
            "model_version":      self._meta.get("version", "2.1-india"),
            "model_accuracy":     round(self._meta.get("test_accuracy", 0) * 100, 2),
            "is_ml_scored":       True,
        }


# Module-level singleton (loaded once at import time)
_scorer_instance: MLScorer | None = None


def get_scorer() -> MLScorer:
    """Return (or create) the module-level MLScorer singleton."""
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = MLScorer()
    return _scorer_instance
