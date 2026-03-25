"""
Vocalysis Platform 2.0 - ML Training Pipeline
Mental health voice biomarker analysis using BiLSTM + Ensemble models
"""

__version__ = "2.0.0"
__author__ = "Cittaa Intelligence"

from .datasets.dataset_registry import DATASET_REGISTRY, MENTAL_HEALTH_LABEL_MAP
from .features.feature_pipeline import FeaturePipeline, FeatureExtractor
from .models.bilstm_model import MentalHealthBiLSTM, EnsembleModel
from .inference_wrapper import InferenceWrapper

__all__ = [
    'DATASET_REGISTRY',
    'MENTAL_HEALTH_LABEL_MAP',
    'FeaturePipeline',
    'FeatureExtractor',
    'MentalHealthBiLSTM',
    'EnsembleModel',
    'InferenceWrapper'
]
