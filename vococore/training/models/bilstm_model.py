"""
BiLSTM + Attention Model for Mental Health Voice Biomarker Analysis
Vocalysis Platform 2.0
"""

import torch
import torch.nn as nn
import numpy as np


class AttentionLayer(nn.Module):
    """Attention mechanism for BiLSTM output."""

    def __init__(self, hidden_size):
        super(AttentionLayer, self).__init__()
        self.attention = nn.Linear(hidden_size * 2, 1)

    def forward(self, lstm_output):
        """
        Apply attention to LSTM output.

        Args:
            lstm_output: (batch_size, seq_len, hidden_size * 2)

        Returns:
            context: (batch_size, hidden_size * 2)
            weights: (batch_size, seq_len, 1)
        """
        # Calculate attention scores
        scores = self.attention(lstm_output)  # (batch, seq_len, 1)

        # Apply softmax across sequence dimension
        weights = torch.softmax(scores, dim=1)  # (batch, seq_len, 1)

        # Compute weighted sum
        context = torch.sum(weights * lstm_output, dim=1)  # (batch, hidden*2)

        return context, weights


class MentalHealthBiLSTM(nn.Module):
    """
    Bidirectional LSTM with Attention for mental health classification from voice features.

    Processes 50+ voice biomarkers to predict mental health dimensions:
    - Depression risk
    - Anxiety risk
    - Stress level
    - Emotional stability
    """

    def __init__(
        self,
        input_size=56,
        hidden_size=128,
        num_layers=3,
        num_classes=4,
        dropout=0.3,
        num_heads=4
    ):
        super(MentalHealthBiLSTM, self).__init__()

        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes

        # Input normalization
        self.batch_norm_input = nn.BatchNorm1d(input_size)

        # BiLSTM layers with residual connections
        self.bilstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0
        )

        # Attention mechanism
        self.attention = AttentionLayer(hidden_size)

        # Classifier head (categorical mental health state)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * 2, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(128, num_classes)
        )

        # Regression heads for continuous dimensions (0-100 scale)
        # These enable fine-grained assessment within each category

        self.depression_head = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()  # Output in [0, 1], will scale to [0, 100]
        )

        self.anxiety_head = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

        self.stress_head = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

        self.stability_head = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        """
        Forward pass.

        Args:
            x: (batch_size, seq_len, input_size)

        Returns:
            Dict with:
            - logits: (batch, num_classes) for classification
            - depression_score: (batch, 1) in range [0, 100]
            - anxiety_score: (batch, 1) in range [0, 100]
            - stress_score: (batch, 1) in range [0, 100]
            - stability_score: (batch, 1) in range [0, 100]
            - attention_weights: (batch, seq_len, 1) attention visualization
        """
        batch_size = x.shape[0]
        seq_len = x.shape[1]

        # Normalize features per time step
        x_reshaped = x.reshape(-1, x.shape[-1])
        x_norm = self.batch_norm_input(x_reshaped).reshape(batch_size, seq_len, -1)

        # BiLSTM forward pass
        lstm_out, (hidden, cell) = self.bilstm(x_norm)
        # lstm_out: (batch, seq_len, hidden*2)

        # Apply attention
        context, attention_weights = self.attention(lstm_out)
        # context: (batch, hidden*2)

        # Classification head
        logits = self.classifier(context)  # (batch, num_classes)

        # Continuous score heads (scaled to 0-100)
        depression = self.depression_head(context) * 100  # (batch, 1)
        anxiety = self.anxiety_head(context) * 100
        stress = self.stress_head(context) * 100
        stability = self.stability_head(context) * 100  # Inverse of instability

        return {
            'logits': logits,
            'depression_score': depression,
            'anxiety_score': anxiety,
            'stress_score': stress,
            'stability_score': stability,
            'attention_weights': attention_weights
        }

    def get_attention_visualization(self):
        """Get last attention weights for visualization."""
        return self.attention


class MentalHealthCNN(nn.Module):
    """
    1D CNN for voice feature classification.
    Used as ensemble member alongside BiLSTM.
    """

    def __init__(self, input_size=56, num_classes=4, dropout=0.3):
        super(MentalHealthCNN, self).__init__()

        self.input_size = input_size
        self.num_classes = num_classes

        # Input normalization
        self.batch_norm_input = nn.BatchNorm1d(input_size)

        # Conv blocks
        self.conv_blocks = nn.Sequential(
            # Block 1
            nn.Conv1d(input_size, 64, kernel_size=3, padding=1),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Dropout(dropout),

            # Block 2
            nn.Conv1d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Dropout(dropout),

            # Block 3
            nn.Conv1d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Dropout(dropout),

            # Block 4
            nn.Conv1d(256, 256, kernel_size=3, padding=1),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1)
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes)
        )

        # Score heads
        self.depression_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

        self.anxiety_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

        self.stress_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

        self.stability_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        """
        Forward pass for CNN.

        Args:
            x: (batch_size, seq_len, input_size)

        Returns:
            Dict with logits and scores (same format as BiLSTM)
        """
        batch_size = x.shape[0]

        # Transpose for Conv1d: (batch, channels, length)
        x = x.transpose(1, 2)  # (batch, input_size, seq_len)

        # Normalize input
        x_norm = self.batch_norm_input(x.reshape(batch_size * x.shape[2], -1)).reshape(
            batch_size, x.shape[1], x.shape[2]
        )

        # Conv blocks
        conv_out = self.conv_blocks(x_norm)  # (batch, 256, 1)
        conv_out = conv_out.squeeze(-1)  # (batch, 256)

        # Classification
        logits = self.classifier(conv_out)

        # Scores
        depression = self.depression_head(conv_out) * 100
        anxiety = self.anxiety_head(conv_out) * 100
        stress = self.stress_head(conv_out) * 100
        stability = self.stability_head(conv_out) * 100

        return {
            'logits': logits,
            'depression_score': depression,
            'anxiety_score': anxiety,
            'stress_score': stress,
            'stability_score': stability,
            'attention_weights': None  # CNN doesn't have attention
        }


class MentalHealthMLP(nn.Module):
    """
    Multi-layer Perceptron for voice feature classification.
    Used as ensemble member alongside BiLSTM and CNN.
    Directly processes statistical features.
    """

    def __init__(self, input_size=56, seq_length=50, num_classes=4, dropout=0.3):
        super(MentalHealthMLP, self).__init__()

        self.input_size = input_size
        self.seq_length = seq_length
        self.num_classes = num_classes

        # Flatten sequence to feature vector
        flattened_size = input_size * seq_length

        # Input normalization
        self.batch_norm_input = nn.BatchNorm1d(flattened_size)

        # Feature extraction layers
        self.feature_layers = nn.Sequential(
            nn.Linear(flattened_size, 512),
            nn.LayerNorm(512),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(512, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(dropout / 2)
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(64, num_classes)
        )

        # Score heads
        self.depression_head = nn.Sequential(
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

        self.anxiety_head = nn.Sequential(
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

        self.stress_head = nn.Sequential(
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

        self.stability_head = nn.Sequential(
            nn.Linear(128, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        """
        Forward pass for MLP.

        Args:
            x: (batch_size, seq_len, input_size)

        Returns:
            Dict with logits and scores
        """
        batch_size = x.shape[0]

        # Flatten
        x_flat = x.reshape(batch_size, -1)  # (batch, input_size * seq_len)

        # Normalize
        x_norm = self.batch_norm_input(x_flat)

        # Feature extraction
        features = self.feature_layers(x_norm)  # (batch, 128)

        # Classification
        logits = self.classifier(features)

        # Scores
        depression = self.depression_head(features) * 100
        anxiety = self.anxiety_head(features) * 100
        stress = self.stress_head(features) * 100
        stability = self.stability_head(features) * 100

        return {
            'logits': logits,
            'depression_score': depression,
            'anxiety_score': anxiety,
            'stress_score': stress,
            'stability_score': stability,
            'attention_weights': None
        }


class EnsembleModel(nn.Module):
    """
    Ensemble combining BiLSTM, CNN, and MLP for robust predictions.

    Ensemble strategy:
    - BiLSTM (40% weight): Captures sequential patterns in voice features
    - CNN (35% weight): Sensitive to spectral/temporal patterns
    - MLP (25% weight): Statistical feature relationships
    """

    def __init__(
        self,
        input_size=56,
        hidden_size=128,
        num_layers=3,
        num_classes=4,
        seq_length=50,
        dropout=0.3
    ):
        super(EnsembleModel, self).__init__()

        self.bilstm = MentalHealthBiLSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            num_classes=num_classes,
            dropout=dropout
        )

        self.cnn = MentalHealthCNN(
            input_size=input_size,
            num_classes=num_classes,
            dropout=dropout
        )

        self.mlp = MentalHealthMLP(
            input_size=input_size,
            seq_length=seq_length,
            num_classes=num_classes,
            dropout=dropout
        )

        # Ensemble weights
        self.bilstm_weight = nn.Parameter(torch.tensor(0.40))
        self.cnn_weight = nn.Parameter(torch.tensor(0.35))
        self.mlp_weight = nn.Parameter(torch.tensor(0.25))

    def forward(self, x):
        """
        Ensemble forward pass with weighted averaging.

        Args:
            x: (batch_size, seq_len, input_size)

        Returns:
            Ensemble predictions
        """
        # Get predictions from each model
        bilstm_out = self.bilstm(x)
        cnn_out = self.cnn(x)
        mlp_out = self.mlp(x)

        # Normalize weights
        weights_sum = self.bilstm_weight + self.cnn_weight + self.mlp_weight
        w_bilstm = self.bilstm_weight / weights_sum
        w_cnn = self.cnn_weight / weights_sum
        w_mlp = self.mlp_weight / weights_sum

        # Weighted average of logits
        ensemble_logits = (
            w_bilstm * bilstm_out['logits'] +
            w_cnn * cnn_out['logits'] +
            w_mlp * mlp_out['logits']
        )

        # Weighted average of scores
        ensemble_depression = (
            w_bilstm * bilstm_out['depression_score'] +
            w_cnn * cnn_out['depression_score'] +
            w_mlp * mlp_out['depression_score']
        )

        ensemble_anxiety = (
            w_bilstm * bilstm_out['anxiety_score'] +
            w_cnn * cnn_out['anxiety_score'] +
            w_mlp * mlp_out['anxiety_score']
        )

        ensemble_stress = (
            w_bilstm * bilstm_out['stress_score'] +
            w_cnn * cnn_out['stress_score'] +
            w_mlp * mlp_out['stress_score']
        )

        ensemble_stability = (
            w_bilstm * bilstm_out['stability_score'] +
            w_cnn * cnn_out['stability_score'] +
            w_mlp * mlp_out['stability_score']
        )

        return {
            'logits': ensemble_logits,
            'depression_score': ensemble_depression,
            'anxiety_score': ensemble_anxiety,
            'stress_score': ensemble_stress,
            'stability_score': ensemble_stability,
            'individual_predictions': {
                'bilstm': bilstm_out,
                'cnn': cnn_out,
                'mlp': mlp_out
            }
        }

    def get_weights(self):
        """Get ensemble member weights."""
        weights_sum = self.bilstm_weight + self.cnn_weight + self.mlp_weight
        return {
            'bilstm': (self.bilstm_weight / weights_sum).item(),
            'cnn': (self.cnn_weight / weights_sum).item(),
            'mlp': (self.mlp_weight / weights_sum).item()
        }


if __name__ == "__main__":
    # Test models
    batch_size = 4
    seq_len = 50
    input_size = 56
    num_classes = 4

    x = torch.randn(batch_size, seq_len, input_size)

    # Test BiLSTM
    bilstm = MentalHealthBiLSTM(input_size=input_size, num_classes=num_classes)
    out = bilstm(x)
    print("BiLSTM output shapes:")
    print(f"  logits: {out['logits'].shape}")
    print(f"  depression_score: {out['depression_score'].shape}")
    print(f"  attention_weights: {out['attention_weights'].shape}")

    # Test Ensemble
    ensemble = EnsembleModel(input_size=input_size, num_classes=num_classes)
    out = ensemble(x)
    print("\nEnsemble output shapes:")
    print(f"  logits: {out['logits'].shape}")
    print(f"  weights: {ensemble.get_weights()}")
