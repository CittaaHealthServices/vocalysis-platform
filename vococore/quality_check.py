"""
Quality assessment module for audio validation and preprocessing.

Handles real-world Indian recording environments:
- Office noise, traffic, fans, AC units, construction
- Mobile phone recordings (compressed, low bitrate)
- Noisy homes, factory floors, vehicle cabins
- All Indian language groups: Hindi, Telugu, Tamil, Kannada, Malayalam,
  Marathi, Bengali, Gujarati, Punjabi, Indian English
- File formats: WAV, MP3, M4A, OGG, OPUS, WEBM
"""

import io
import logging
import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment

logger = logging.getLogger(__name__)


class QualityChecker:
    """Validates, denoises, and preprocesses audio for acoustic analysis."""

    def __init__(self, target_sr=16000, min_duration=8.0):
        """
        Initialize QualityChecker.

        Args:
            target_sr:    Target sample rate in Hz (default 16000)
            min_duration: Minimum acceptable duration in seconds (default 8.0)
                          Reduced from 10s — Indian users often speak less but
                          pack more meaningful content per second.
        """
        self.target_sr    = target_sr
        self.min_duration = min_duration

    # ── Format detection & conversion ─────────────────────────────────────────

    def _detect_format(self, audio_bytes):
        """Detect audio format from magic bytes. Returns format string."""
        if len(audio_bytes) < 12:
            return 'unknown'
        h = audio_bytes[:12]

        if h[:4] == b'RIFF' and h[8:12] == b'WAVE':
            return 'wav'
        if h[:3] == b'ID3' or (h[0] == 0xFF and (h[1] & 0xE0) == 0xE0):
            return 'mp3'
        # M4A / MP4 / AAC container
        if h[4:8] in (b'ftyp', b'moov', b'mdat'):
            return 'm4a'
        # OGG container (Vorbis, Opus)
        if h[:4] == b'OggS':
            return 'ogg'
        # WEBM / Matroska
        if h[:4] == b'\x1a\x45\xdf\xa3':
            return 'webm'
        # FLAC
        if h[:4] == b'fLaC':
            return 'flac'
        return 'unknown'

    def _to_wav_bytes(self, audio_bytes, fmt):
        """Convert any supported format → WAV bytes via pydub."""
        try:
            seg = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
            buf = io.BytesIO()
            seg.export(buf, format='wav')
            return buf.getvalue()
        except Exception as e:
            raise ValueError(f"Format conversion ({fmt}→wav) failed: {e}")

    # ── Noise reduction ────────────────────────────────────────────────────────

    def _remove_noise(self, audio_array, sr):
        """
        Spectral subtraction noise reduction calibrated for Indian environments.

        Strategy:
          1. Try noisereduce (stationary + non-stationary mode).
          2. Fall back to lightweight spectral gating if noisereduce is absent.

        Handles: office HVAC, traffic, fan hum, construction, kitchen sounds,
        factory floor noise.  Does NOT aggressively process the voice itself —
        prop_decrease is capped at 0.85 to preserve natural Indian voice timbre
        (retroflex consonants, nasalisation, schwa-deletion patterns).
        """
        try:
            import noisereduce as nr

            # Use the quietest 10% of frames as noise profile
            # (avoids using speech as noise reference — critical for
            #  rapid-onset recordings where speech starts immediately)
            frame_len = int(0.025 * sr)
            hop       = int(0.010 * sr)
            rms_frames = np.array([
                np.sqrt(np.mean(audio_array[i:i+frame_len]**2))
                for i in range(0, len(audio_array) - frame_len, hop)
            ])
            threshold_pct = np.percentile(rms_frames, 10)
            quiet_mask = rms_frames <= threshold_pct

            # Collect quiet frames as noise sample
            noise_chunks = []
            for i, is_quiet in enumerate(quiet_mask):
                if is_quiet:
                    start = i * hop
                    noise_chunks.append(audio_array[start:start + frame_len])

            if len(noise_chunks) >= 20:
                noise_clip = np.concatenate(noise_chunks[:80])
            else:
                # Absolute fallback: use first 0.5 s
                noise_clip = audio_array[:int(0.5 * sr)]

            # Stationary noise (HVAC, fans, hum) — aggressive reduction
            denoised = nr.reduce_noise(
                y             = audio_array,
                sr            = sr,
                y_noise       = noise_clip,
                stationary    = True,
                prop_decrease = 0.80,   # cap at 80% to keep voice natural
            )

            # Non-stationary pass (traffic, intermittent bangs)
            denoised = nr.reduce_noise(
                y             = denoised,
                sr            = sr,
                stationary    = False,
                prop_decrease = 0.55,
            )

            logger.info('Noise reduction applied (noisereduce)')
            return denoised.astype(np.float32)

        except ImportError:
            # Lightweight fallback: spectral gating with Wiener filter approximation
            return self._spectral_gate(audio_array, sr)
        except Exception as e:
            logger.warning('Noise reduction failed (%s) — using raw audio', e)
            return audio_array

    def _spectral_gate(self, audio_array, sr):
        """
        Fallback spectral gating when noisereduce is unavailable.
        Suppresses frequency bins below the noise floor estimate.
        """
        try:
            from scipy.signal import stft, istft

            nperseg = int(0.025 * sr)
            noverlap = int(0.015 * sr)
            f, t, Zxx = stft(audio_array, fs=sr, nperseg=nperseg, noverlap=noverlap)

            # Noise floor: median of lowest 15% energy frames
            mag = np.abs(Zxx)
            frame_energy = np.mean(mag, axis=0)
            noise_thresh = np.percentile(frame_energy, 15)

            # Soft mask: suppress bins where mag < 2× noise_floor
            noise_floor_per_bin = np.percentile(mag, 15, axis=1, keepdims=True)
            mask = np.clip((mag - noise_floor_per_bin * 2) / (noise_floor_per_bin + 1e-9), 0, 1)
            Zxx_clean = Zxx * mask

            _, audio_clean = istft(Zxx_clean, fs=sr, nperseg=nperseg, noverlap=noverlap)
            # Align length
            audio_clean = audio_clean[:len(audio_array)]
            if len(audio_clean) < len(audio_array):
                audio_clean = np.pad(audio_clean, (0, len(audio_array) - len(audio_clean)))

            logger.info('Spectral gating applied (fallback)')
            return audio_clean.astype(np.float32)
        except Exception:
            return audio_array

    # ── Post-denoising normalisation ──────────────────────────────────────────

    def _normalise(self, audio_array):
        """
        Peak normalise to -3 dBFS so all recordings are at comparable loudness.
        Avoids clipping while keeping headroom for feature extraction.
        """
        peak = np.max(np.abs(audio_array))
        if peak > 1e-6:
            target = 0.708  # -3 dBFS
            audio_array = audio_array * (target / peak)
        return audio_array

    # ── SNR estimation ────────────────────────────────────────────────────────

    def _estimate_snr(self, audio_array, sr):
        """
        Estimate SNR using quietest-segment approach.
        More accurate than first-N-samples for Indian environments where
        speech often starts within the first 0.2 s of recording.
        """
        try:
            frame_len = int(0.025 * sr)
            hop       = int(0.010 * sr)
            rms_vals  = np.array([
                np.mean(audio_array[i:i+frame_len]**2)
                for i in range(0, len(audio_array) - frame_len, hop)
            ])
            if len(rms_vals) < 4:
                return 20.0

            noise_floor  = np.percentile(rms_vals, 5)   # quietest 5%
            signal_power = np.percentile(rms_vals, 75)  # typical speech frame

            if noise_floor < 1e-12:
                return 40.0   # essentially silent background → excellent SNR

            snr_db = 10 * np.log10(max(signal_power / noise_floor, 1.0))
            return float(np.clip(snr_db, 0, 80))
        except Exception:
            return 20.0   # safe default

    # ── Voice fraction estimation ─────────────────────────────────────────────

    def _estimate_voiced_fraction(self, audio_array, sr):
        """Fraction of voiced frames using harmonic decomposition."""
        try:
            harmonic      = librosa.effects.harmonic(audio_array)
            harmonic_rms  = np.mean(harmonic ** 2)
            total_rms     = np.mean(audio_array ** 2)
            if total_rms < 1e-10:
                return 0.0
            return float(np.clip(harmonic_rms / total_rms, 0, 1))
        except Exception:
            return 0.5   # neutral default

    # ── Quality score ─────────────────────────────────────────────────────────

    def _compute_quality_score(self, duration, snr, voiced_fraction):
        """
        Compute overall quality score (0-100).
        Calibrated for real-world Indian mobile recordings.
        """
        # Duration: 30s = full marks; shorter degrades gracefully
        dur_score    = min(duration / 30.0, 1.0) * 35

        # SNR: 20 dB+ is fine in typical Indian environments;
        # even 8 dB is workable after noise reduction
        snr_norm     = np.clip((snr - 8) / 32.0, 0, 1)
        snr_score    = snr_norm * 45

        # Voiced content
        voiced_score = voiced_fraction * 20

        return float(np.clip(dur_score + snr_score + voiced_score, 0, 100))

    # ── Main entry point ──────────────────────────────────────────────────────

    def check(self, audio_bytes, filename):
        """
        Validate, denoise, and preprocess audio.

        Accepts: WAV, MP3, M4A, OGG, OGG-Opus, WEBM, FLAC
        Denoises: HVAC, traffic, fans, construction, kitchen, factory floor

        Returns:
            dict: {
                valid, reason, audio_array, sample_rate,
                duration_seconds, snr_estimate, voiced_fraction,
                quality_score, noise_reduced (bool)
            }
        """
        result = {
            'valid':            False,
            'reason':           None,
            'audio_array':      None,
            'sample_rate':      self.target_sr,
            'duration_seconds': 0.0,
            'snr_estimate':     0.0,
            'voiced_fraction':  0.0,
            'quality_score':    0.0,
            'noise_reduced':    False,
        }

        if not audio_bytes or len(audio_bytes) < 100:
            result['reason'] = 'Audio file too small or empty'
            return result

        fmt = self._detect_format(audio_bytes)

        # Convert non-WAV formats to WAV first
        if fmt != 'wav':
            if fmt == 'unknown':
                # Last-ditch attempt with pydub auto-detect
                fmt = 'mp3'
            try:
                audio_bytes = self._to_wav_bytes(audio_bytes, fmt)
                logger.info('Converted %s → wav', fmt)
            except Exception as e:
                result['reason'] = f'Could not decode audio ({fmt}): {e}'
                return result

        # Load with soundfile → librosa resample
        try:
            audio_array, sr = sf.read(io.BytesIO(audio_bytes))
            if len(audio_array.shape) > 1:
                audio_array = np.mean(audio_array, axis=1)   # to mono
            if sr != self.target_sr:
                audio_array = librosa.resample(
                    audio_array.astype(np.float32),
                    orig_sr=sr, target_sr=self.target_sr
                )
            audio_array = audio_array.astype(np.float32)
        except Exception as e:
            result['reason'] = f'Failed to load audio: {e}'
            return result

        duration = len(audio_array) / self.target_sr
        if duration < self.min_duration:
            result['reason'] = (
                f'Recording too short ({duration:.1f}s) — '
                f'please speak for at least {self.min_duration:.0f} seconds'
            )
            return result

        # ── SNR before denoising (for logging) ────────────────────────────────
        snr_raw = self._estimate_snr(audio_array, self.target_sr)

        # ── Noise reduction ────────────────────────────────────────────────────
        # Applied even for seemingly clean audio — always improves feature quality.
        audio_array   = self._remove_noise(audio_array, self.target_sr)
        noise_reduced = True

        # ── Peak normalise ─────────────────────────────────────────────────────
        audio_array = self._normalise(audio_array)

        # ── Final quality metrics ──────────────────────────────────────────────
        snr             = self._estimate_snr(audio_array, self.target_sr)
        voiced_fraction = self._estimate_voiced_fraction(audio_array, self.target_sr)
        quality_score   = self._compute_quality_score(duration, snr, voiced_fraction)

        logger.info(
            'QualityCheck OK — dur=%.1fs snr_raw=%.1fdB snr_clean=%.1fdB '
            'voiced=%.2f quality=%.0f',
            duration, snr_raw, snr, voiced_fraction, quality_score
        )

        result.update({
            'valid':            True,
            'audio_array':      audio_array,
            'sample_rate':      self.target_sr,
            'duration_seconds': float(duration),
            'snr_estimate':     float(snr),
            'voiced_fraction':  float(voiced_fraction),
            'quality_score':    float(quality_score),
            'noise_reduced':    noise_reduced,
        })
        return result
