"""
Feature Pipeline for Vocalysis Platform 2.0
Extracts 50+ voice biomarkers and handles augmentation
"""

import os
import pickle
import warnings
from pathlib import Path
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from scipy import signal, stats
from tqdm import tqdm
import audiomentations
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')


class FeatureExtractor:
    """Extract comprehensive voice features for mental health analysis."""

    def __init__(self, sr=16000):
        self.sr = sr

    def extract_prosodic_features(self, audio, sr):
        """Extract fundamental frequency and energy features."""
        features = {}

        # Fundamental frequency (pitch)
        try:
            f0, voiced_flag, voiced_probs = librosa.pyin(
                audio, fmin=50, fmax=400, sr=sr
            )
            f0 = f0[~np.isnan(f0)]
            if len(f0) > 0:
                features['f0_mean'] = np.mean(f0)
                features['f0_std'] = np.std(f0)
                features['f0_min'] = np.min(f0)
                features['f0_max'] = np.max(f0)
                features['f0_median'] = np.median(f0)
                features['f0_q1'] = np.percentile(f0, 25)
                features['f0_q3'] = np.percentile(f0, 75)
                features['f0_range'] = np.max(f0) - np.min(f0)
            else:
                features['f0_mean'] = features['f0_std'] = 0
                features['f0_min'] = features['f0_max'] = 0
                features['f0_median'] = features['f0_q1'] = 0
                features['f0_q3'] = features['f0_range'] = 0
        except Exception:
            features['f0_mean'] = features['f0_std'] = 0
            features['f0_min'] = features['f0_max'] = 0
            features['f0_median'] = features['f0_q1'] = 0
            features['f0_q3'] = features['f0_range'] = 0

        # Energy features
        rms = librosa.feature.rms(y=audio)[0]
        features['energy_mean'] = np.mean(rms)
        features['energy_std'] = np.std(rms)
        features['energy_min'] = np.min(rms)
        features['energy_max'] = np.max(rms)

        # Loudness
        features['loudness'] = np.sqrt(np.mean(audio ** 2))

        return features

    def extract_spectral_features(self, audio, sr):
        """Extract spectral characteristics."""
        features = {}

        # Compute spectrogram
        S = librosa.feature.melspectrogram(y=audio, sr=sr, n_mels=128)
        S_db = librosa.power_to_db(S, ref=np.max)

        # Spectral centroid
        spectral_centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
        features['spectral_centroid_mean'] = np.mean(spectral_centroid)
        features['spectral_centroid_std'] = np.std(spectral_centroid)

        # Spectral rolloff
        spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr)[0]
        features['spectral_rolloff_mean'] = np.mean(spectral_rolloff)
        features['spectral_rolloff_std'] = np.std(spectral_rolloff)

        # Zero crossing rate
        zcr = librosa.feature.zero_crossing_rate(audio)[0]
        features['zcr_mean'] = np.mean(zcr)
        features['zcr_std'] = np.std(zcr)

        # Spectral flux
        spec_flux = np.sqrt(np.sum(np.diff(S_db, axis=1) ** 2, axis=0))
        features['spectral_flux_mean'] = np.mean(spec_flux)
        features['spectral_flux_std'] = np.std(spec_flux)

        # MFCC
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
        for i in range(13):
            features[f'mfcc_{i}_mean'] = np.mean(mfcc[i])
            features[f'mfcc_{i}_std'] = np.std(mfcc[i])

        return features

    def extract_voice_quality_features(self, audio, sr):
        """Extract voice quality indicators (HNR, jitter, shimmer)."""
        features = {}

        # Harmonic-to-Noise Ratio (HNR)
        try:
            harmonic = librosa.effects.harmonic(y=audio)
            percussive = librosa.effects.percussive(y=audio)
            hnr_values = []
            for i in range(0, len(harmonic), sr // 10):
                if i + sr // 10 > len(harmonic):
                    break
                h_segment = harmonic[i:i + sr // 10]
                p_segment = percussive[i:i + sr // 10]
                harmonic_energy = np.sum(h_segment ** 2)
                noise_energy = np.sum(p_segment ** 2)
                if noise_energy > 1e-10:
                    hnr = 10 * np.log10(harmonic_energy / noise_energy)
                    hnr_values.append(hnr)
            if hnr_values:
                features['hnr_mean'] = np.mean(hnr_values)
                features['hnr_std'] = np.std(hnr_values)
            else:
                features['hnr_mean'] = features['hnr_std'] = 0
        except Exception:
            features['hnr_mean'] = features['hnr_std'] = 0

        # Jitter (pitch variation)
        try:
            f0, _, _ = librosa.pyin(audio, fmin=50, fmax=400, sr=sr)
            f0_clean = f0[~np.isnan(f0)]
            if len(f0_clean) > 1:
                jitter = np.mean(np.abs(np.diff(f0_clean)) / f0_clean[:-1])
                features['jitter'] = jitter
            else:
                features['jitter'] = 0
        except Exception:
            features['jitter'] = 0

        # Shimmer (amplitude variation)
        try:
            rms = librosa.feature.rms(y=audio)[0]
            if len(rms) > 1:
                shimmer = np.mean(np.abs(np.diff(rms)) / rms[:-1])
                features['shimmer'] = shimmer
            else:
                features['shimmer'] = 0
        except Exception:
            features['shimmer'] = 0

        return features

    def extract_temporal_features(self, audio, sr):
        """Extract temporal/speech rate features."""
        features = {}

        # Onset detection for speech rate estimation
        onset_frames = librosa.onset.onset_detect(y=audio, sr=sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)

        if len(onset_times) > 0:
            duration = len(audio) / sr
            features['num_onsets'] = len(onset_times)
            features['onset_rate'] = len(onset_times) / max(duration, 0.1)  # onsets per second
        else:
            features['num_onsets'] = 0
            features['onset_rate'] = 0

        # Silence detection (using energy threshold)
        rms = librosa.feature.rms(y=audio)[0]
        energy_threshold = np.mean(rms) * 0.1
        silent_frames = np.where(rms < energy_threshold)[0]

        duration = len(audio) / sr
        features['silence_ratio'] = len(silent_frames) / max(len(rms), 1)
        features['voiced_ratio'] = 1.0 - features['silence_ratio']

        # Tempogram (rhythm analysis)
        try:
            tempogram = librosa.feature.tempogram(y=audio, sr=sr)
            features['tempogram_mean'] = np.mean(tempogram)
            features['tempogram_std'] = np.std(tempogram)
        except Exception:
            features['tempogram_mean'] = features['tempogram_std'] = 0

        return features

    def extract_all_features(self, audio, sr=None):
        """Extract all 50+ features."""
        if sr is None:
            sr = self.sr

        # Normalize audio
        audio = audio / (np.max(np.abs(audio)) + 1e-7)

        all_features = {}

        # Extract feature groups
        all_features.update(self.extract_prosodic_features(audio, sr))
        all_features.update(self.extract_spectral_features(audio, sr))
        all_features.update(self.extract_voice_quality_features(audio, sr))
        all_features.update(self.extract_temporal_features(audio, sr))

        return all_features


class FeaturePipeline:
    def __init__(self, sr=16000):
        self.extractor = FeatureExtractor(sr=sr)
        self.sr = sr
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_columns = None

    def augment_audio(self, audio, sr, augment_prob=0.5):
        """Apply random audio augmentation."""
        if np.random.random() > augment_prob:
            return audio

        # Randomly select augmentation
        aug_choice = np.random.randint(0, 4)

        if aug_choice == 0:
            # Time stretch
            rate = np.random.uniform(0.9, 1.1)
            audio = librosa.effects.time_stretch(audio, rate=rate)

        elif aug_choice == 1:
            # Pitch shift
            n_steps = np.random.randint(-2, 3)
            audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=n_steps)

        elif aug_choice == 2:
            # Add Gaussian noise
            noise = np.random.normal(0, 0.005, len(audio))
            audio = audio + noise

        elif aug_choice == 3:
            # Dynamic range compression
            threshold = 0.04
            ratio = 4.0
            audio_abs = np.abs(audio)
            gain = np.ones_like(audio)
            mask = audio_abs > threshold
            gain[mask] = 1.0 / (1.0 + ratio * (audio_abs[mask] / threshold - 1.0))
            audio = audio * gain

        # Ensure audio stays in reasonable range
        audio = np.clip(audio, -1.0, 1.0)

        return audio

    def extract_dataset_features(self, df, output_path=None, augment=False):
        """
        Extract features for all audio files in dataset.

        Args:
            df: DataFrame with 'file_path' and 'mental_health_label' columns
            output_path: Path to save features CSV
            augment: Whether to apply augmentation during extraction

        Returns:
            DataFrame with extracted features + labels
        """
        print("\n[Extracting Features]")

        feature_list = []
        failed_files = []

        for idx, row in tqdm(df.iterrows(), total=len(df), desc="Features"):
            file_path = row['file_path']

            # Skip synthetic samples (proxy datasets)
            if not Path(file_path).exists():
                feature_list.append({
                    'file_path': file_path,
                    'mental_health_label': row['mental_health_label'],
                    'dataset': row.get('dataset', 'unknown'),
                    'status': 'synthetic'
                })
                continue

            try:
                # Load audio
                audio, sr = librosa.load(file_path, sr=self.sr, mono=True)

                # Apply augmentation during training
                if augment:
                    audio = self.augment_audio(audio, sr, augment_prob=0.5)

                # Extract features
                features = self.extractor.extract_all_features(audio, sr=sr)

                # Add metadata
                features['file_path'] = file_path
                features['mental_health_label'] = row['mental_health_label']
                features['dataset'] = row.get('dataset', 'unknown')
                features['status'] = 'success'

                feature_list.append(features)

            except Exception as e:
                failed_files.append((file_path, str(e)))
                feature_list.append({
                    'file_path': file_path,
                    'mental_health_label': row['mental_health_label'],
                    'dataset': row.get('dataset', 'unknown'),
                    'status': 'failed'
                })

        features_df = pd.DataFrame(feature_list)

        if failed_files:
            print(f"\n  WARNING: Failed to process {len(failed_files)} files")

        # Save if requested
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            features_df.to_csv(output_path, index=False)
            print(f"  Saved features to {output_path}")

        print(f"  Extracted {len(features_df[features_df['status'] == 'success'])} samples")

        self.feature_columns = [col for col in features_df.columns
                               if col not in ['file_path', 'mental_health_label',
                                            'dataset', 'status']]

        return features_df

    def prepare_sequences(self, features_df, seq_length=50, stride=1):
        """
        Prepare sequences for BiLSTM.

        For time-series models, we use a sliding window over chronologically-ordered
        features. Since individual audio samples are processed independently,
        we create pseudo-sequences by stacking related samples.

        Args:
            features_df: DataFrame with extracted features
            seq_length: Sequence length for sliding window
            stride: Stride for sliding window

        Returns:
            Tuple of (X, y) where:
            - X: (n_sequences, seq_length, n_features)
            - y: (n_sequences,) with mental_health_label indices
        """
        print("\n[Preparing Sequences]")

        # Get feature columns (exclude metadata)
        feature_cols = [col for col in features_df.columns
                       if col not in ['file_path', 'mental_health_label',
                                     'dataset', 'status']]

        # Filter valid samples
        valid_df = features_df[features_df['status'] == 'success'].copy()

        if len(valid_df) < seq_length:
            print(f"  WARNING: Only {len(valid_df)} valid samples, need at least {seq_length}")
            # Pad with repeated samples if necessary
            while len(valid_df) < seq_length:
                valid_df = pd.concat([valid_df, valid_df.iloc[:1]], ignore_index=True)

        # Get label encoding
        from sklearn.preprocessing import LabelEncoder
        le = LabelEncoder()
        valid_df['label_idx'] = le.fit_transform(valid_df['mental_health_label'])

        # Create sequences using sliding window
        X_list = []
        y_list = []

        for i in range(0, len(valid_df) - seq_length + 1, stride):
            sequence = valid_df.iloc[i:i + seq_length][feature_cols].values
            label = valid_df.iloc[i + seq_length - 1]['label_idx']

            # Handle NaN values
            if np.isnan(sequence).any():
                sequence = np.nan_to_num(sequence, nan=0.0)

            X_list.append(sequence)
            y_list.append(label)

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.int64)

        print(f"  Created {len(X)} sequences of length {seq_length}")
        print(f"  Feature dimension: {X.shape[2]}")

        return X, y, le

    def fit_scaler(self, features_df):
        """Fit StandardScaler on features."""
        print("\n[Fitting Scaler]")

        feature_cols = [col for col in features_df.columns
                       if col not in ['file_path', 'mental_health_label',
                                     'dataset', 'status']]

        valid_df = features_df[features_df['status'] == 'success'].copy()

        X = valid_df[feature_cols].values
        X = np.nan_to_num(X, nan=0.0)

        self.scaler.fit(X)
        self.is_fitted = True
        self.feature_columns = feature_cols

        print(f"  Scaler fitted on {len(X)} samples")

        return self.scaler

    def transform(self, features_df):
        """Apply fitted scaler."""
        if not self.is_fitted:
            raise ValueError("Scaler not fitted. Call fit_scaler first.")

        feature_cols = [col for col in features_df.columns
                       if col not in ['file_path', 'mental_health_label',
                                     'dataset', 'status']]

        X = features_df[feature_cols].values
        X = np.nan_to_num(X, nan=0.0)

        X_scaled = self.scaler.transform(X)

        return X_scaled

    def save_scaler(self, path):
        """Save fitted scaler."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(self.scaler, f)
        print(f"Saved scaler to {path}")

    def load_scaler(self, path):
        """Load scaler."""
        with open(path, 'rb') as f:
            self.scaler = pickle.load(f)
        self.is_fitted = True
        print(f"Loaded scaler from {path}")


if __name__ == "__main__":
    # Example usage
    pipeline = FeaturePipeline(sr=16000)

    # Create dummy sample
    dummy_audio = np.random.randn(16000)  # 1 second at 16kHz

    features = pipeline.extractor.extract_all_features(dummy_audio)
    print(f"Extracted {len(features)} features")
    print(f"Feature keys: {list(features.keys())}")
