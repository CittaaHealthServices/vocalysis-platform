"""
Dataset Preprocessor for Vocalysis Platform 2.0
Loads and unifies audio datasets into a single training DataFrame
"""

import os
import re
import warnings
from pathlib import Path
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from tqdm import tqdm

from .dataset_registry import (
    DATASET_REGISTRY, MENTAL_HEALTH_LABEL_MAP, get_dataset_config
)

warnings.filterwarnings('ignore')


class DatasetPreprocessor:
    def __init__(self):
        self.datasets_loaded = {}

    def load_ravdess(self, data_dir):
        """
        Load RAVDESS dataset.
        Filename format: 03-01-05-01-01-01-01.wav
        Positions: modality, channel, emotion, intensity, statement, repetition, actor
        """
        print("\n[Loading RAVDESS]")
        data_dir = Path(data_dir)

        config = get_dataset_config("RAVDESS")
        emotion_map = config["label_map"]
        mh_map = config["mental_health_map"]

        samples = []

        # RAVDESS has Actor_01 through Actor_24 folders
        actor_dirs = sorted(data_dir.glob("Actor_*"))

        for actor_dir in tqdm(actor_dirs, desc="RAVDESS"):
            audio_files = list(actor_dir.glob("*.wav"))

            for audio_path in audio_files:
                try:
                    filename = audio_path.stem

                    # Parse filename: 03-01-05-01-01-01-01
                    parts = filename.split("-")
                    if len(parts) < 7:
                        continue

                    emotion_idx = parts[2]  # Position 3
                    intensity_idx = parts[3]  # Position 4

                    if emotion_idx not in emotion_map:
                        continue

                    emotion = emotion_map[emotion_idx]
                    mental_health = mh_map.get(emotion, "normal")

                    samples.append({
                        "file_path": str(audio_path),
                        "emotion": emotion,
                        "mental_health_label": mental_health,
                        "dataset": "RAVDESS",
                        "language": "English",
                        "speaker_id": f"ravdess_actor_{parts[6]}"
                    })
                except Exception as e:
                    continue

        df = pd.DataFrame(samples)
        print(f"  Loaded {len(df)} samples")
        self.datasets_loaded["RAVDESS"] = df
        return df

    def load_cremad(self, data_dir):
        """
        Load CREMA-D dataset.
        Filename format: 1001_IEO_SAD_HI.wav
        Positions: actor_id, sentence, emotion, intensity
        """
        print("\n[Loading CREMAD]")
        data_dir = Path(data_dir)

        config = get_dataset_config("CREMAD")
        emotion_map = config["label_map"]
        mh_map = config["mental_health_map"]

        samples = []

        # CREMA-D audio is in AudioWAV subfolder
        audio_dir = data_dir / "AudioWAV"
        if not audio_dir.exists():
            audio_dir = data_dir

        audio_files = sorted(audio_dir.glob("*.wav"))

        for audio_path in tqdm(audio_files, desc="CREMAD"):
            try:
                filename = audio_path.stem

                # Parse filename: 1001_IEO_SAD_HI
                parts = filename.split("_")
                if len(parts) < 3:
                    continue

                emotion_code = parts[2].upper()

                if emotion_code not in emotion_map:
                    continue

                emotion = emotion_map[emotion_code]
                mental_health = mh_map.get(emotion, "normal")

                samples.append({
                    "file_path": str(audio_path),
                    "emotion": emotion,
                    "mental_health_label": mental_health,
                    "dataset": "CREMAD",
                    "language": "English",
                    "speaker_id": f"cremad_actor_{parts[0]}"
                })
            except Exception as e:
                continue

        df = pd.DataFrame(samples)
        print(f"  Loaded {len(df)} samples")
        self.datasets_loaded["CREMAD"] = df
        return df

    def load_tess(self, data_dir):
        """
        Load TESS dataset.
        Directory structure: YAF/ and OAF/ folders with emotion labels in filenames
        Filename format: 01_angry.wav
        """
        print("\n[Loading TESS]")
        data_dir = Path(data_dir)

        config = get_dataset_config("TESS")
        emotion_map = config["label_map"]
        mh_map = config["mental_health_map"]

        samples = []

        # TESS has YAF (young) and OAF (old) folders
        for age_folder in ["YAF", "OAF"]:
            age_dir = data_dir / age_folder
            if not age_dir.exists():
                continue

            audio_files = sorted(age_dir.glob("*.wav"))

            for audio_path in tqdm(audio_files, desc=f"TESS-{age_folder}"):
                try:
                    filename = audio_path.stem

                    # Parse filename: 01_angry
                    parts = filename.rsplit("_", 1)
                    if len(parts) != 2:
                        continue

                    emotion = parts[1].lower()

                    if emotion not in emotion_map:
                        continue

                    mental_health = mh_map.get(emotion, "normal")

                    samples.append({
                        "file_path": str(audio_path),
                        "emotion": emotion,
                        "mental_health_label": mental_health,
                        "dataset": "TESS",
                        "language": "English",
                        "speaker_id": f"tess_{age_folder}_{parts[0]}"
                    })
                except Exception as e:
                    continue

        df = pd.DataFrame(samples)
        print(f"  Loaded {len(df)} samples")
        self.datasets_loaded["TESS"] = df
        return df

    def load_savee(self, data_dir):
        """
        Load SAVEE dataset.
        Directory structure: JE/, JK/, KL/, MJ/ (actor folders) with AudioWAV subfolders
        Filename format: JE_a05.wav where 'a' is emotion code
        """
        print("\n[Loading SAVEE]")
        data_dir = Path(data_dir)

        config = get_dataset_config("SAVEE")
        emotion_map = config["label_map"]
        mh_map = config["mental_health_map"]

        samples = []

        # Find audio files in actor folders
        audio_files = sorted(data_dir.glob("*/AudioWAV/*.wav"))
        if not audio_files:
            audio_files = sorted(data_dir.glob("*/*.wav"))

        for audio_path in tqdm(audio_files, desc="SAVEE"):
            try:
                filename = audio_path.stem

                # Parse filename: JE_a05 or similar
                if "_" in filename:
                    parts = filename.split("_")
                    emotion_code = parts[-1][0] if parts[-1] else ""
                else:
                    emotion_code = filename[0] if filename else ""

                if emotion_code not in emotion_map:
                    continue

                emotion = emotion_map[emotion_code]
                mental_health = mh_map.get(emotion, "normal")

                samples.append({
                    "file_path": str(audio_path),
                    "emotion": emotion,
                    "mental_health_label": mental_health,
                    "dataset": "SAVEE",
                    "language": "English",
                    "speaker_id": f"savee_{filename.split('_')[0]}"
                })
            except Exception as e:
                continue

        df = pd.DataFrame(samples)
        print(f"  Loaded {len(df)} samples")
        self.datasets_loaded["SAVEE"] = df
        return df

    def load_emodb(self, data_dir):
        """
        Load EmoDB (Berlin Database of Emotional Speech).
        Filename format: 03a01Nc.wav where position 3 is emotion code
        """
        print("\n[Loading EMODB]")
        data_dir = Path(data_dir)

        config = get_dataset_config("EMODB")
        emotion_map = config["label_map"]
        mh_map = config["mental_health_map"]

        samples = []

        audio_files = sorted(data_dir.glob("*.wav"))

        for audio_path in tqdm(audio_files, desc="EMODB"):
            try:
                filename = audio_path.stem

                # EmoDB filename: NNECVV.wav where E is emotion
                if len(filename) >= 3:
                    emotion_code = filename[2].lower()

                    if emotion_code not in emotion_map:
                        continue

                    emotion = emotion_map[emotion_code]
                    mental_health = mh_map.get(emotion, "normal")

                    samples.append({
                        "file_path": str(audio_path),
                        "emotion": emotion,
                        "mental_health_label": mental_health,
                        "dataset": "EMODB",
                        "language": "German",
                        "speaker_id": f"emodb_{filename[:2]}"
                    })
            except Exception as e:
                continue

        df = pd.DataFrame(samples)
        print(f"  Loaded {len(df)} samples")
        self.datasets_loaded["EMODB"] = df
        return df

    def load_iemocap_proxy(self, data_dir):
        """Load synthetic IEMOCAP proxy dataset."""
        print("\n[Loading IEMOCAP_PROXY]")
        data_dir = Path(data_dir)

        csv_path = data_dir / "iemocap_proxy_features.csv"
        if not csv_path.exists():
            print("  IEMOCAP proxy not generated. Run downloader first.")
            return pd.DataFrame()

        df = pd.read_csv(csv_path)

        # Map emotions to mental health labels
        mh_map = {
            "neutral": "normal",
            "happy": "normal",
            "sad": "depression",
            "angry": "stress",
            "frustrated": "stress"
        }

        df["mental_health_label"] = df["emotion"].map(mh_map).fillna("normal")
        df["dataset"] = "IEMOCAP_PROXY"
        df["language"] = "English"
        df["speaker_id"] = df["sample_id"]
        df["file_path"] = df["sample_id"]  # Synthetic, no real file

        print(f"  Loaded {len(df)} synthetic samples")
        self.datasets_loaded["IEMOCAP_PROXY"] = df
        return df

    def load_daic_woz_proxy(self, data_dir):
        """Load synthetic DAIC-WOZ proxy dataset."""
        print("\n[Loading DAIC_WOZ_PROXY]")
        data_dir = Path(data_dir)

        csv_path = data_dir / "daic_woz_proxy_features.csv"
        if not csv_path.exists():
            print("  DAIC-WOZ proxy not generated. Run downloader first.")
            return pd.DataFrame()

        df = pd.read_csv(csv_path)

        # Map to mental health labels
        mh_map = {
            "depression": "depression",
            "control": "normal"
        }

        df["emotion"] = df["label"].map(lambda x: "sadness" if x == "depression" else "neutral")
        df["mental_health_label"] = df["label"].map(mh_map)
        df["dataset"] = "DAIC_WOZ_PROXY"
        df["language"] = "English"
        df["speaker_id"] = df["sample_id"]
        df["file_path"] = df["sample_id"]  # Synthetic

        print(f"  Loaded {len(df)} synthetic samples")
        self.datasets_loaded["DAIC_WOZ_PROXY"] = df
        return df

    def build_unified_dataset(self, data_dirs, datasets=None):
        """
        Build unified DataFrame from multiple dataset directories.

        Args:
            data_dirs: Dict mapping dataset name to directory path
            datasets: List of datasets to load, or None for all

        Returns:
            pd.DataFrame with columns: [file_path, emotion, mental_health_label,
                                       dataset, language, speaker_id]
        """
        print("\n" + "=" * 70)
        print("Building Unified Dataset")
        print("=" * 70)

        if datasets is None:
            datasets = list(data_dirs.keys())

        all_dfs = []

        for dataset_name in datasets:
            if dataset_name not in data_dirs:
                print(f"  Skipping {dataset_name} (no path provided)")
                continue

            data_dir = Path(data_dirs[dataset_name])
            if not data_dir.exists():
                print(f"  Skipping {dataset_name} (directory not found)")
                continue

            try:
                if dataset_name == "RAVDESS":
                    df = self.load_ravdess(data_dir)
                elif dataset_name == "CREMAD":
                    df = self.load_cremad(data_dir)
                elif dataset_name == "TESS":
                    df = self.load_tess(data_dir)
                elif dataset_name == "SAVEE":
                    df = self.load_savee(data_dir)
                elif dataset_name == "EMODB":
                    df = self.load_emodb(data_dir)
                elif dataset_name == "IEMOCAP_PROXY":
                    df = self.load_iemocap_proxy(data_dir)
                elif dataset_name == "DAIC_WOZ_PROXY":
                    df = self.load_daic_woz_proxy(data_dir)
                else:
                    print(f"  Unknown dataset: {dataset_name}")
                    continue

                if len(df) > 0:
                    all_dfs.append(df)
            except Exception as e:
                print(f"  ERROR loading {dataset_name}: {e}")
                continue

        if not all_dfs:
            print("ERROR: No datasets loaded!")
            return pd.DataFrame()

        unified_df = pd.concat(all_dfs, ignore_index=True)

        print("\n" + "=" * 70)
        print("Unified Dataset Summary")
        print("=" * 70)
        print(f"Total samples: {len(unified_df)}")
        print(f"\nBy dataset:")
        print(unified_df.groupby("dataset").size().to_string())
        print(f"\nBy mental health label:")
        print(unified_df.groupby("mental_health_label").size().to_string())
        print(f"\nLanguages: {unified_df['language'].unique()}")

        return unified_df

    def balance_classes(self, df, strategy="oversample", random_state=42):
        """
        Balance mental health label classes using SMOTE or random over/under-sampling.

        Args:
            df: DataFrame with mental_health_label column
            strategy: 'oversample', 'undersample', or 'smote'
            random_state: Random seed

        Returns:
            Balanced DataFrame
        """
        print("\n[Balancing Classes]")

        label_counts = df["mental_health_label"].value_counts()
        print(f"Before balancing:")
        print(label_counts.to_string())

        if strategy == "oversample":
            # Oversample minority classes to match majority
            max_count = label_counts.max()
            balanced_dfs = []

            for label in label_counts.index:
                label_df = df[df["mental_health_label"] == label]
                if len(label_df) < max_count:
                    # Oversample
                    label_df = label_df.sample(n=max_count, replace=True, random_state=random_state)
                balanced_dfs.append(label_df)

            df_balanced = pd.concat(balanced_dfs, ignore_index=True).sample(
                frac=1, random_state=random_state
            ).reset_index(drop=True)

        elif strategy == "undersample":
            # Undersample majority classes to match minority
            min_count = label_counts.min()
            balanced_dfs = []

            for label in label_counts.index:
                label_df = df[df["mental_health_label"] == label]
                if len(label_df) > min_count:
                    label_df = label_df.sample(n=min_count, random_state=random_state)
                balanced_dfs.append(label_df)

            df_balanced = pd.concat(balanced_dfs, ignore_index=True).sample(
                frac=1, random_state=random_state
            ).reset_index(drop=True)

        elif strategy == "smote":
            try:
                from imblearn.over_sampling import SMOTE
                from imblearn.pipeline import Pipeline as ImbPipeline

                # For SMOTE, we need numeric features
                # Use a simple proxy: numeric encoding of labels + dataset
                le_label = pd.factorize(df["mental_health_label"])[0]
                le_dataset = pd.factorize(df["dataset"])[0]

                X = np.column_stack([le_label, le_dataset])
                y = df["mental_health_label"].values

                smote = SMOTE(random_state=random_state, k_neighbors=3)
                try:
                    X_balanced, y_balanced = smote.fit_resample(X, y)

                    # Reconstruct DataFrame
                    df_balanced = df.iloc[np.arange(len(df))].copy()
                    df_balanced["mental_health_label"] = y_balanced
                except Exception:
                    # Fall back to oversample if SMOTE fails
                    print("  SMOTE failed, falling back to oversample")
                    return self.balance_classes(df, strategy="oversample", random_state=random_state)
            except ImportError:
                print("  imbalanced-learn not installed, using oversample")
                return self.balance_classes(df, strategy="oversample", random_state=random_state)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        print(f"\nAfter balancing:")
        print(df_balanced["mental_health_label"].value_counts().to_string())

        return df_balanced


def create_train_test_split(df, test_size=0.2, val_size=0.1, random_state=42):
    """
    Split dataset into train/val/test ensuring no speaker overlap.

    Args:
        df: Unified dataset DataFrame
        test_size: Fraction for test set
        val_size: Fraction for validation set (from training data)
        random_state: Random seed

    Returns:
        Tuple of (train_df, val_df, test_df)
    """
    from sklearn.model_selection import train_test_split

    np.random.seed(random_state)

    # Split by speaker_id to avoid data leakage
    speakers = df["speaker_id"].unique()
    train_speakers, test_speakers = train_test_split(
        speakers, test_size=test_size, random_state=random_state
    )

    train_speakers, val_speakers = train_test_split(
        train_speakers, test_size=val_size / (1 - test_size), random_state=random_state
    )

    train_df = df[df["speaker_id"].isin(train_speakers)].reset_index(drop=True)
    val_df = df[df["speaker_id"].isin(val_speakers)].reset_index(drop=True)
    test_df = df[df["speaker_id"].isin(test_speakers)].reset_index(drop=True)

    print("\n" + "=" * 70)
    print("Train/Val/Test Split")
    print("=" * 70)
    print(f"Train: {len(train_df)} samples ({len(train_speakers)} speakers)")
    print(f"Val:   {len(val_df)} samples ({len(val_speakers)} speakers)")
    print(f"Test:  {len(test_df)} samples ({len(test_speakers)} speakers)")

    return train_df, val_df, test_df


if __name__ == "__main__":
    preprocessor = DatasetPreprocessor()

    # Example usage
    data_dirs = {
        "RAVDESS": "./data/raw/ravdess",
        "CREMAD": "./data/raw/cremad",
        "TESS": "./data/raw/tess",
        "IEMOCAP_PROXY": "./data/raw/iemocap_proxy",
        "DAIC_WOZ_PROXY": "./data/raw/daic_woz_proxy"
    }

    unified_df = preprocessor.build_unified_dataset(data_dirs)
    balanced_df = preprocessor.balance_classes(unified_df, strategy="oversample")
    train_df, val_df, test_df = create_train_test_split(balanced_df)

    print("\nPreprocessing complete!")
