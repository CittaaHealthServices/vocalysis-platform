"""
Acoustic feature extraction module for comprehensive voice analysis.
"""

import numpy as np
import librosa
import parselmouth
from scipy import signal
from scipy.signal import find_peaks


class FeatureExtractor:
    """Extracts comprehensive acoustic features from audio signals."""

    def __init__(self, sr=16000):
        """
        Initialize FeatureExtractor.

        Args:
            sr: Sample rate in Hz (default 16000)
        """
        self.sr = sr
        self.hop_length = int(0.010 * sr)  # 10ms hop
        self.n_fft = int(0.025 * sr)       # 25ms window

    def _safe_extract(self, func, *args, **kwargs):
        """
        Safely extract features with exception handling.

        Returns 0.0 on any exception to prevent crashes.
        """
        try:
            return func(*args, **kwargs)
        except Exception:
            return 0.0

    # ========== PROSODY FEATURES ==========

    def _extract_f0_features(self, audio_array):
        """Extract F0 (fundamental frequency) features using parselmouth."""
        try:
            # Convert to parselmouth Sound object
            sound = parselmouth.Sound(audio_array, sampling_frequency=self.sr)

            # Extract pitch with Praat
            pitch = sound.to_pitch(time_step=0.010)  # 10ms frames

            # Get F0 values
            f0_values = pitch.selected_array(True)

            # Filter voiced frames (non-zero F0)
            voiced_f0 = f0_values[f0_values > 0]

            if len(voiced_f0) < 2:
                return {
                    'f0_mean': 0.0,
                    'f0_std': 0.0,
                    'f0_range': 0.0,
                    'f0_slope': 0.0
                }

            f0_mean = float(np.mean(voiced_f0))
            f0_std = float(np.std(voiced_f0))
            f0_range = float(np.max(voiced_f0) - np.min(voiced_f0))

            # Compute F0 slope via linear regression
            x = np.arange(len(voiced_f0))
            if len(voiced_f0) > 2:
                coeffs = np.polyfit(x, voiced_f0, 1)
                f0_slope = float(coeffs[0])
            else:
                f0_slope = 0.0

            return {
                'f0_mean': f0_mean,
                'f0_std': f0_std,
                'f0_range': f0_range,
                'f0_slope': f0_slope
            }
        except Exception:
            return {
                'f0_mean': 0.0,
                'f0_std': 0.0,
                'f0_range': 0.0,
                'f0_slope': 0.0
            }

    def _extract_speech_rate(self, audio_array):
        """Estimate speech rate via amplitude envelope peak detection."""
        try:
            # Compute amplitude envelope
            S = np.abs(librosa.stft(audio_array, n_fft=self.n_fft, hop_length=self.hop_length))
            env = np.mean(S, axis=0)

            # Normalize envelope
            if np.max(env) > 0:
                env = env / np.max(env)

            # Find peaks (syllable candidates)
            peaks, _ = find_peaks(env, height=0.3, distance=int(0.1 * self.sr / self.hop_length))

            # Convert to time
            times = librosa.frames_to_time(peaks, sr=self.sr, hop_length=self.hop_length)
            duration = len(audio_array) / self.sr

            if len(peaks) < 2 or duration < 1.0:
                return 0.0

            # Estimate syllables from peak count
            num_syllables = len(peaks)
            speech_rate = num_syllables / duration

            return float(np.clip(speech_rate, 0, 10))
        except Exception:
            return 0.0

    def _extract_articulation_rate(self, audio_array):
        """Estimate articulation rate (speech rate excluding pauses)."""
        try:
            # Compute RMS energy
            rms = librosa.feature.rms(y=audio_array, hop_length=self.hop_length)[0]

            # Threshold for voiced frames
            threshold = np.mean(rms) * 0.2
            voiced_frames = rms > threshold

            if np.sum(voiced_frames) < 2:
                return 0.0

            # Get speech rate
            speech_rate = self._extract_speech_rate(audio_array)

            # Approximate articulation rate
            voiced_ratio = np.sum(voiced_frames) / len(voiced_frames)
            if voiced_ratio > 0:
                articulation_rate = speech_rate / voiced_ratio
            else:
                articulation_rate = 0.0

            return float(np.clip(articulation_rate, 0, 15))
        except Exception:
            return 0.0

    def _extract_pause_features(self, audio_array):
        """Extract pause-related features."""
        try:
            # Compute RMS energy
            rms = librosa.feature.rms(y=audio_array, hop_length=self.hop_length)[0]

            # Silence threshold
            threshold = np.mean(rms) * 0.1
            silence_frames = rms <= threshold

            # Convert frames to time
            times = librosa.frames_to_time(np.arange(len(rms)), sr=self.sr, hop_length=self.hop_length)
            frame_duration = times[1] - times[0] if len(times) > 1 else 0.01

            # Identify pause events
            pause_duration_threshold = 0.3  # 300ms
            pause_frames = int(pause_duration_threshold / frame_duration)

            # Find contiguous silence regions
            silence_diff = np.diff(silence_frames.astype(int))
            pause_starts = np.where(silence_diff == 1)[0]
            pause_ends = np.where(silence_diff == -1)[0]

            pause_durations = []
            pause_count = 0

            for start, end in zip(pause_starts, pause_ends):
                duration = (end - start) * frame_duration
                if duration >= pause_duration_threshold:
                    pause_durations.append(duration)
                    pause_count += 1

            # Compute metrics
            total_duration = len(audio_array) / self.sr
            total_pause_duration = sum(pause_durations) if pause_durations else 0.0
            pause_ratio = total_pause_duration / total_duration if total_duration > 0 else 0.0

            pause_duration_mean = np.mean(pause_durations) if pause_durations else 0.0

            return {
                'pause_ratio': float(np.clip(pause_ratio, 0, 1)),
                'pause_count': int(pause_count),
                'pause_duration_mean': float(pause_duration_mean),
                'pause_duration_total': float(total_pause_duration)
            }
        except Exception:
            return {
                'pause_ratio': 0.0,
                'pause_count': 0,
                'pause_duration_mean': 0.0,
                'pause_duration_total': 0.0
            }

    def _extract_energy_features(self, audio_array):
        """Extract energy-based features."""
        try:
            # Compute RMS energy
            rms = librosa.feature.rms(y=audio_array, hop_length=self.hop_length)[0]

            energy_mean = float(np.mean(rms))
            energy_std = float(np.std(rms))

            return {
                'energy_mean': energy_mean,
                'energy_std': energy_std
            }
        except Exception:
            return {
                'energy_mean': 0.0,
                'energy_std': 0.0
            }

    def _extract_rhythm_features(self, audio_array):
        """Extract rhythm and regularity features."""
        try:
            # Get speech rate to estimate syllable timing
            speech_rate = self._extract_speech_rate(audio_array)

            if speech_rate < 0.1:
                return {
                    'rhythm_regularity': 0.0,
                    'inter_utterance_gap_mean': 0.0,
                    'inter_utterance_gap_std': 0.0
                }

            # Compute amplitude envelope
            S = np.abs(librosa.stft(audio_array, n_fft=self.n_fft, hop_length=self.hop_length))
            env = np.mean(S, axis=0)

            if np.max(env) > 0:
                env = env / np.max(env)

            # Find peaks
            peaks, _ = find_peaks(env, height=0.3, distance=int(0.1 * self.sr / self.hop_length))

            if len(peaks) < 3:
                return {
                    'rhythm_regularity': 0.0,
                    'inter_utterance_gap_mean': 0.0,
                    'inter_utterance_gap_std': 0.0
                }

            # Compute inter-peak intervals (syllable intervals)
            peak_times = librosa.frames_to_time(peaks, sr=self.sr, hop_length=self.hop_length)
            intervals = np.diff(peak_times)

            # Rhythm regularity: lower std = more regular
            rhythm_regularity = float(np.std(intervals)) if len(intervals) > 1 else 0.0

            gap_mean = float(np.mean(intervals))
            gap_std = float(np.std(intervals)) if len(intervals) > 1 else 0.0

            return {
                'rhythm_regularity': rhythm_regularity,
                'inter_utterance_gap_mean': gap_mean,
                'inter_utterance_gap_std': gap_std
            }
        except Exception:
            return {
                'rhythm_regularity': 0.0,
                'inter_utterance_gap_mean': 0.0,
                'inter_utterance_gap_std': 0.0
            }

    def _extract_spectral_features(self, audio_array):
        """Extract spectral features."""
        try:
            # Spectral centroid
            spec_centroid = librosa.feature.spectral_centroid(y=audio_array, sr=self.sr, hop_length=self.hop_length)[0]
            spectral_centroid_mean = float(np.mean(spec_centroid))

            # Zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(audio_array, hop_length=self.hop_length)[0]
            zero_crossing_rate_mean = float(np.mean(zcr))

            return {
                'spectral_centroid_mean': spectral_centroid_mean,
                'zero_crossing_rate_mean': zero_crossing_rate_mean
            }
        except Exception:
            return {
                'spectral_centroid_mean': 0.0,
                'zero_crossing_rate_mean': 0.0
            }

    def _extract_loudness_contour(self, audio_array):
        """Extract loudness contour slope."""
        try:
            # Compute RMS over time
            rms = librosa.feature.rms(y=audio_array, hop_length=self.hop_length)[0]

            if len(rms) < 2:
                return 0.0

            # Linear regression on RMS contour
            x = np.arange(len(rms))
            coeffs = np.polyfit(x, rms, 1)

            return float(coeffs[0])
        except Exception:
            return 0.0

    def _extract_voiced_fraction(self, audio_array):
        """Extract voiced fraction."""
        try:
            harmonic = librosa.effects.harmonic(audio_array)
            harmonic_energy = np.mean(harmonic ** 2)
            total_energy = np.mean(audio_array ** 2)

            if total_energy < 1e-10:
                return 0.0

            voiced_fraction = harmonic_energy / total_energy
            return float(np.clip(voiced_fraction, 0, 1))
        except Exception:
            return 0.0

    # ========== VOICE QUALITY FEATURES ==========

    def _extract_jitter_shimmer(self, audio_array):
        """Extract jitter and shimmer using parselmouth."""
        try:
            sound = parselmouth.Sound(audio_array, sampling_frequency=self.sr)

            # Extract pitch
            pitch = sound.to_pitch(time_step=0.010)

            # Create point process for jitter calculation
            point_process = sound.to_point_process_cc(pitch=pitch)

            if point_process.get_number_of_points() < 3:
                return {
                    'jitter_local': 0.0,
                    'jitter_ppq5': 0.0,
                    'shimmer_local': 0.0,
                    'shimmer_apq11': 0.0
                }

            # Extract jitter
            jitter_local = point_process.get_jitter_local(
                time_range_seconds=(0, len(audio_array) / self.sr)
            )
            jitter_ppq5 = point_process.get_jitter_ppq5(
                time_range_seconds=(0, len(audio_array) / self.sr)
            )

            # Extract shimmer using amplitude tier
            amplitude_tier = sound.to_amplitude_tier()

            if amplitude_tier.get_number_of_points() < 3:
                shimmer_local = 0.0
                shimmer_apq11 = 0.0
            else:
                shimmer_local = amplitude_tier.get_shimmer_local(
                    time_range_seconds=(0, len(audio_array) / self.sr),
                    point_process=point_process
                )
                shimmer_apq11 = amplitude_tier.get_shimmer_apq11(
                    time_range_seconds=(0, len(audio_array) / self.sr),
                    point_process=point_process
                )

            return {
                'jitter_local': float(np.clip(jitter_local, 0, 1)),
                'jitter_ppq5': float(np.clip(jitter_ppq5, 0, 1)),
                'shimmer_local': float(np.clip(shimmer_local, 0, 1)),
                'shimmer_apq11': float(np.clip(shimmer_apq11, 0, 1))
            }
        except Exception:
            return {
                'jitter_local': 0.0,
                'jitter_ppq5': 0.0,
                'shimmer_local': 0.0,
                'shimmer_apq11': 0.0
            }

    def _extract_hnr(self, audio_array):
        """Extract Harmonics-to-Noise Ratio using parselmouth.
        Indian male voices go down to ~75 Hz; using 75 as minimum pitch
        captures low-register Tamil/Kannada male speakers correctly."""
        try:
            sound = parselmouth.Sound(audio_array, sampling_frequency=self.sr)

            # Extract harmonicity — minimum_pitch=75 for Indian voice floor
            harmonicity = sound.to_harmonicity_cc(
                time_step=0.010,
                minimum_pitch=75,
                silence_threshold=0.1
            )

            hnr_values = harmonicity.values
            hnr_values = hnr_values[hnr_values > -200]  # Filter unreliable values

            if len(hnr_values) < 1:
                return 0.0

            hnr = float(np.mean(hnr_values))
            return np.clip(hnr, -20, 40)
        except Exception:
            return 0.0

    def _extract_gne(self, audio_array):
        """
        Estimate Glottal-to-Noise Excitation via spectral ratio.
        GNE = energy in low frequencies / total energy
        """
        try:
            # Compute spectrogram
            S = np.abs(librosa.stft(audio_array, n_fft=self.n_fft, hop_length=self.hop_length))

            # Low frequency threshold (0-2000 Hz)
            freq_threshold = 2000
            freq_bins = librosa.fft_frequencies(sr=self.sr, n_fft=self.n_fft)
            low_freq_idx = freq_bins < freq_threshold

            low_freq_energy = np.mean(S[low_freq_idx, :])
            total_energy = np.mean(S)

            if total_energy < 1e-10:
                return 0.0

            gne = low_freq_energy / total_energy
            return float(np.clip(gne, 0, 1))
        except Exception:
            return 0.0

    def _extract_vti_spi(self, audio_array):
        """
        Estimate Voice Turbulence Index and Soft Phonation Index.
        VTI = high frequency energy / total energy
        SPI = low frequency energy / high frequency energy
        """
        try:
            # Compute spectrogram
            S = np.abs(librosa.stft(audio_array, n_fft=self.n_fft, hop_length=self.hop_length))

            freq_bins = librosa.fft_frequencies(sr=self.sr, n_fft=self.n_fft)

            # Low frequencies (0-500 Hz)
            low_idx = freq_bins < 500
            # High frequencies (2000-5000 Hz)
            high_idx = (freq_bins >= 2000) & (freq_bins <= 5000)

            low_energy = np.mean(S[low_idx, :])
            high_energy = np.mean(S[high_idx, :])
            total_energy = np.mean(S)

            if total_energy < 1e-10:
                return {'vti': 0.0, 'spi': 0.0}

            vti = high_energy / total_energy
            spi = low_energy / high_energy if high_energy > 1e-10 else 0.0

            return {
                'vti': float(np.clip(vti, 0, 1)),
                'spi': float(np.clip(spi, 0, 10))
            }
        except Exception:
            return {'vti': 0.0, 'spi': 0.0}

    def _extract_formants(self, audio_array):
        """Extract first two formants using LPC via parselmouth."""
        try:
            sound = parselmouth.Sound(audio_array, sampling_frequency=self.sr)

            # Extract formants
            formant_object = sound.to_formant_burg(
                time_step=0.010,
                max_number_of_formants=5,
                maximum_formant=5000
            )

            # Get first two formant values
            f1_values = []
            f2_values = []

            for i in range(1, formant_object.get_number_of_frames() + 1):
                try:
                    f1 = formant_object.get_value_at_time(1, formant_object.get_time_from_frame_number(i))
                    f2 = formant_object.get_value_at_time(2, formant_object.get_time_from_frame_number(i))

                    if f1 > 0 and f1 < 2000:
                        f1_values.append(f1)
                    if f2 > 0 and f2 < 5000:
                        f2_values.append(f2)
                except Exception:
                    continue

            f1_mean = float(np.mean(f1_values)) if f1_values else 0.0
            f2_mean = float(np.mean(f2_values)) if f2_values else 0.0

            return {
                'f1_mean': f1_mean,
                'f2_mean': f2_mean
            }
        except Exception:
            return {
                'f1_mean': 0.0,
                'f2_mean': 0.0
            }

    # ========== MFCC FEATURES ==========

    def _extract_mfcc_features(self, audio_array):
        """Extract MFCC coefficients and delta features."""
        try:
            # Extract 13 MFCC coefficients
            mfccs = librosa.feature.mfcc(y=audio_array, sr=self.sr, n_mfcc=13, hop_length=self.hop_length)

            # Extract delta (first derivative)
            mfcc_delta = librosa.feature.delta(mfccs)

            # Compute means
            mfcc_dict = {}
            for i in range(13):
                mfcc_dict[f'mfcc{i+1}_mean'] = float(np.mean(mfccs[i, :]))

            # Delta means for first 4 coefficients
            for i in range(4):
                mfcc_dict[f'mfcc{i+1}_delta_mean'] = float(np.mean(mfcc_delta[i, :]))

            # Extract spectral centroid as energy representation
            spec_centroid = librosa.feature.spectral_centroid(y=audio_array, sr=self.sr, hop_length=self.hop_length)[0]
            mfcc_dict['mfcc_energy_mean'] = float(np.mean(spec_centroid))

            return mfcc_dict
        except Exception:
            # Return zeros for all MFCC features
            mfcc_dict = {}
            for i in range(13):
                mfcc_dict[f'mfcc{i+1}_mean'] = 0.0
            for i in range(4):
                mfcc_dict[f'mfcc{i+1}_delta_mean'] = 0.0
            mfcc_dict['mfcc_energy_mean'] = 0.0
            return mfcc_dict

    # ========== MAIN EXTRACTION METHOD ==========

    def extract(self, audio_array, sample_rate):
        """
        Extract comprehensive acoustic features.

        Audio is expected to arrive already denoised and peak-normalised
        from QualityChecker.  If called directly (e.g. from elevenlabs_trainer),
        it works on the raw array — ElevenLabs-generated audio is already clean.

        Args:
            audio_array: Audio time series (numpy array, float32 mono)
            sample_rate: Sample rate in Hz

        Returns:
            dict: Complete feature vector with all acoustic measures
        """
        self.sr = sample_rate

        features = {}

        # PROSODY FEATURES
        f0_features = self._safe_extract(self._extract_f0_features, audio_array)
        features.update(f0_features)

        features['speech_rate'] = self._safe_extract(self._extract_speech_rate, audio_array)
        features['articulation_rate'] = self._safe_extract(self._extract_articulation_rate, audio_array)

        pause_features = self._safe_extract(self._extract_pause_features, audio_array)
        features.update(pause_features)

        energy_features = self._safe_extract(self._extract_energy_features, audio_array)
        features.update(energy_features)

        features['voiced_fraction'] = self._safe_extract(self._extract_voiced_fraction, audio_array)

        rhythm_features = self._safe_extract(self._extract_rhythm_features, audio_array)
        features.update(rhythm_features)

        features['loudness_contour_slope'] = self._safe_extract(self._extract_loudness_contour, audio_array)

        spectral_features = self._safe_extract(self._extract_spectral_features, audio_array)
        features.update(spectral_features)

        # VOICE QUALITY FEATURES
        jitter_shimmer = self._safe_extract(self._extract_jitter_shimmer, audio_array)
        features.update(jitter_shimmer)

        features['hnr'] = self._safe_extract(self._extract_hnr, audio_array)
        features['nhr'] = 1.0 / features['hnr'] if features['hnr'] > 0.01 else 0.0

        features['gne'] = self._safe_extract(self._extract_gne, audio_array)

        vti_spi = self._safe_extract(self._extract_vti_spi, audio_array)
        features.update(vti_spi)

        formants = self._safe_extract(self._extract_formants, audio_array)
        features.update(formants)

        # MFCC FEATURES
        mfcc_features = self._safe_extract(self._extract_mfcc_features, audio_array)
        features.update(mfcc_features)

        return features
