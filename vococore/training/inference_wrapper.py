"""
Inference Wrapper for Vocalysis Platform 2.0
Production-ready model inference for mental health voice biomarker analysis
"""

import pickle
from pathlib import Path
import numpy as np
import torch
import librosa

from models.bilstm_model import MentalHealthBiLSTM, EnsembleModel
from features.feature_pipeline import FeatureExtractor


class InferenceWrapper:
    """
    Production inference wrapper for trained Vocalysis models.

    Handles:
    - Loading trained models and preprocessing artifacts
    - Feature extraction from raw audio
    - Batch and single-sample inference
    - Score scaling and interpretation
    - Confidence estimation
    """

    def __init__(
        self,
        model_path,
        scaler_path,
        label_encoder_path,
        model_type='bilstm',
        device='cpu'
    ):
        """
        Initialize inference wrapper.

        Args:
            model_path: Path to trained model checkpoint (.pth)
            scaler_path: Path to fitted StandardScaler (pickle)
            label_encoder_path: Path to label encoder (pickle)
            model_type: 'bilstm' or 'ensemble'
            device: 'cpu' or 'cuda'
        """
        self.device = torch.device(device)
        self.model_type = model_type
        self.seq_length = 50

        # Load model
        checkpoint = torch.load(model_path, map_location=self.device)

        if model_type == 'ensemble':
            self.model = EnsembleModel()
        else:
            self.model = MentalHealthBiLSTM()

        self.model.load_state_dict(checkpoint)
        self.model = self.model.to(self.device)
        self.model.eval()

        # Load scaler
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)

        # Load label encoder
        with open(label_encoder_path, 'rb') as f:
            self.label_encoder = pickle.load(f)

        # Feature extractor
        self.feature_extractor = FeatureExtractor(sr=16000)

        # Label mapping
        self.label_map = {i: label for i, label in enumerate(self.label_encoder.classes_)}
        self.mental_health_classes = list(self.label_encoder.classes_)

    def extract_features_from_audio(self, audio_path_or_array, sr=16000):
        """
        Extract features from audio file or numpy array.

        Args:
            audio_path_or_array: Path to audio file or numpy array
            sr: Sample rate

        Returns:
            Dict with extracted features
        """
        # Load audio if path provided
        if isinstance(audio_path_or_array, (str, Path)):
            audio, sr = librosa.load(audio_path_or_array, sr=sr, mono=True)
        else:
            audio = audio_path_or_array

        # Extract features
        features = self.feature_extractor.extract_all_features(audio, sr=sr)

        return features

    def predict(self, features_or_audio, return_attention=False):
        """
        Predict mental health biomarkers from a single sample.

        Args:
            features_or_audio: Dict of features or audio path/array
            return_attention: Whether to return attention weights

        Returns:
            Dict with predictions:
            {
                'mental_health_class': str,  # 'normal', 'anxiety', 'depression', 'stress'
                'confidence': float,  # 0-1
                'depression_score': float,  # 0-100
                'anxiety_score': float,  # 0-100
                'stress_score': float,  # 0-100
                'emotional_stability_score': float,  # 0-100
                'class_probabilities': dict,
                'attention_weights': array (optional)
            }
        """
        # Extract features if audio provided
        if isinstance(features_or_audio, dict):
            features = features_or_audio
        else:
            features = self.extract_features_from_audio(features_or_audio)

        # Convert to DataFrame row for compatibility with pipeline
        import pandas as pd
        features_df = pd.DataFrame([features])

        # Get feature columns in same order as training
        feature_cols = [col for col in features_df.columns
                       if col in self.scaler.get_feature_names_out()]

        X = features_df[feature_cols].values
        X = np.nan_to_num(X, nan=0.0)

        # Scale features
        X_scaled = self.scaler.transform(X)

        # Create sequence (repeat sample to fill sequence length)
        X_seq = np.repeat(X_scaled, self.seq_length, axis=0).reshape(
            1, self.seq_length, X_scaled.shape[1]
        ).astype(np.float32)

        # Inference
        with torch.no_grad():
            X_tensor = torch.from_numpy(X_seq).to(self.device)
            outputs = self.model(X_tensor)

            logits = outputs['logits'].cpu().numpy()[0]
            probs = torch.softmax(outputs['logits'], dim=1).cpu().numpy()[0]

            depression = float(outputs['depression_score'].cpu().numpy()[0, 0])
            anxiety = float(outputs['anxiety_score'].cpu().numpy()[0, 0])
            stress = float(outputs['stress_score'].cpu().numpy()[0, 0])
            stability = float(outputs['stability_score'].cpu().numpy()[0, 0])

            attention = None
            if return_attention and outputs['attention_weights'] is not None:
                attention = outputs['attention_weights'].cpu().numpy()

        # Get predicted class
        pred_class_idx = np.argmax(probs)
        pred_class = self.label_map[pred_class_idx]
        confidence = float(probs[pred_class_idx])

        result = {
            'mental_health_class': pred_class,
            'confidence': confidence,
            'depression_score': depression,
            'anxiety_score': anxiety,
            'stress_score': stress,
            'emotional_stability_score': stability,
            'class_probabilities': {
                self.label_map[i]: float(p) for i, p in enumerate(probs)
            }
        }

        if return_attention:
            result['attention_weights'] = attention

        return result

    def predict_batch(self, features_list, return_attention=False):
        """
        Predict for multiple samples.

        Args:
            features_list: List of feature dicts or audio paths
            return_attention: Whether to return attention weights

        Returns:
            List of prediction dicts
        """
        results = []

        for features_or_audio in features_list:
            result = self.predict(features_or_audio, return_attention=return_attention)
            results.append(result)

        return results

    def interpret_biomarkers(self, scores):
        """
        Interpret biomarker scores as clinical indicators.

        Args:
            scores: Dict with 'depression', 'anxiety', 'stress', 'stability' scores

        Returns:
            Dict with interpretation and recommendations
        """
        interpretation = {
            'primary_concerns': [],
            'risk_level': 'low',
            'recommendations': []
        }

        depression = scores.get('depression_score', 0)
        anxiety = scores.get('anxiety_score', 0)
        stress = scores.get('stress_score', 0)
        stability = scores.get('emotional_stability_score', 0)

        # Determine risk levels
        if depression > 60:
            interpretation['primary_concerns'].append('Depression')
            if depression > 75:
                interpretation['risk_level'] = 'high'
            elif depression > 50:
                interpretation['risk_level'] = 'moderate'

        if anxiety > 60:
            interpretation['primary_concerns'].append('Anxiety')
            if anxiety > 75:
                interpretation['risk_level'] = 'high'
            elif anxiety > 50:
                interpretation['risk_level'] = 'moderate'

        if stress > 65:
            interpretation['primary_concerns'].append('Stress')
            if stress > 75:
                interpretation['risk_level'] = 'high'
            elif stress > 50:
                interpretation['risk_level'] = 'moderate'

        if stability < 40:
            interpretation['primary_concerns'].append('Emotional Instability')
            if stability < 25:
                interpretation['risk_level'] = 'high'

        # Recommendations
        if not interpretation['primary_concerns']:
            interpretation['recommendations'].append('Voice profile within normal range')
            interpretation['recommendations'].append('Continue regular self-care practices')
        else:
            if 'Depression' in interpretation['primary_concerns']:
                interpretation['recommendations'].append(
                    'Consider consultation with mental health professional'
                )
                interpretation['recommendations'].append(
                    'Monitor mood and energy levels'
                )

            if 'Anxiety' in interpretation['primary_concerns']:
                interpretation['recommendations'].append(
                    'Explore relaxation and grounding techniques'
                )
                interpretation['recommendations'].append(
                    'Consider cognitive behavioral therapy'
                )

            if 'Stress' in interpretation['primary_concerns']:
                interpretation['recommendations'].append(
                    'Increase stress management activities'
                )
                interpretation['recommendations'].append(
                    'Ensure adequate rest and recovery'
                )

        return interpretation

    def get_model_info(self):
        """Return model metadata."""
        return {
            'model_type': self.model_type,
            'device': str(self.device),
            'mental_health_classes': self.mental_health_classes,
            'feature_count': len(self.scaler.get_feature_names_out()),
            'sequence_length': self.seq_length
        }


if __name__ == "__main__":
    # Example usage
    wrapper = InferenceWrapper(
        model_path='./models/bilstm_best.pth',
        scaler_path='./models/scaler.pkl',
        label_encoder_path='./models/label_encoder.pkl',
        model_type='bilstm',
        device='cpu'
    )

    # Single prediction from audio file
    result = wrapper.predict('./sample_audio.wav')
    print("Prediction result:")
    print(result)

    # Interpretation
    interpretation = wrapper.interpret_biomarkers(result)
    print("\nInterpretation:")
    print(interpretation)
