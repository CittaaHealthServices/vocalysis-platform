"""
Quality assessment module for audio validation and preprocessing.
"""

import io
import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment


class QualityChecker:
    """Validates and preprocesses audio files for acoustic analysis."""

    def __init__(self, target_sr=16000, min_duration=10.0, noise_duration=0.5):
        """
        Initialize QualityChecker.

        Args:
            target_sr: Target sample rate in Hz (default 16000)
            min_duration: Minimum acceptable duration in seconds (default 10)
            noise_duration: Duration to sample for noise floor estimation (default 0.5)
        """
        self.target_sr = target_sr
        self.min_duration = min_duration
        self.noise_duration = noise_duration

    def _detect_mime_type(self, audio_bytes):
        """
        Detect MIME type from audio buffer.

        Args:
            audio_bytes: Audio data as bytes

        Returns:
            str: Detected MIME type ('audio/wav' or 'audio/mpeg') or 'unknown'
        """
        if len(audio_bytes) < 4:
            return 'unknown'

        # WAV signature: RIFF...WAVE
        if audio_bytes[:4] == b'RIFF' and audio_bytes[8:12] == b'WAVE':
            return 'audio/wav'

        # MP3 signature: ID3 or FF FA/FB (MPEG frame)
        if audio_bytes[:3] == b'ID3':
            return 'audio/mpeg'
        if audio_bytes[0:2] == b'\xff' and (audio_bytes[1] & 0xE0) == 0xE0:
            return 'audio/mpeg'

        return 'unknown'

    def _convert_mp3_to_wav(self, audio_bytes):
        """
        Convert MP3 bytes to WAV bytes.

        Args:
            audio_bytes: MP3 audio data as bytes

        Returns:
            bytes: WAV-formatted audio data
        """
        try:
            audio = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
            wav_buffer = io.BytesIO()
            audio.export(wav_buffer, format='wav')
            return wav_buffer.getvalue()
        except Exception as e:
            raise ValueError(f"Failed to convert MP3 to WAV: {str(e)}")

    def _estimate_snr(self, audio_array, sr):
        """
        Estimate Signal-to-Noise Ratio using first segment as noise floor.

        Args:
            audio_array: Audio time series
            sr: Sample rate

        Returns:
            float: Estimated SNR in dB
        """
        try:
            # Sample noise from first segment
            noise_samples = int(sr * self.noise_duration)
            noise_samples = min(noise_samples, len(audio_array) // 2)

            if noise_samples < 100:
                return 0.0

            noise_floor = np.mean(audio_array[:noise_samples] ** 2)
            signal_energy = np.mean(audio_array ** 2)

            if noise_floor < 1e-10:
                noise_floor = 1e-10

            snr_linear = signal_energy / noise_floor
            snr_db = 10 * np.log10(snr_linear)

            return float(np.clip(snr_db, -20, 80))
        except Exception:
            return 0.0

    def _estimate_voiced_fraction(self, audio_array, sr):
        """
        Estimate fraction of voiced segments using harmonic decomposition.

        Args:
            audio_array: Audio time series
            sr: Sample rate

        Returns:
            float: Fraction of voiced frames (0-1)
        """
        try:
            # Use librosa's harmonic/percussive decomposition
            harmonic = librosa.effects.harmonic(audio_array)

            # Compute energy in harmonic component
            harmonic_energy = np.mean(harmonic ** 2)
            total_energy = np.mean(audio_array ** 2)

            if total_energy < 1e-10:
                return 0.0

            voiced_fraction = harmonic_energy / total_energy
            return float(np.clip(voiced_fraction, 0, 1))
        except Exception:
            return 0.0

    def _compute_quality_score(self, duration, snr, voiced_fraction):
        """
        Compute overall quality score (0-100).

        Args:
            duration: Audio duration in seconds
            snr: Signal-to-Noise Ratio in dB
            voiced_fraction: Fraction of voiced content

        Returns:
            float: Quality score (0-100)
        """
        # Duration component: max score at 30+ seconds
        duration_score = min(duration / 30.0, 1.0) * 30

        # SNR component: scaled to 0-50, clipped at min -5 dB
        snr_normalized = (snr + 5) / 50.0
        snr_score = np.clip(snr_normalized, 0, 1.0) * 50

        # Voiced component: 20 points for voiced content
        voiced_score = voiced_fraction * 20

        total_score = duration_score + snr_score + voiced_score
        return float(np.clip(total_score, 0, 100))

    def check(self, audio_bytes, filename):
        """
        Validate and preprocess audio file.

        Args:
            audio_bytes: Raw audio file bytes
            filename: Original filename (for logging)

        Returns:
            dict: {
                valid: bool,
                reason: str or None,
                audio_array: np.ndarray or None,
                sample_rate: int,
                duration_seconds: float,
                snr_estimate: float,
                voiced_fraction: float,
                quality_score: float
            }
        """
        result = {
            'valid': False,
            'reason': None,
            'audio_array': None,
            'sample_rate': self.target_sr,
            'duration_seconds': 0.0,
            'snr_estimate': 0.0,
            'voiced_fraction': 0.0,
            'quality_score': 0.0
        }

        # Validate buffer size
        if not audio_bytes or len(audio_bytes) < 100:
            result['reason'] = 'Audio file too small'
            return result

        # Detect MIME type
        mime_type = self._detect_mime_type(audio_bytes)

        if mime_type not in ['audio/wav', 'audio/mpeg']:
            result['reason'] = f'Unsupported audio format: {mime_type}'
            return result

        # Convert MP3 to WAV if needed
        if mime_type == 'audio/mpeg':
            try:
                audio_bytes = self._convert_mp3_to_wav(audio_bytes)
            except Exception as e:
                result['reason'] = f'MP3 conversion failed: {str(e)}'
                return result

        # Load and resample audio
        try:
            audio_array, sr = sf.read(io.BytesIO(audio_bytes))

            # Convert to mono
            if len(audio_array.shape) > 1:
                audio_array = np.mean(audio_array, axis=1)

            # Resample to target sample rate
            if sr != self.target_sr:
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=self.target_sr)

            sr = self.target_sr

        except Exception as e:
            result['reason'] = f'Failed to load audio: {str(e)}'
            return result

        # Check duration
        duration = len(audio_array) / sr
        if duration < self.min_duration:
            result['reason'] = f'Audio too short: {duration:.1f}s < {self.min_duration}s'
            return result

        # Estimate SNR
        snr = self._estimate_snr(audio_array, sr)

        # Estimate voiced fraction
        voiced_fraction = self._estimate_voiced_fraction(audio_array, sr)

        # Compute quality score
        quality_score = self._compute_quality_score(duration, snr, voiced_fraction)

        # Populate result
        result['valid'] = True
        result['audio_array'] = audio_array
        result['sample_rate'] = sr
        result['duration_seconds'] = float(duration)
        result['snr_estimate'] = float(snr)
        result['voiced_fraction'] = float(voiced_fraction)
        result['quality_score'] = float(quality_score)

        return result
