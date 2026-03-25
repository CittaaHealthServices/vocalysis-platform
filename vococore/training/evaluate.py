"""
Evaluation Script for Vocalysis Platform 2.0
Comprehensive model evaluation with metrics, plots, and detailed analysis
"""

import os
import sys
import json
import pickle
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve,
    auc, precision_recall_curve
)
from torch.utils.data import DataLoader, TensorDataset
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))

from models.bilstm_model import MentalHealthBiLSTM, EnsembleModel


class ModelEvaluator:
    def __init__(self, model_path, scaler_path, label_encoder_path, device='cpu'):
        self.device = device

        # Load model
        checkpoint = torch.load(model_path, map_location=device)
        # Infer model type and create
        # For now, assume BiLSTM
        self.model = MentalHealthBiLSTM()
        self.model.load_state_dict(checkpoint)
        self.model = self.model.to(device)
        self.model.eval()

        # Load scaler
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)

        # Load label encoder
        with open(label_encoder_path, 'rb') as f:
            self.label_encoder = pickle.load(f)

    def evaluate(self, test_loader):
        """
        Evaluate model on test set.

        Returns:
            Dict with comprehensive metrics
        """
        all_preds = []
        all_targets = []
        all_probs = []
        all_scores = {
            'depression': [], 'anxiety': [], 'stress': [], 'stability': []
        }
        all_attention_weights = []

        with torch.no_grad():
            for batch_x, batch_y in tqdm(test_loader, desc="Evaluating"):
                batch_x = batch_x.to(self.device)

                outputs = self.model(batch_x)
                logits = outputs['logits']

                # Predictions
                preds = torch.argmax(logits, dim=1)
                probs = torch.softmax(logits, dim=1)

                all_preds.append(preds.cpu().numpy())
                all_targets.append(batch_y.numpy())
                all_probs.append(probs.cpu().numpy())

                # Biomarker scores
                all_scores['depression'].append(outputs['depression_score'].cpu().numpy())
                all_scores['anxiety'].append(outputs['anxiety_score'].cpu().numpy())
                all_scores['stress'].append(outputs['stress_score'].cpu().numpy())
                all_scores['stability'].append(outputs['stability_score'].cpu().numpy())

                # Attention weights for interpretation
                if outputs['attention_weights'] is not None:
                    all_attention_weights.append(outputs['attention_weights'].cpu().numpy())

        all_preds = np.concatenate(all_preds)
        all_targets = np.concatenate(all_targets)
        all_probs = np.concatenate(all_probs)

        for key in all_scores:
            all_scores[key] = np.concatenate(all_scores[key]).flatten()

        if all_attention_weights:
            all_attention_weights = np.concatenate(all_attention_weights)
        else:
            all_attention_weights = None

        # Calculate metrics
        metrics = self._calculate_metrics(all_preds, all_targets, all_probs)

        return {
            'predictions': all_preds,
            'targets': all_targets,
            'probabilities': all_probs,
            'scores': all_scores,
            'attention_weights': all_attention_weights,
            'metrics': metrics
        }

    def _calculate_metrics(self, preds, targets, probs):
        """Calculate comprehensive metrics."""
        metrics = {
            'accuracy': accuracy_score(targets, preds),
            'precision_weighted': precision_score(targets, preds, average='weighted', zero_division=0),
            'recall_weighted': recall_score(targets, preds, average='weighted', zero_division=0),
            'f1_weighted': f1_score(targets, preds, average='weighted', zero_division=0),
            'confusion_matrix': confusion_matrix(targets, preds).tolist(),
            'per_class': {}
        }

        # Per-class metrics
        for i, label in enumerate(self.label_encoder.classes_):
            binary_targets = (targets == i).astype(int)
            binary_preds = (preds == i).astype(int)

            metrics['per_class'][label] = {
                'precision': precision_score(binary_targets, binary_preds, zero_division=0),
                'recall': recall_score(binary_targets, binary_preds, zero_division=0),
                'f1': f1_score(binary_targets, binary_preds, zero_division=0),
                'support': int(np.sum(binary_targets))
            }

            # ROC-AUC
            if len(np.unique(binary_targets)) > 1:
                try:
                    roc_auc = roc_auc_score(binary_targets, probs[:, i])
                    metrics['per_class'][label]['roc_auc'] = roc_auc
                except:
                    metrics['per_class'][label]['roc_auc'] = None

        return metrics

    def plot_confusion_matrix(self, targets, preds, output_path=None):
        """Plot confusion matrix."""
        cm = confusion_matrix(targets, preds)

        plt.figure(figsize=(10, 8))
        sns.heatmap(
            cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=self.label_encoder.classes_,
            yticklabels=self.label_encoder.classes_
        )
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()

        if output_path:
            plt.savefig(output_path)
            print(f"Confusion matrix saved to {output_path}")

        return cm

    def plot_roc_curves(self, targets, probs, output_path=None):
        """Plot ROC curves for each class."""
        n_classes = len(self.label_encoder.classes_)

        fig, axes = plt.subplots(1, n_classes, figsize=(6 * n_classes, 5))
        if n_classes == 1:
            axes = [axes]

        for i, label in enumerate(self.label_encoder.classes_):
            binary_targets = (targets == i).astype(int)

            fpr, tpr, _ = roc_curve(binary_targets, probs[:, i])
            roc_auc = auc(fpr, tpr)

            axes[i].plot(fpr, tpr, lw=2, label=f'ROC (AUC = {roc_auc:.3f})')
            axes[i].plot([0, 1], [0, 1], 'k--', lw=2, label='Random')
            axes[i].set_xlabel('False Positive Rate')
            axes[i].set_ylabel('True Positive Rate')
            axes[i].set_title(f'{label} vs. Rest')
            axes[i].legend()
            axes[i].grid(True, alpha=0.3)

        plt.tight_layout()

        if output_path:
            plt.savefig(output_path)
            print(f"ROC curves saved to {output_path}")

    def plot_score_distributions(self, scores, output_path=None):
        """Plot distributions of biomarker scores."""
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        axes = axes.flatten()

        for idx, (key, values) in enumerate(scores.items()):
            axes[idx].hist(values, bins=30, edgecolor='black', alpha=0.7)
            axes[idx].set_xlabel('Score (0-100)')
            axes[idx].set_ylabel('Frequency')
            axes[idx].set_title(f'{key.capitalize()} Score Distribution')
            axes[idx].grid(True, alpha=0.3)

        plt.tight_layout()

        if output_path:
            plt.savefig(output_path)
            print(f"Score distributions saved to {output_path}")

    def plot_feature_importance(self, attention_weights, output_path=None):
        """Plot feature importance from attention weights."""
        if attention_weights is None or len(attention_weights) == 0:
            print("No attention weights available")
            return

        # Average attention across all samples
        avg_attention = np.mean(attention_weights, axis=0).flatten()

        plt.figure(figsize=(12, 6))
        plt.bar(range(len(avg_attention)), avg_attention)
        plt.xlabel('Time Step')
        plt.ylabel('Average Attention Weight')
        plt.title('Feature Importance (from Attention)')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()

        if output_path:
            plt.savefig(output_path)
            print(f"Feature importance plot saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate Vocalysis models")

    parser.add_argument('--model-path', type=str, required=True,
                       help='Path to trained model')
    parser.add_argument('--scaler-path', type=str, required=True,
                       help='Path to fitted scaler')
    parser.add_argument('--encoder-path', type=str, required=True,
                       help='Path to label encoder')
    parser.add_argument('--test-features', type=str, required=True,
                       help='Path to test features CSV')
    parser.add_argument('--output-dir', type=str, default='./evaluation',
                       help='Output directory for results')
    parser.add_argument('--batch-size', type=int, default=32)

    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load test features
    print("\nLoading test features...")
    test_features = pd.read_csv(args.test_features)

    # Initialize evaluator
    evaluator = ModelEvaluator(
        model_path=args.model_path,
        scaler_path=args.scaler_path,
        label_encoder_path=args.encoder_path,
        device=device
    )

    # Prepare test data
    feature_cols = [col for col in test_features.columns
                   if col not in ['file_path', 'mental_health_label', 'dataset', 'status']]

    X_test = test_features[feature_cols].values
    X_test = np.nan_to_num(X_test, nan=0.0)
    X_test = evaluator.scaler.transform(X_test)

    y_test = evaluator.label_encoder.transform(test_features['mental_health_label'].values)

    # Create sequences
    seq_length = 50
    X_seq = []
    y_seq = []

    for i in range(0, len(X_test) - seq_length + 1, 1):
        X_seq.append(X_test[i:i + seq_length])
        y_seq.append(y_test[i + seq_length - 1])

    X_seq = np.array(X_seq, dtype=np.float32)
    y_seq = np.array(y_seq, dtype=np.int64)

    # DataLoader
    test_dataset = TensorDataset(
        torch.from_numpy(X_seq),
        torch.from_numpy(y_seq)
    )
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    # Evaluate
    print("\nEvaluating model...")
    results = evaluator.evaluate(test_loader)

    # Print metrics
    print("\n" + "=" * 70)
    print("Evaluation Results")
    print("=" * 70)

    metrics = results['metrics']
    print(f"\nAccuracy:  {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision_weighted']:.4f}")
    print(f"Recall:    {metrics['recall_weighted']:.4f}")
    print(f"F1 Score:  {metrics['f1_weighted']:.4f}")

    print("\nPer-class metrics:")
    for class_name, class_metrics in metrics['per_class'].items():
        print(f"\n  {class_name}:")
        print(f"    Precision: {class_metrics['precision']:.4f}")
        print(f"    Recall:    {class_metrics['recall']:.4f}")
        print(f"    F1 Score:  {class_metrics['f1']:.4f}")
        print(f"    Support:   {class_metrics['support']}")
        if class_metrics.get('roc_auc'):
            print(f"    ROC-AUC:   {class_metrics['roc_auc']:.4f}")

    # Generate plots
    print("\nGenerating plots...")

    evaluator.plot_confusion_matrix(
        results['targets'],
        results['predictions'],
        output_path=output_dir / "confusion_matrix.png"
    )

    evaluator.plot_roc_curves(
        results['targets'],
        results['probabilities'],
        output_path=output_dir / "roc_curves.png"
    )

    evaluator.plot_score_distributions(
        results['scores'],
        output_path=output_dir / "score_distributions.png"
    )

    evaluator.plot_feature_importance(
        results['attention_weights'],
        output_path=output_dir / "feature_importance.png"
    )

    # Save report
    report = {
        'model_path': str(args.model_path),
        'accuracy': float(metrics['accuracy']),
        'precision_weighted': float(metrics['precision_weighted']),
        'recall_weighted': float(metrics['recall_weighted']),
        'f1_weighted': float(metrics['f1_weighted']),
        'num_samples': int(len(results['targets'])),
        'per_class': metrics['per_class']
    }

    report_path = output_dir / "evaluation_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nEvaluation complete! Results saved to {output_dir}")


if __name__ == "__main__":
    main()
