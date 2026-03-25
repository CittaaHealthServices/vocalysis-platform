"""
Deterministic fallback scoring based on clinical feature thresholds.
Used when primary ML inference is unavailable.
"""

import numpy as np


class DeterministicScorer:
    """
    Rule-based scorer using clinical literature thresholds.
    Provides psychological state estimates from acoustic features.
    """

    def __init__(self):
        """Initialize scorer with clinical reference thresholds."""
        # Clinical thresholds based on psychoacoustic literature
        self.f0_mean_normal = (100, 200)  # Hz, typical range
        self.speech_rate_normal = (2.5, 4.5)  # syllables/sec
        self.jitter_normal_max = 0.06  # 6% is typical upper limit
        self.shimmer_normal_max = 0.15  # 15% is typical upper limit
        self.hnr_normal_min = 15  # dB, lower values indicate dysphonia

    def _score_depression_indicators(self, features):
        """
        Score depression indicators based on vocal acoustic markers.

        Depression markers:
        - Low fundamental frequency (f0_mean < 100 Hz)
        - Reduced pitch variation (f0_std < 10 Hz)
        - Slow speech rate (< 2.5 syllables/sec)
        - High pause ratio (> 0.3)
        - Low energy (energy_mean < 0.02)
        - Low articulation rate
        """
        score = 0

        # F0 markers
        f0_mean = features.get('f0_mean', 100)
        if f0_mean < 80:
            score += 25
        elif f0_mean < 100:
            score += 15
        elif f0_mean > 250:
            score -= 5

        # F0 variation
        f0_std = features.get('f0_std', 10)
        if f0_std < 8:
            score += 20
        elif f0_std < 15:
            score += 10

        # Speech rate
        speech_rate = features.get('speech_rate', 3.5)
        if speech_rate < 2.0:
            score += 25
        elif speech_rate < 2.5:
            score += 15
        elif speech_rate > 5.0:
            score -= 10

        # Pause ratio
        pause_ratio = features.get('pause_ratio', 0.2)
        if pause_ratio > 0.4:
            score += 20
        elif pause_ratio > 0.3:
            score += 10

        # Energy
        energy_mean = features.get('energy_mean', 0.05)
        if energy_mean < 0.02:
            score += 15
        elif energy_mean < 0.03:
            score += 8

        # Articulation rate
        articulation_rate = features.get('articulation_rate', 3.5)
        if articulation_rate < 2.0:
            score += 10

        return np.clip(score, 0, 100)

    def _score_anxiety_indicators(self, features):
        """
        Score anxiety indicators based on vocal acoustic markers.

        Anxiety markers:
        - High jitter (> 6%)
        - High shimmer (> 15%)
        - High F0 variability (f0_std > 25 Hz)
        - High pitch (f0_mean > 220 Hz)
        - Fast articulation rate (> 5.5 syllables/sec)
        - Low HNR (< 15 dB)
        - High energy variation (energy_std high)
        """
        score = 0

        # Jitter
        jitter_local = features.get('jitter_local', 0.03)
        if jitter_local > 0.08:
            score += 25
        elif jitter_local > 0.06:
            score += 15
        elif jitter_local > 0.04:
            score += 5

        # Shimmer
        shimmer_local = features.get('shimmer_local', 0.1)
        if shimmer_local > 0.2:
            score += 25
        elif shimmer_local > 0.15:
            score += 15
        elif shimmer_local > 0.12:
            score += 5

        # F0 variability (high = unstable, anxious)
        f0_std = features.get('f0_std', 10)
        if f0_std > 30:
            score += 20
        elif f0_std > 20:
            score += 10

        # High pitch
        f0_mean = features.get('f0_mean', 130)
        if f0_mean > 240:
            score += 15
        elif f0_mean > 200:
            score += 8

        # Fast articulation
        articulation_rate = features.get('articulation_rate', 3.5)
        if articulation_rate > 5.5:
            score += 15
        elif articulation_rate > 4.8:
            score += 8

        # Low HNR
        hnr = features.get('hnr', 20)
        if hnr < 12:
            score += 20
        elif hnr < 15:
            score += 10
        elif hnr < 18:
            score += 5

        # Energy variation
        energy_std = features.get('energy_std', 0.01)
        if energy_std > 0.02:
            score += 10

        return np.clip(score, 0, 100)

    def _score_stress_indicators(self, features):
        """
        Score stress indicators based on vocal acoustic markers.

        Stress markers:
        - High energy (energy_mean > 0.08)
        - Fast speech rate (> 4.5 syllables/sec)
        - Irregular rhythm (high rhythm_regularity std)
        - High F0 range (f0_range > 150 Hz)
        - Low pause ratio (< 0.1, continuous speech)
        - High spectral centroid (shifted high-frequency emphasis)
        """
        score = 0

        # Energy
        energy_mean = features.get('energy_mean', 0.05)
        if energy_mean > 0.10:
            score += 20
        elif energy_mean > 0.08:
            score += 12
        elif energy_mean > 0.06:
            score += 5

        # Speech rate
        speech_rate = features.get('speech_rate', 3.5)
        if speech_rate > 5.0:
            score += 20
        elif speech_rate > 4.5:
            score += 12
        elif speech_rate > 4.0:
            score += 5

        # Rhythm irregularity
        rhythm_regularity = features.get('rhythm_regularity', 0.05)
        if rhythm_regularity > 0.15:
            score += 15
        elif rhythm_regularity > 0.10:
            score += 8

        # F0 range
        f0_range = features.get('f0_range', 80)
        if f0_range > 200:
            score += 15
        elif f0_range > 150:
            score += 8

        # Low pause ratio (continuous speech, no breaks)
        pause_ratio = features.get('pause_ratio', 0.2)
        if pause_ratio < 0.05:
            score += 15
        elif pause_ratio < 0.10:
            score += 8

        # Spectral centroid (high = shifted to high frequencies)
        spec_centroid = features.get('spectral_centroid_mean', 2000)
        if spec_centroid > 3000:
            score += 10
        elif spec_centroid > 2500:
            score += 5

        return np.clip(score, 0, 100)

    def _score_emotional_stability(self, features):
        """
        Score emotional stability (inverse of distress).

        Stability markers (opposite of distress):
        - Moderate, stable F0 (not too high or low, low variability)
        - Consistent speech rate
        - Clear voice quality (low jitter/shimmer, high HNR)
        - Moderate energy with normal variation
        - Regular rhythm
        """
        score = 100  # Start with full score

        # F0 stability
        f0_mean = features.get('f0_mean', 130)
        f0_std = features.get('f0_std', 10)

        if f0_mean < 80 or f0_mean > 250:
            score -= 20
        if f0_std > 30:
            score -= 15
        if f0_std < 5:
            score -= 5  # Too stable, potentially monotone

        # Speech rate consistency
        speech_rate = features.get('speech_rate', 3.5)
        if speech_rate < 2.0 or speech_rate > 5.5:
            score -= 15
        elif speech_rate < 2.5 or speech_rate > 5.0:
            score -= 8

        # Voice quality
        jitter_local = features.get('jitter_local', 0.03)
        shimmer_local = features.get('shimmer_local', 0.1)
        hnr = features.get('hnr', 20)

        if jitter_local > 0.08 or shimmer_local > 0.20:
            score -= 20
        elif jitter_local > 0.06 or shimmer_local > 0.15:
            score -= 10

        if hnr < 15:
            score -= 15
        elif hnr < 18:
            score -= 5

        # Rhythm
        rhythm_regularity = features.get('rhythm_regularity', 0.05)
        if rhythm_regularity > 0.15:
            score -= 10
        elif rhythm_regularity > 0.10:
            score -= 5

        # Energy balance
        energy_mean = features.get('energy_mean', 0.05)
        energy_std = features.get('energy_std', 0.01)

        if energy_mean < 0.02 or energy_mean > 0.12:
            score -= 10
        if energy_std > 0.025:
            score -= 8

        # Pause ratio (some pauses are healthy)
        pause_ratio = features.get('pause_ratio', 0.2)
        if pause_ratio < 0.05 or pause_ratio > 0.40:
            score -= 10
        elif pause_ratio < 0.10 or pause_ratio > 0.30:
            score -= 5

        return np.clip(score, 0, 100)

    def score(self, features_dict):
        """
        Score psychological state indicators from acoustic features.

        Args:
            features_dict: Dictionary of extracted acoustic features

        Returns:
            dict: {
                depression_score: float (0-100),
                anxiety_score: float (0-100),
                stress_score: float (0-100),
                emotional_stability_score: float (0-100),
                confidence_score: float (0-100, lower than VocaCore)
            }
        """
        depression = self._score_depression_indicators(features_dict)
        anxiety = self._score_anxiety_indicators(features_dict)
        stress = self._score_stress_indicators(features_dict)
        stability = self._score_emotional_stability(features_dict)

        # Confidence is based on feature quality
        # Lower than primary ML model since this is fallback
        confidence = 45  # Fixed fallback confidence

        return {
            'depression_score': float(depression),
            'anxiety_score': float(anxiety),
            'stress_score': float(stress),
            'emotional_stability_score': float(stability),
            'confidence_score': float(confidence)
        }
