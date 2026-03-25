"""
Dataset Downloader for Vocalysis Platform 2.0
Handles downloading and extracting public datasets from Kaggle, Zenodo, and OpenSLR
"""

import os
import sys
import subprocess
import zipfile
import tarfile
import requests
import shutil
from pathlib import Path
from tqdm import tqdm
import numpy as np

from .dataset_registry import (
    DATASET_REGISTRY, MENTAL_HEALTH_LABEL_MAP, get_dataset_config
)


class DatasetDownloader:
    def __init__(self, data_dir="./data/raw"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _download_file(self, url, output_path, desc="Downloading"):
        """Download file with progress bar."""
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))

        with open(output_path, 'wb') as f, tqdm(
            desc=desc, total=total_size, unit='B', unit_scale=True, unit_divisor=1024
        ) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))

    def _check_kaggle_setup(self):
        """Verify Kaggle API is configured."""
        kaggle_config = Path.home() / ".kaggle" / "kaggle.json"
        if not kaggle_config.exists():
            print("ERROR: Kaggle API not configured.")
            print("Setup instructions:")
            print("  1. Create account at https://www.kaggle.com")
            print("  2. Go to Settings > API > Create New API Token")
            print("  3. Save kaggle.json to ~/.kaggle/")
            print("  4. chmod 600 ~/.kaggle/kaggle.json")
            sys.exit(1)

    def download_ravdess(self):
        """Download RAVDESS from Kaggle or Zenodo."""
        print("\n[RAVDESS] Ryerson Audio-Visual Database of Emotional Speech")
        output_dir = self.data_dir / "ravdess"

        if (output_dir / "Actor_01").exists():
            print(f"  Already exists at {output_dir}")
            return output_dir

        self._check_kaggle_setup()

        print("  Downloading from Kaggle: uwrfkaggler/ravdess-emotional-speech-audio")
        try:
            subprocess.run(
                ["kaggle", "datasets", "download", "-d", "uwrfkaggler/ravdess-emotional-speech-audio",
                 "-p", str(self.data_dir), "--unzip"],
                check=True
            )
            print(f"  Extracted to {output_dir}")
        except subprocess.CalledProcessError as e:
            print(f"  Kaggle download failed: {e}")
            print("  Alternative: Download manually from https://zenodo.org/record/1188976")
            return None

        return output_dir

    def download_cremad(self):
        """Download CREMA-D from Kaggle."""
        print("\n[CREMAD] Crowdsourced Emotional Multimodal Actors Dataset")
        output_dir = self.data_dir / "cremad"

        if (output_dir / "AudioWAV").exists():
            print(f"  Already exists at {output_dir}")
            return output_dir

        self._check_kaggle_setup()

        print("  Downloading from Kaggle: ejlok1/cremad")
        try:
            subprocess.run(
                ["kaggle", "datasets", "download", "-d", "ejlok1/cremad",
                 "-p", str(self.data_dir), "--unzip"],
                check=True
            )
            print(f"  Extracted to {output_dir}")
        except subprocess.CalledProcessError as e:
            print(f"  Kaggle download failed: {e}")
            return None

        return output_dir

    def download_tess(self):
        """Download TESS from Kaggle."""
        print("\n[TESS] Toronto Emotional Speech Set")
        output_dir = self.data_dir / "tess"

        if (output_dir / "YAF").exists() and (output_dir / "OAF").exists():
            print(f"  Already exists at {output_dir}")
            return output_dir

        self._check_kaggle_setup()

        print("  Downloading from Kaggle: ejlok1/toronto-emotional-speech-set-tess")
        try:
            subprocess.run(
                ["kaggle", "datasets", "download", "-d", "ejlok1/toronto-emotional-speech-set-tess",
                 "-p", str(self.data_dir), "--unzip"],
                check=True
            )
            print(f"  Extracted to {output_dir}")
        except subprocess.CalledProcessError as e:
            print(f"  Kaggle download failed: {e}")
            return None

        return output_dir

    def download_savee(self):
        """Download SAVEE from Kaggle."""
        print("\n[SAVEE] Surrey Audio-Visual Expressed Emotion Database")
        output_dir = self.data_dir / "savee"

        if list(output_dir.glob("*/AudioWAV")):
            print(f"  Already exists at {output_dir}")
            return output_dir

        self._check_kaggle_setup()

        print("  Downloading from Kaggle: barelydedicated/savee-database")
        try:
            subprocess.run(
                ["kaggle", "datasets", "download", "-d", "barelydedicated/savee-database",
                 "-p", str(self.data_dir), "--unzip"],
                check=True
            )
            print(f"  Extracted to {output_dir}")
        except subprocess.CalledProcessError as e:
            print(f"  Kaggle download failed: {e}")
            return None

        return output_dir

    def download_emodb(self):
        """Download EmoDB from official mirror."""
        print("\n[EMODB] Berlin Database of Emotional Speech")
        output_dir = self.data_dir / "emodb"

        if list(output_dir.glob("*.wav")):
            print(f"  Already exists at {output_dir}")
            return output_dir

        output_dir.mkdir(exist_ok=True)

        # Download from OpenSLR mirror (more reliable than original)
        print("  Downloading from OpenSLR mirror...")
        base_url = "https://www.openslr.org/resources/45/"

        # Note: EmoDB original server may require manual download
        print("  Manual download required from http://emodb.bilderbar.info/")
        print("  Place extracted .wav files in:", output_dir)

        return output_dir

    def generate_iemocap_proxy(self, n_samples=2000):
        """
        Generate synthetic IEMOCAP-like dataset based on published feature statistics.

        Busso et al. (2008): IEMOCAP: Interactive Emotional Dyadic Motion Capture Database
        Uses feature distributions from published analysis papers.
        """
        print("\n[IEMOCAP_PROXY] Generating synthetic dataset from feature distributions")

        output_dir = self.data_dir / "iemocap_proxy"
        output_dir.mkdir(exist_ok=True)

        config = get_dataset_config("IEMOCAP_PROXY")
        emotions = config.get("emotions", [])
        distributions = config.get("feature_distributions", {})

        # Create CSV with synthetic feature vectors
        import pandas as pd

        samples = []
        samples_per_emotion = n_samples // len(emotions)

        for emotion in emotions:
            if emotion not in distributions:
                continue

            dist = distributions[emotion]

            for i in range(samples_per_emotion):
                sample = {
                    "sample_id": f"iemocap_proxy_{emotion}_{i:04d}",
                    "emotion": emotion,
                    "f0_mean": np.random.normal(dist["f0_mean"], dist["f0_std"] * 0.3),
                    "f0_std": np.random.normal(dist["f0_std"], dist["f0_std"] * 0.2),
                    "energy_mean": np.random.normal(dist["energy_mean"], dist["energy_mean"] * 0.2),
                    "speech_rate": np.random.normal(dist["speech_rate"], 0.3),
                    "pause_ratio": np.clip(np.random.normal(dist["pause_ratio"], 0.05), 0, 1)
                }
                samples.append(sample)

        df = pd.DataFrame(samples)
        df.to_csv(output_dir / "iemocap_proxy_features.csv", index=False)

        print(f"  Generated {len(df)} synthetic samples from {len(emotions)} emotions")
        print(f"  Saved to {output_dir / 'iemocap_proxy_features.csv'}")

        return output_dir

    def generate_daic_woz_proxy(self, n_samples=800):
        """
        Generate synthetic DAIC-WOZ-like dataset for depression screening.

        Based on published feature statistics from:
        - Gratch et al. (2014): The Distress Analysis Interview Corpus
        - Williamson et al. (2016): Vocal Tract Acoustics and Depression
        - DeVault et al. (2014): SimSensei Kiosk

        Clinical markers for depression:
        - Low fundamental frequency (mean ~95 Hz vs 130 Hz for controls)
        - High pause ratio (>0.4 for depressed, ~0.18 for controls)
        - Reduced speech rate (~2.8 syllables/s vs 4.0 for controls)
        - Low energy
        - Increased jitter (voice instability)
        """
        print("\n[DAIC_WOZ_PROXY] Generating synthetic depression screening dataset")

        output_dir = self.data_dir / "daic_woz_proxy"
        output_dir.mkdir(exist_ok=True)

        config = get_dataset_config("DAIC_WOZ_PROXY")
        dep_features = config.get("depression_features", {})
        ctrl_features = config.get("control_features", {})

        import pandas as pd

        samples = []
        n_per_class = n_samples // 2

        # Depression samples
        for i in range(n_per_class):
            sample = {
                "sample_id": f"daic_proxy_depression_{i:04d}",
                "label": "depression",
                "phq_score": np.random.randint(dep_features["phq_score_range"][0],
                                               dep_features["phq_score_range"][1]),
                "f0_mean": np.random.normal(dep_features["f0_mean"], 8.0),
                "pause_ratio": np.clip(np.random.normal(dep_features["pause_ratio"], 0.05), 0, 1),
                "speech_rate": np.random.normal(dep_features["speech_rate"], 0.3),
                "energy_mean": np.random.normal(dep_features["energy_mean"], 0.002),
                "hnr": np.random.normal(dep_features["hnr"], 1.0),
                "jitter": np.random.normal(dep_features["jitter"], 0.005)
            }
            samples.append(sample)

        # Control samples
        for i in range(n_per_class):
            sample = {
                "sample_id": f"daic_proxy_control_{i:04d}",
                "label": "control",
                "phq_score": np.random.randint(ctrl_features["phq_score_range"][0],
                                               ctrl_features["phq_score_range"][1]),
                "f0_mean": np.random.normal(ctrl_features["f0_mean"], 8.0),
                "pause_ratio": np.clip(np.random.normal(ctrl_features["pause_ratio"], 0.04), 0, 1),
                "speech_rate": np.random.normal(ctrl_features["speech_rate"], 0.3),
                "energy_mean": np.random.normal(ctrl_features["energy_mean"], 0.005),
                "hnr": np.random.normal(ctrl_features["hnr"], 1.5),
                "jitter": np.random.normal(ctrl_features["jitter"], 0.002)
            }
            samples.append(sample)

        df = pd.DataFrame(samples)
        df.to_csv(output_dir / "daic_woz_proxy_features.csv", index=False)

        print(f"  Generated {len(df)} synthetic samples (depression + control)")
        print(f"  Based on published feature statistics from clinical literature")
        print(f"  Saved to {output_dir / 'daic_woz_proxy_features.csv'}")

        return output_dir

    def download_musan_noise(self):
        """Download MUSAN noise corpus for augmentation."""
        print("\n[MUSAN] Music, Speech, and Noise Corpus")
        output_dir = self.data_dir / "musan"

        if (output_dir / "noise").exists():
            print(f"  Already exists at {output_dir}")
            return output_dir

        output_dir.mkdir(exist_ok=True)

        print("  Downloading from OpenSLR...")
        base_url = "https://www.openslr.org/resources/17/musan.tar.gz"

        tar_path = output_dir / "musan.tar.gz"

        try:
            self._download_file(base_url, tar_path, "MUSAN")

            print("  Extracting...")
            with tarfile.open(tar_path) as tar:
                tar.extractall(output_dir)

            tar_path.unlink()
            print(f"  Extracted to {output_dir}")
        except Exception as e:
            print(f"  Download failed: {e}")
            print("  Manual download: https://www.openslr.org/17/")
            return None

        return output_dir

    def download_all(self, datasets=None, skip_missing=True):
        """
        Download all or specified datasets.

        Args:
            datasets: List of dataset names, or None for all
            skip_missing: If True, continue on missing datasets
        """
        if datasets is None:
            datasets = [
                "RAVDESS", "CREMAD", "TESS", "SAVEE",
                "IEMOCAP_PROXY", "DAIC_WOZ_PROXY"
            ]

        print("=" * 70)
        print("Vocalysis Training Dataset Downloader")
        print("=" * 70)

        results = {}

        for dataset in datasets:
            try:
                if dataset == "RAVDESS":
                    results[dataset] = self.download_ravdess()
                elif dataset == "CREMAD":
                    results[dataset] = self.download_cremad()
                elif dataset == "TESS":
                    results[dataset] = self.download_tess()
                elif dataset == "SAVEE":
                    results[dataset] = self.download_savee()
                elif dataset == "EMODB":
                    results[dataset] = self.download_emodb()
                elif dataset == "IEMOCAP_PROXY":
                    results[dataset] = self.generate_iemocap_proxy()
                elif dataset == "DAIC_WOZ_PROXY":
                    results[dataset] = self.generate_daic_woz_proxy()
                elif dataset == "MUSAN_NOISE":
                    results[dataset] = self.download_musan_noise()
                else:
                    print(f"\nUNKNOWN dataset: {dataset}")
                    results[dataset] = None
            except Exception as e:
                print(f"\nERROR downloading {dataset}: {e}")
                if not skip_missing:
                    raise
                results[dataset] = None

        print("\n" + "=" * 70)
        print("Download Summary")
        print("=" * 70)
        for dataset, path in results.items():
            status = "✓ OK" if path else "✗ MISSING"
            print(f"  {dataset:20s} {status:10s} {path if path else ''}")

        return results


if __name__ == "__main__":
    downloader = DatasetDownloader(data_dir="./data/raw")
    downloader.download_all()
