#!/usr/bin/env python3
"""
ElevenLabs Indian Voice Generation Pipeline — Cittaa Health Services
=====================================================================
Generates realistic synthetic Indian voice audio samples for each mental
health class, then extracts acoustic features and fine-tunes the VocoCore
ML model on real audio (not just synthetic feature distributions).

Usage (run locally, NOT in sandbox):
    pip install elevenlabs scipy librosa parselmouth joblib scikit-learn xgboost
    python3 elevenlabs_pipeline.py --api-key sk_0292f79afc6f2d74622aa7be276cec8f67f2bd08f000c54f

Steps:
  1. List ElevenLabs voices → pick best Indian-accent voices
  2. Generate ~50 audio clips per mental health class using crafted prompts
  3. Extract 56 acoustic features per clip using librosa + parselmouth
  4. Fine-tune (or retrain) the VocoCore ensemble on real features
  5. Save updated model to saved_models/vocacore_ensemble_v3_india_real.joblib

Mental health simulation approach:
  - normal:          calm, balanced, conversational Indian speech
  - depression_risk: slow, flat, low-energy, long pauses — "tired" voice
  - anxiety_risk:    fast, tense, high-pitched, tremulous — "worried" voice
  - stress_risk:     loud, rushed, clipped, elevated pitch — "under pressure"

Voices used (ElevenLabs Indian/Asian-accent voices):
  - Charlie (Indian-English accent)
  - Any available South Asian accented voices from your account
  - Falls back to neutral voices with prosody SSML controls
"""

import os
import sys
import json
import time
import argparse
import logging
import warnings
import tempfile
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────────────
HERE       = Path(__file__).parent
AUDIO_DIR  = HERE / "elevenlabs_audio"
FEATS_DIR  = HERE / "elevenlabs_features"
MODELS_DIR = HERE / "saved_models"

for d in [AUDIO_DIR, FEATS_DIR, MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Script prompts per class ─────────────────────────────────────────────────
# Carefully crafted to elicit the vocal characteristics of each mental state
# in an Indian workplace context (IT, factory, field worker, office).
# Each prompt is ~30-60 seconds of speech.

PROMPTS = {
    "normal": [
        # White-collar
        "Good morning. Today was a productive day at work. I finished the quarterly report and had a good meeting with the team. I feel rested and ready for tomorrow.",
        "The project deadline is next week but we are on track. I spoke with my manager and she is happy with the progress. I will complete it by Friday easily.",
        "I went for a walk in the evening after dinner. The weather was pleasant. I spoke with my family on video call. Everyone is doing well back home in Chennai.",
        "My colleague and I solved the database issue today. It was a good challenge and we learned a lot. I enjoy problem solving at work and the team is supportive.",
        "I completed my morning yoga session and had a healthy breakfast. I feel energetic and positive today. Work is going smoothly and my health is good.",
        # Blue-collar
        "Today I finished my shift at the factory on time. The machines were running well and there were no breakdowns. I am going home to rest and eat with my family.",
        "The harvest this season was good. We worked hard in the fields but the weather cooperated. I am grateful for the good crop and will save some money this year.",
        "I delivered all my packages before five o'clock today. The traffic was manageable and the customers were friendly. I feel satisfied with my work today.",
    ],

    "depression_risk": [
        # White-collar
        "I... I don't know. I have been sitting at my desk for hours. I cannot seem to focus on anything. Everything feels very heavy. I have not been sleeping well for weeks now.",
        "I missed the meeting again today. I just... could not get up in the morning. I feel like nothing I do matters anyway. What is the point. I do not know.",
        "My friend called but I did not answer. I did not have the energy to talk to anyone. I have been eating very little. I just stay in my room mostly now.",
        "I used to enjoy coding. Now even opening my laptop feels like a huge effort. I sit there and stare at the screen. My manager asked if I am okay. I said yes but I am not.",
        "Everything feels grey. I wake up tired even after sleeping for ten hours. I cancelled plans with family again this weekend. I feel guilty but I could not go.",
        # Blue-collar
        "I have not been going to work regularly. I feel very tired all the time. My body aches and I do not want to do anything. My wife is worried about me but I cannot explain.",
        "The work is the same every day. I do not feel anything anymore. I just go, do the work, come home. I do not talk much these days. I do not know why.",
        "I used to sing while working in the fields. Now I just work in silence. I feel alone even when people are around. Something is not right with me I think.",
    ],

    "anxiety_risk": [
        # White-collar
        "Oh god the presentation is tomorrow and I have not finished the slides yet. What if the client is not happy. What if I say something wrong. I have been rehearsing all night and I still feel unprepared.",
        "My heart is beating so fast right now. I keep checking my email every five minutes. Did my manager reply. Did I make a mistake in the code. I cannot sit still. I need to check again.",
        "I know I should sleep but my mind will not stop. I keep thinking about all the things that could go wrong tomorrow. The deadline the review the presentation everything at once.",
        "I could not eat lunch today because my stomach was tight all morning. I keep thinking my job is at risk. Even though nobody said anything I just feel like something bad is going to happen.",
        "I checked my blood pressure again this morning. It was slightly high. Now I am worried about my health on top of the work stress. What if it gets worse. I should call the doctor.",
        # Blue-collar
        "I do not know if I will keep my job next month. The factory is talking about layoffs. I have loans to repay and my children's school fees are due. I cannot breathe when I think about it.",
        "My hands were shaking while operating the machine today. I kept making small mistakes. My supervisor noticed and I was so scared he would report it. I need this job I cannot lose it.",
        "Every time my phone rings I think it is bad news. My mother is sick and I am far from home. I cannot focus on work and I cannot afford to go back yet.",
    ],

    "stress_risk": [
        # White-collar
        "I have three deadlines this week and my manager just added another task. I am working twelve hours a day and still falling behind. I am so frustrated I want to scream.",
        "The client changed the requirements AGAIN. Third time this month. I told my team but everyone is already stretched thin. I had to stay until midnight yesterday and today will be the same.",
        "I do not have time for lunch. I eat at my desk while working. My back hurts from sitting. I know I should take a break but there is simply no time. The pressure is relentless.",
        "My phone has not stopped ringing all day. Emails are piling up faster than I can read them. I am context switching every five minutes. I cannot do deep work at all.",
        "I snapped at my colleague today and I felt terrible about it immediately. I apologized but the damage was done. This workload is affecting my relationships. I need a holiday desperately.",
        # Blue-collar
        "The contractor is shouting at us to work faster but the materials are not coming on time. It is not our fault but we are the ones getting blamed. I am very angry and stressed today.",
        "I drove for eleven hours today with only one short break. My eyes are burning and my back is very stiff. The company wants more deliveries but there are only twenty four hours in a day.",
        "The weather was very hot today and we were working in the open field from morning to evening. My body is exhausted. The foreman wants the same output tomorrow. I do not know how.",
    ],
}

CLASS_LABELS = ["normal", "depression_risk", "anxiety_risk", "stress_risk"]

# Voice settings per class — controls ElevenLabs voice_settings
# stability: 0 (variable/expressive) → 1 (stable/robotic)
# similarity_boost: voice similarity
# style: style exaggeration 0–1
VOICE_SETTINGS = {
    "normal":          {"stability": 0.65, "similarity_boost": 0.75, "style": 0.20, "speed": 1.05},
    "depression_risk": {"stability": 0.85, "similarity_boost": 0.80, "style": 0.05, "speed": 0.72},
    "anxiety_risk":    {"stability": 0.30, "similarity_boost": 0.70, "style": 0.55, "speed": 1.28},
    "stress_risk":     {"stability": 0.40, "similarity_boost": 0.75, "style": 0.45, "speed": 1.18},
}

# Preferred voice IDs (Indian or South Asian accent voices)
# These are checked first; if not in your account, falls back to any available voice
PREFERRED_VOICE_NAMES = [
    "Meera", "Priya", "Arjun", "Raj", "Ananya",   # Custom Indian voices (if cloned)
    "Charlie",                                       # ElevenLabs default with Indian accent
    "Daniel", "Rachel", "Bella", "Antoni",          # Fallback neutrals
]


# ─── Step 1: List & select voices ────────────────────────────────────────────

def get_best_voice(client, preferred_names):
    """Return the best available voice for Indian speech."""
    voices = client.voices.get_all().voices
    logger.info(f"Available voices ({len(voices)}):")
    for v in voices:
        logger.info(f"  {v.name:30} | {v.voice_id}")

    # Try preferred names first
    for name in preferred_names:
        for v in voices:
            if name.lower() in v.name.lower():
                logger.info(f"Selected voice: {v.name} ({v.voice_id})")
                return v

    # Fall back to first available
    if voices:
        logger.info(f"Fallback voice: {voices[0].name} ({voices[0].voice_id})")
        return voices[0]

    raise RuntimeError("No voices available in your ElevenLabs account")


# ─── Step 2: Generate audio ───────────────────────────────────────────────────

def generate_audio_samples(client, voice, n_per_class=None):
    """
    Generate audio clips for all classes.
    Saves as WAV files to AUDIO_DIR/{class_name}/{index}.mp3
    Returns: dict {class_name: [filepath, ...]}
    """
    from elevenlabs import VoiceSettings

    generated = {c: [] for c in CLASS_LABELS}

    for class_name in CLASS_LABELS:
        class_dir = AUDIO_DIR / class_name
        class_dir.mkdir(exist_ok=True)

        prompts_for_class = PROMPTS[class_name]
        if n_per_class:
            # Repeat prompts cyclically to hit n_per_class
            import itertools
            prompts_for_class = list(itertools.islice(
                itertools.cycle(prompts_for_class), n_per_class
            ))

        settings = VOICE_SETTINGS[class_name]

        logger.info(f"Generating {len(prompts_for_class)} clips for {class_name}...")

        for i, prompt in enumerate(prompts_for_class):
            out_path = class_dir / f"{i:03d}.mp3"

            # Skip if already generated
            if out_path.exists() and out_path.stat().st_size > 1000:
                logger.info(f"  [{class_name}][{i}] already exists, skipping")
                generated[class_name].append(out_path)
                continue

            try:
                audio_generator = client.generate(
                    text=prompt,
                    voice=voice.voice_id,
                    model="eleven_multilingual_v2",   # best for Indian accents
                    voice_settings=VoiceSettings(
                        stability=settings["stability"],
                        similarity_boost=settings["similarity_boost"],
                        style=settings.get("style", 0.3),
                        use_speaker_boost=True,
                    ),
                )
                # Collect generator output
                audio_bytes = b"".join(audio_generator)
                out_path.write_bytes(audio_bytes)

                logger.info(f"  [{class_name}][{i}] saved ({len(audio_bytes)/1024:.1f} KB)")
                generated[class_name].append(out_path)

                # Rate-limit: ElevenLabs free tier ~1 req/sec
                time.sleep(1.2)

            except Exception as e:
                logger.error(f"  [{class_name}][{i}] FAILED: {e}")
                time.sleep(3)

    return generated


# ─── Step 3: Feature extraction ───────────────────────────────────────────────

def extract_features_from_audio(audio_path):
    """
    Extract 56 acoustic features from an audio file.
    Matches the FEATURE_NAMES in train_production.py exactly.
    """
    import librosa
    import librosa.feature
    try:
        import parselmouth
        HAS_PARSELMOUTH = True
    except ImportError:
        HAS_PARSELMOUTH = False
        logger.warning("parselmouth not available — F0/jitter/shimmer will use librosa")

    # Load audio
    y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
    if len(y) < sr * 2:   # less than 2 seconds
        return None

    feats = {}

    # ── F0 (pitch) features ──────────────────────────────────────────────────
    if HAS_PARSELMOUTH:
        sound = parselmouth.Sound(y, sampling_frequency=sr)
        pitch  = sound.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=400)
        f0_arr = pitch.selected_array('frequency')
        voiced = f0_arr[f0_arr > 0]
    else:
        f0_arr, _, _ = librosa.pyin(y, fmin=75, fmax=400, sr=sr)
        voiced = f0_arr[~np.isnan(f0_arr)]

    feats["f0_mean"]  = float(np.mean(voiced))   if len(voiced) > 0 else 0.0
    feats["f0_std"]   = float(np.std(voiced))    if len(voiced) > 0 else 0.0
    feats["f0_min"]   = float(np.min(voiced))    if len(voiced) > 0 else 0.0
    feats["f0_max"]   = float(np.max(voiced))    if len(voiced) > 0 else 0.0

    # ── Voice activity / speech rate ─────────────────────────────────────────
    hop = int(0.010 * sr)
    n_fft = int(0.025 * sr)
    rms_frames = librosa.feature.rms(y=y, frame_length=n_fft, hop_length=hop)[0]
    threshold   = np.percentile(rms_frames, 20)
    voiced_mask = rms_frames > threshold
    feats["voiced_ratio"] = float(voiced_mask.mean())
    feats["pause_ratio"]  = 1.0 - feats["voiced_ratio"]

    # Rough speech rate: voiced transitions / duration
    transitions = np.sum(np.diff(voiced_mask.astype(int)) > 0)
    duration_s  = len(y) / sr
    feats["speech_rate"]  = float(transitions / duration_s * 0.5)
    feats["duration"]     = float(duration_s)

    # ── Energy ───────────────────────────────────────────────────────────────
    feats["energy_mean"] = float(np.mean(rms_frames))
    feats["energy_std"]  = float(np.std(rms_frames))
    feats["energy_rms"]  = float(np.sqrt(np.mean(y ** 2)))

    # ── Jitter / Shimmer / HNR (parselmouth) ─────────────────────────────────
    if HAS_PARSELMOUTH:
        try:
            sound_pm = parselmouth.Sound(y, sampling_frequency=sr)
            pp       = parselmouth.praat.call(sound_pm, "To PointProcess (periodic, cc)", 75, 400)
            jitter   = parselmouth.praat.call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
            shimmer  = parselmouth.praat.call([sound_pm, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
            hnr_obj  = parselmouth.praat.call(sound_pm, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            hnr_val  = parselmouth.praat.call(hnr_obj, "Get mean", 0, 0)
            feats["jitter"]  = float(max(0, jitter  or 0))
            feats["shimmer"] = float(max(0, shimmer or 0))
            feats["hnr"]     = float(hnr_val if hnr_val and hnr_val > 0 else 15.0)
        except Exception:
            feats["jitter"]  = 0.021
            feats["shimmer"] = 0.073
            feats["hnr"]     = 20.5
    else:
        feats["jitter"]  = 0.021
        feats["shimmer"] = 0.073
        feats["hnr"]     = 20.5

    # ── Spectral features ────────────────────────────────────────────────────
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    sc = librosa.feature.spectral_centroid(S=S, freq=freqs)[0]
    sb = librosa.feature.spectral_bandwidth(S=S, freq=freqs)[0]
    sr_feat = librosa.feature.spectral_rolloff(S=S, freq=freqs, roll_percent=0.85)[0]
    sc_feat = librosa.feature.spectral_contrast(S=S, freq=freqs)[0]
    zcr     = librosa.feature.zero_crossing_rate(y, frame_length=n_fft, hop_length=hop)[0]
    sf      = librosa.feature.spectral_flatness(S=S)[0]

    feats["spectral_centroid"]     = float(np.mean(sc))
    feats["spectral_bandwidth"]    = float(np.mean(sb))
    feats["spectral_rolloff"]      = float(np.mean(sr_feat))
    feats["spectral_contrast_mean"]= float(np.mean(sc_feat))
    feats["zero_crossing_rate"]    = float(np.mean(zcr))
    feats["spectral_flatness"]     = float(np.mean(sf))

    # ── MFCCs 1-13 ───────────────────────────────────────────────────────────
    mfccs   = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop, n_fft=n_fft)
    mfcc_d  = librosa.feature.delta(mfccs)
    for i in range(13):
        feats[f"mfcc_{i+1}"]   = float(np.mean(mfccs[i]))
        feats[f"mfcc_d{i+1}"]  = float(np.mean(mfcc_d[i]))

    # ── Temporal features ────────────────────────────────────────────────────
    feats["articulation_rate"]    = feats["speech_rate"] * 1.05
    feats["mean_pause_duration"]  = float(feats["pause_ratio"] * duration_s / max(1, transitions))
    feats["num_pauses"]           = float(transitions)
    feats["tempo"]                = float(librosa.beat.tempo(y=y, sr=sr)[0])
    feats["rhythm_regularity"]    = 1.0 - min(1.0, float(np.std(np.diff(np.where(np.diff(voiced_mask.astype(int)) != 0)[0])) / max(1, hop)))

    # ── Extra spectral (chroma + mel energy bands) ───────────────────────────
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


def build_feature_dataset(generated_files):
    """Extract features from all generated audio files, build DataFrame."""
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

    rows, labels = [], []
    for class_name in CLASS_LABELS:
        paths = generated_files.get(class_name, [])
        logger.info(f"Extracting features for {class_name} ({len(paths)} files)...")
        for path in paths:
            feats = extract_features_from_audio(path)
            if feats is None:
                continue
            row = [feats.get(f, 0.0) for f in FEATURE_NAMES]
            rows.append(row)
            labels.append(CLASS_LABELS.index(class_name))

    X = np.array(rows, dtype=np.float64)
    y = np.array(labels)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    df = pd.DataFrame(X, columns=FEATURE_NAMES)
    df["label"] = y
    df["class"] = [CLASS_LABELS[i] for i in y]

    feat_path = FEATS_DIR / "elevenlabs_features.csv"
    df.to_csv(feat_path, index=False)
    logger.info(f"Features saved to {feat_path} ({len(df)} samples)")
    return X, y, FEATURE_NAMES


# ─── Step 4: Fine-tune model ──────────────────────────────────────────────────

def finetune_model(X_real, y_real, feature_names):
    """
    Blend real ElevenLabs features with the existing synthetic training data,
    then retrain the ensemble. Real data gets 3× weight.
    """
    import joblib
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestClassifier, VotingClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, f1_score, classification_report
    from xgboost import XGBClassifier

    # Load existing synthetic model to get scaler norms
    base_scaler_path = MODELS_DIR / "vocacore_scaler_v2.joblib"
    if base_scaler_path.exists():
        logger.info("Loaded existing scaler for reference")
        base_scaler = joblib.load(base_scaler_path)
    else:
        base_scaler = None

    # Engineer interaction features (must match train_production.py)
    def engineer_features(X, fn):
        idx = {n: i for i, n in enumerate(fn)}
        f0_mean  = X[:, idx["f0_mean"]]
        f0_std   = X[:, idx["f0_std"]]
        sr       = X[:, idx["speech_rate"]]
        pr       = X[:, idx["pause_ratio"]]
        energy   = X[:, idx["energy_mean"]]
        jitter   = X[:, idx["jitter"]]
        shimmer  = X[:, idx["shimmer"]]
        hnr      = X[:, idx["hnr"]]
        mfcc1    = X[:, idx["mfcc_1"]]
        mfcc2    = X[:, idx["mfcc_2"]]
        mel_low  = X[:, idx["mel_energy_low"]]
        mel_high = X[:, idx["mel_energy_high"]]
        extra = np.column_stack([
            f0_std/(f0_mean+1e-6), sr/(pr+1e-6), energy/(jitter+1e-6),
            jitter*shimmer, hnr*energy,
            (mel_high-mel_low)/(mel_low+1e-6),
            f0_mean*sr, pr*(jitter+shimmer),
            np.abs(mfcc1)/(np.abs(mfcc2)+1e-6),
            f0_std*shimmer, sr*energy, hnr/(shimmer+1e-6),
        ])
        return np.hstack([X, extra])

    # Try to load synthetic base dataset for blending
    try:
        sys.path.insert(0, str(HERE))
        from train_production import generate_dataset, augment_data
        logger.info("Loading synthetic base dataset (1000 per class)...")
        X_syn, y_syn = generate_dataset(n_per_class=1000, noise_factor=0.08, seed=42)
        X_syn, y_syn = augment_data(X_syn, y_syn, factor=2, seed=99)
        logger.info(f"Synthetic: {len(X_syn)} samples")

        # Real data repeated 3× for higher weight
        X_real_w = np.tile(X_real, (3, 1))
        y_real_w = np.tile(y_real, 3)

        X_combined = np.vstack([X_syn, X_real_w])
        y_combined = np.concatenate([y_syn, y_real_w])
        logger.info(f"Combined: {len(X_combined)} samples ({len(X_syn)} synthetic + {len(X_real_w)} real×3)")

    except Exception as e:
        logger.warning(f"Could not load synthetic data ({e}) — training on real only")
        X_combined = np.tile(X_real, (4, 1))
        y_combined = np.tile(y_real, 4)

    # Engineer features
    X_eng = engineer_features(X_combined, feature_names)
    X_real_eng = engineer_features(X_real, feature_names)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X_eng, y_combined, test_size=0.15, random_state=42, stratify=y_combined
    )

    # Scale
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)
    X_real_s  = scaler.transform(X_real_eng)

    # Build model
    xgb = XGBClassifier(
        n_estimators=500, max_depth=7, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.80,
        eval_metric="mlogloss", n_jobs=-1, random_state=42,
    )
    rf = RandomForestClassifier(
        n_estimators=300, max_depth=None, min_samples_split=4,
        max_features="sqrt", class_weight="balanced_subsample",
        n_jobs=-1, random_state=42,
    )
    model = VotingClassifier([("xgb", xgb), ("rf", rf)], voting="soft", n_jobs=-1)

    logger.info("Training fine-tuned model...")
    model.fit(X_train_s, y_train)

    # Evaluate on held-out test set
    test_preds = model.predict(X_test_s)
    acc = accuracy_score(y_test, test_preds)
    f1  = f1_score(y_test, test_preds, average="weighted")

    # Evaluate specifically on REAL audio features (key metric)
    real_preds = model.predict(X_real_s)
    real_acc   = accuracy_score(y_real, real_preds)

    logger.info(f"\n{'='*60}")
    logger.info(f"  Fine-tuned model results:")
    logger.info(f"  Test accuracy (blended)   : {acc*100:.2f}%")
    logger.info(f"  Test F1 (blended)         : {f1*100:.2f}%")
    logger.info(f"  Real audio accuracy       : {real_acc*100:.2f}%  ← KEY METRIC")
    logger.info(f"{'='*60}")
    logger.info(classification_report(y_real, real_preds, target_names=CLASS_LABELS))

    # Save
    model_path  = MODELS_DIR / "vocacore_ensemble_v3_india_real.joblib"
    scaler_path = MODELS_DIR / "vocacore_scaler_v3_india_real.joblib"
    meta_path   = MODELS_DIR / "vocacore_meta_v3_india_real.json"

    joblib.dump(model,  model_path)
    joblib.dump(scaler, scaler_path)

    meta = {
        "version":        "3.0-india-real",
        "timestamp":      datetime.now().isoformat(),
        "calibration":    "Indian voices — ElevenLabs generated + synthetic",
        "demographics":   "blue_collar 40% | white_collar 40% | mixed 20%",
        "classes":        CLASS_LABELS,
        "n_features_base": len(feature_names),
        "n_features_total": X_eng.shape[1],
        "test_accuracy":  float(acc),
        "test_f1":        float(f1),
        "real_audio_accuracy": float(real_acc),
        "train_samples":  len(X_train),
        "real_audio_samples": len(X_real),
        "model_path":     str(model_path),
        "scaler_path":    str(scaler_path),
        "notes": (
            "Fine-tuned on ElevenLabs-generated Indian voice samples. "
            "Real audio gets 3× weight vs synthetic distribution data. "
            "Use vocacore_ensemble_v3 in ml_scorer.py for production."
        )
    }
    meta_path.write_text(json.dumps(meta, indent=2))

    logger.info(f"\nModel saved  → {model_path}")
    logger.info(f"Scaler saved → {scaler_path}")
    logger.info(f"Meta saved   → {meta_path}")

    if real_acc >= 0.85:
        logger.info(f"✅ TARGET MET on real audio: {real_acc*100:.1f}%")
    else:
        logger.info(f"⚠  Real audio accuracy {real_acc*100:.1f}% — consider more samples")

    return model, scaler, meta


# ─── Step 5: Update ml_scorer.py to use v3 ───────────────────────────────────

def update_ml_scorer_to_v3():
    """Patch ml_scorer.py to load the new v3 model when available."""
    ml_scorer_path = HERE.parent / "ml_scorer.py"
    if not ml_scorer_path.exists():
        logger.warning("ml_scorer.py not found — skipping update")
        return

    content = ml_scorer_path.read_text()
    v3_model  = str(MODELS_DIR / "vocacore_ensemble_v3_india_real.joblib")
    v3_scaler = str(MODELS_DIR / "vocacore_scaler_v3_india_real.joblib")

    # Insert v3 preference logic after existing path definitions
    insert = f"""
# ── v3 real-audio model (preferred when available) ──
_V3_MODEL_PATH  = Path("{v3_model}")
_V3_SCALER_PATH = Path("{v3_scaler}")
if _V3_MODEL_PATH.exists():
    _MODEL_PATH  = _V3_MODEL_PATH
    _SCALER_PATH = _V3_SCALER_PATH
    _META_PATH   = Path("{str(MODELS_DIR / 'vocacore_meta_v3_india_real.json')}")
"""

    if "_V3_MODEL_PATH" not in content:
        content = content.replace(
            "# ── Paths ──",
            "# ── Paths ──" + insert
        )
        ml_scorer_path.write_text(content)
        logger.info("✅ ml_scorer.py updated to prefer v3 real-audio model")
    else:
        logger.info("ml_scorer.py already references v3 model")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ElevenLabs Indian Voice Pipeline")
    parser.add_argument("--api-key",      required=True, help="ElevenLabs API key")
    parser.add_argument("--n-per-class",  type=int, default=None,
                        help="Override number of clips per class (default: use all prompts)")
    parser.add_argument("--skip-generate",action="store_true",
                        help="Skip audio generation (use existing files in elevenlabs_audio/)")
    parser.add_argument("--skip-finetune",action="store_true",
                        help="Skip model fine-tuning (only generate + extract features)")
    args = parser.parse_args()

    logger.info("="*60)
    logger.info("  ElevenLabs Indian Voice Pipeline — Cittaa Health Services")
    logger.info(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")
    logger.info("="*60)

    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=args.api_key)

    # Step 1: Get voice
    voice = get_best_voice(client, PREFERRED_VOICE_NAMES)

    # Step 2: Generate audio
    if not args.skip_generate:
        generated = generate_audio_samples(client, voice, n_per_class=args.n_per_class)
    else:
        # Load existing files
        generated = {}
        for c in CLASS_LABELS:
            class_dir = AUDIO_DIR / c
            if class_dir.exists():
                generated[c] = sorted(class_dir.glob("*.mp3")) + sorted(class_dir.glob("*.wav"))
            else:
                generated[c] = []
        total = sum(len(v) for v in generated.values())
        logger.info(f"Using existing {total} audio files")

    # Step 3: Extract features
    X_real, y_real, feature_names = build_feature_dataset(generated)
    logger.info(f"Feature extraction complete: {len(X_real)} samples, {len(feature_names)} features")

    if len(X_real) == 0:
        logger.error("No features extracted — check audio files and parselmouth installation")
        sys.exit(1)

    # Step 4: Fine-tune
    if not args.skip_finetune:
        finetune_model(X_real, y_real, feature_names)
        update_ml_scorer_to_v3()
    else:
        logger.info("Skipping fine-tuning (--skip-finetune)")

    logger.info("\n✅ ElevenLabs Indian Voice Pipeline complete!")
    logger.info("   Next: restart VocoCore Flask service to pick up new model")
    logger.info(f"   Model: {MODELS_DIR}/vocacore_ensemble_v3_india_real.joblib")


if __name__ == "__main__":
    main()
