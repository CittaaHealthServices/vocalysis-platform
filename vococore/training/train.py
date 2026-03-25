"""
Complete Training Pipeline for Vocalysis Platform 2.0
BiLSTM + Ensemble model for mental health voice biomarker analysis
"""

import os
import sys
import argparse
import pickle
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import KFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve
)
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns
from torch.utils.tensorboard import SummaryWriter

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from datasets.downloader import DatasetDownloader
from datasets.preprocessor import DatasetPreprocessor, create_train_test_split
from features.feature_pipeline import FeaturePipeline
from models.bilstm_model import MentalHealthBiLSTM, EnsembleModel

warnings.filterwarnings('ignore')


class FocalLoss(nn.Module):
    """Focal Loss for handling class imbalance."""

    def __init__(self, alpha=None, gamma=2.0, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = nn.functional.cross_entropy(inputs, targets, reduction='none')
        p_t = torch.exp(-ce_loss)
        focal_loss = (1 - p_t) ** self.gamma * ce_loss

        if self.alpha is not None:
            if isinstance(self.alpha, (float, int)):
                focal_loss = self.alpha * focal_loss
            else:
                focal_loss = self.alpha[targets] * focal_loss

        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss


class VocalisysTrainer:
    def __init__(
        self,
        model,
        device,
        output_dir="./models",
        log_dir="./logs",
        model_name="bilstm"
    ):
        self.model = model
        self.device = device
        self.output_dir = Path(output_dir)
        self.log_dir = Path(log_dir)
        self.model_name = model_name

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self.best_val_f1 = 0.0
        self.best_model_path = None
        self.training_history = {
            'train_loss': [], 'val_loss': [],
            'train_acc': [], 'val_acc': [],
            'train_f1': [], 'val_f1': []
        }

    def train_epoch(self, train_loader, optimizer, criterion):
        """Train one epoch."""
        self.model.train()
        total_loss = 0.0
        all_preds = []
        all_targets = []

        for batch_x, batch_y in tqdm(train_loader, desc="Training", leave=False):
            batch_x = batch_x.to(self.device)
            batch_y = batch_y.to(self.device)

            optimizer.zero_grad()

            outputs = self.model(batch_x)
            logits = outputs['logits']

            loss = criterion(logits, batch_y)

            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            optimizer.step()

            total_loss += loss.item()
            all_preds.append(torch.argmax(logits, dim=1).detach().cpu().numpy())
            all_targets.append(batch_y.detach().cpu().numpy())

        avg_loss = total_loss / len(train_loader)
        all_preds = np.concatenate(all_preds)
        all_targets = np.concatenate(all_targets)

        accuracy = accuracy_score(all_targets, all_preds)
        f1 = f1_score(all_targets, all_preds, average='weighted', zero_division=0)

        return avg_loss, accuracy, f1

    def validate(self, val_loader, criterion):
        """Validate on validation set."""
        self.model.eval()
        total_loss = 0.0
        all_preds = []
        all_targets = []

        with torch.no_grad():
            for batch_x, batch_y in tqdm(val_loader, desc="Validation", leave=False):
                batch_x = batch_x.to(self.device)
                batch_y = batch_y.to(self.device)

                outputs = self.model(batch_x)
                logits = outputs['logits']

                loss = criterion(logits, batch_y)
                total_loss += loss.item()

                all_preds.append(torch.argmax(logits, dim=1).detach().cpu().numpy())
                all_targets.append(batch_y.detach().cpu().numpy())

        avg_loss = total_loss / len(val_loader)
        all_preds = np.concatenate(all_preds)
        all_targets = np.concatenate(all_targets)

        accuracy = accuracy_score(all_targets, all_preds)
        f1 = f1_score(all_targets, all_preds, average='weighted', zero_division=0)

        return avg_loss, accuracy, f1, all_preds, all_targets

    def train(self, train_loader, val_loader, num_epochs=50, lr=1e-4, patience=10):
        """
        Full training loop with early stopping.

        Args:
            train_loader: DataLoader for training
            val_loader: DataLoader for validation
            num_epochs: Maximum epochs
            lr: Learning rate
            patience: Early stopping patience
        """
        print("\n" + "=" * 70)
        print(f"Training {self.model_name.upper()} Model")
        print("=" * 70)

        optimizer = optim.AdamW(
            self.model.parameters(),
            lr=lr,
            weight_decay=1e-4
        )

        # Focal loss for class imbalance
        criterion = FocalLoss(gamma=2.0)

        # Learning rate scheduler
        scheduler = optim.lr_scheduler.OneCycleLR(
            optimizer,
            max_lr=lr,
            total_steps=num_epochs * len(train_loader),
            pct_start=0.3,
            anneal_strategy='cos'
        )

        patience_counter = 0

        for epoch in range(num_epochs):
            train_loss, train_acc, train_f1 = self.train_epoch(
                train_loader, optimizer, criterion
            )

            val_loss, val_acc, val_f1, val_preds, val_targets = self.validate(
                val_loader, criterion
            )

            scheduler.step()

            # Record history
            self.training_history['train_loss'].append(train_loss)
            self.training_history['val_loss'].append(val_loss)
            self.training_history['train_acc'].append(train_acc)
            self.training_history['val_acc'].append(val_acc)
            self.training_history['train_f1'].append(train_f1)
            self.training_history['val_f1'].append(val_f1)

            print(f"Epoch {epoch + 1}/{num_epochs}")
            print(f"  Train Loss: {train_loss:.4f} | Acc: {train_acc:.4f} | F1: {train_f1:.4f}")
            print(f"  Val Loss:   {val_loss:.4f} | Acc: {val_acc:.4f} | F1: {val_f1:.4f}")

            # Early stopping
            if val_f1 > self.best_val_f1:
                self.best_val_f1 = val_f1
                patience_counter = 0

                # Save best model
                self.best_model_path = self.output_dir / f"{self.model_name}_best.pth"
                torch.save(self.model.state_dict(), self.best_model_path)
                print(f"  -> Best model saved (F1: {val_f1:.4f})")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"\nEarly stopping triggered after {patience} epochs without improvement")
                    break

        # Load best model
        if self.best_model_path and self.best_model_path.exists():
            self.model.load_state_dict(torch.load(self.best_model_path))

        return self.training_history

    def test(self, test_loader, label_encoder):
        """Evaluate on test set."""
        print("\n" + "=" * 70)
        print("Test Set Evaluation")
        print("=" * 70)

        self.model.eval()
        all_preds = []
        all_targets = []
        all_scores = {
            'depression': [], 'anxiety': [], 'stress': [], 'stability': []
        }

        with torch.no_grad():
            for batch_x, batch_y in tqdm(test_loader, desc="Testing"):
                batch_x = batch_x.to(self.device)

                outputs = self.model(batch_x)
                logits = outputs['logits']

                all_preds.append(torch.argmax(logits, dim=1).detach().cpu().numpy())
                all_targets.append(batch_y.detach().cpu().numpy())

                all_scores['depression'].append(outputs['depression_score'].detach().cpu().numpy())
                all_scores['anxiety'].append(outputs['anxiety_score'].detach().cpu().numpy())
                all_scores['stress'].append(outputs['stress_score'].detach().cpu().numpy())
                all_scores['stability'].append(outputs['stability_score'].detach().cpu().numpy())

        all_preds = np.concatenate(all_preds)
        all_targets = np.concatenate(all_targets)

        for key in all_scores:
            all_scores[key] = np.concatenate(all_scores[key]).flatten()

        # Metrics
        accuracy = accuracy_score(all_targets, all_preds)
        precision = precision_score(all_targets, all_preds, average='weighted', zero_division=0)
        recall = recall_score(all_targets, all_preds, average='weighted', zero_division=0)
        f1 = f1_score(all_targets, all_preds, average='weighted', zero_division=0)

        print(f"\nAccuracy:  {accuracy:.4f}")
        print(f"Precision: {precision:.4f}")
        print(f"Recall:    {recall:.4f}")
        print(f"F1 Score:  {f1:.4f}")

        print("\nPer-class F1 scores:")
        for i, label in enumerate(label_encoder.classes_):
            class_f1 = f1_score(all_targets, all_preds, labels=[i], zero_division=0)
            print(f"  {label}: {class_f1:.4f}")

        # Confusion matrix
        cm = confusion_matrix(all_targets, all_preds)
        self._plot_confusion_matrix(cm, label_encoder.classes_)

        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'confusion_matrix': cm,
            'predictions': all_preds,
            'targets': all_targets,
            'scores': all_scores
        }

    def _plot_confusion_matrix(self, cm, labels):
        """Plot and save confusion matrix."""
        plt.figure(figsize=(10, 8))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels)
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()

        cm_path = self.output_dir / f"{self.model_name}_confusion_matrix.png"
        plt.savefig(cm_path)
        plt.close()
        print(f"Confusion matrix saved to {cm_path}")

    def plot_training_history(self):
        """Plot training history."""
        fig, axes = plt.subplots(1, 3, figsize=(15, 4))

        axes[0].plot(self.training_history['train_loss'], label='Train')
        axes[0].plot(self.training_history['val_loss'], label='Val')
        axes[0].set_xlabel('Epoch')
        axes[0].set_ylabel('Loss')
        axes[0].set_title('Training Loss')
        axes[0].legend()
        axes[0].grid(True)

        axes[1].plot(self.training_history['train_acc'], label='Train')
        axes[1].plot(self.training_history['val_acc'], label='Val')
        axes[1].set_xlabel('Epoch')
        axes[1].set_ylabel('Accuracy')
        axes[1].set_title('Accuracy')
        axes[1].legend()
        axes[1].grid(True)

        axes[2].plot(self.training_history['train_f1'], label='Train')
        axes[2].plot(self.training_history['val_f1'], label='Val')
        axes[2].set_xlabel('Epoch')
        axes[2].set_ylabel('F1 Score')
        axes[2].set_title('F1 Score')
        axes[2].legend()
        axes[2].grid(True)

        plt.tight_layout()
        hist_path = self.output_dir / f"{self.model_name}_training_history.png"
        plt.savefig(hist_path)
        plt.close()
        print(f"Training history saved to {hist_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Train BiLSTM ensemble for Vocalysis Platform 2.0"
    )

    parser.add_argument(
        '--datasets',
        type=str,
        default='RAVDESS,CREMAD,TESS,IEMOCAP_PROXY,DAIC_WOZ_PROXY',
        help='Comma-separated dataset names'
    )
    parser.add_argument('--data-dir', type=str, default='./data/raw',
                       help='Directory containing raw datasets')
    parser.add_argument('--output-dir', type=str, default='./models',
                       help='Directory for output models')
    parser.add_argument('--features-dir', type=str, default='./data/features',
                       help='Directory for cached features')
    parser.add_argument('--epochs', type=int, default=50, help='Number of epochs')
    parser.add_argument('--batch-size', type=int, default=32, help='Batch size')
    parser.add_argument('--lr', type=float, default=1e-4, help='Learning rate')
    parser.add_argument('--model', type=str, default='bilstm',
                       choices=['bilstm', 'ensemble'], help='Model type')
    parser.add_argument('--hidden-size', type=int, default=128, help='LSTM hidden size')
    parser.add_argument('--num-layers', type=int, default=3, help='Number of LSTM layers')
    parser.add_argument('--dropout', type=float, default=0.3, help='Dropout rate')
    parser.add_argument('--seq-length', type=int, default=50, help='Sequence length')
    parser.add_argument('--kfold', type=int, default=5, help='K-fold cross-validation')
    parser.add_argument('--skip-download', action='store_true',
                       help='Skip dataset download')
    parser.add_argument('--skip-features', action='store_true',
                       help='Skip feature extraction (use cached)')

    args = parser.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\nUsing device: {device}")

    # Step 1: Download datasets
    if not args.skip_download:
        print("\n" + "=" * 70)
        print("Step 1: Downloading Datasets")
        print("=" * 70)

        downloader = DatasetDownloader(data_dir=args.data_dir)
        datasets = args.datasets.split(',')
        downloader.download_all(datasets=datasets)

    # Step 2: Preprocess datasets
    print("\n" + "=" * 70)
    print("Step 2: Preprocessing Datasets")
    print("=" * 70)

    preprocessor = DatasetPreprocessor()

    data_dirs = {}
    for ds in args.datasets.split(','):
        data_dirs[ds.strip()] = Path(args.data_dir) / ds.lower().replace('_', '')

    unified_df = preprocessor.build_unified_dataset(data_dirs)
    balanced_df = preprocessor.balance_classes(unified_df, strategy='oversample')
    train_df, val_df, test_df = create_train_test_split(balanced_df)

    # Step 3: Extract features
    print("\n" + "=" * 70)
    print("Step 3: Feature Extraction")
    print("=" * 70)

    features_dir = Path(args.features_dir)
    features_dir.mkdir(parents=True, exist_ok=True)

    feature_pipeline = FeaturePipeline(sr=16000)

    train_features_path = features_dir / "train_features.csv"
    val_features_path = features_dir / "val_features.csv"
    test_features_path = features_dir / "test_features.csv"

    if not args.skip_features or not train_features_path.exists():
        train_features = feature_pipeline.extract_dataset_features(
            train_df, output_path=train_features_path, augment=True
        )
        val_features = feature_pipeline.extract_dataset_features(
            val_df, output_path=val_features_path, augment=False
        )
        test_features = feature_pipeline.extract_dataset_features(
            test_df, output_path=test_features_path, augment=False
        )
    else:
        print("Loading cached features...")
        train_features = pd.read_csv(train_features_path)
        val_features = pd.read_csv(val_features_path)
        test_features = pd.read_csv(test_features_path)

    # Fit scaler on training data
    feature_pipeline.fit_scaler(train_features)
    feature_pipeline.save_scaler(Path(args.output_dir) / "scaler.pkl")

    # Prepare sequences
    feature_cols = [col for col in train_features.columns
                   if col not in ['file_path', 'mental_health_label', 'dataset', 'status']]

    X_train, y_train, le = feature_pipeline.prepare_sequences(
        train_features, seq_length=args.seq_length
    )
    X_val, y_val, _ = feature_pipeline.prepare_sequences(
        val_features, seq_length=args.seq_length
    )
    X_test, y_test, _ = feature_pipeline.prepare_sequences(
        test_features, seq_length=args.seq_length
    )

    # Convert to tensors
    X_train_t = torch.from_numpy(X_train).float()
    y_train_t = torch.from_numpy(y_train).long()
    X_val_t = torch.from_numpy(X_val).float()
    y_val_t = torch.from_numpy(y_val).long()
    X_test_t = torch.from_numpy(X_test).float()
    y_test_t = torch.from_numpy(y_test).long()

    # DataLoaders
    train_dataset = TensorDataset(X_train_t, y_train_t)
    val_dataset = TensorDataset(X_val_t, y_val_t)
    test_dataset = TensorDataset(X_test_t, y_test_t)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    # Step 4: Train model
    print("\n" + "=" * 70)
    print("Step 4: Model Training")
    print("=" * 70)

    if args.model == 'bilstm':
        model = MentalHealthBiLSTM(
            input_size=X_train.shape[2],
            hidden_size=args.hidden_size,
            num_layers=args.num_layers,
            num_classes=len(le.classes_),
            dropout=args.dropout
        )
    elif args.model == 'ensemble':
        model = EnsembleModel(
            input_size=X_train.shape[2],
            hidden_size=args.hidden_size,
            num_layers=args.num_layers,
            num_classes=len(le.classes_),
            seq_length=args.seq_length,
            dropout=args.dropout
        )

    model = model.to(device)

    trainer = VocalisysTrainer(
        model=model,
        device=device,
        output_dir=args.output_dir,
        model_name=args.model
    )

    history = trainer.train(
        train_loader=train_loader,
        val_loader=val_loader,
        num_epochs=args.epochs,
        lr=args.lr,
        patience=10
    )

    trainer.plot_training_history()

    # Step 5: Evaluate
    print("\n" + "=" * 70)
    print("Step 5: Test Set Evaluation")
    print("=" * 70)

    results = trainer.test(test_loader, le)

    # Save label encoder
    with open(Path(args.output_dir) / "label_encoder.pkl", 'wb') as f:
        pickle.dump(le, f)

    # Save results
    results_path = Path(args.output_dir) / f"{args.model}_evaluation_report.json"
    import json
    report = {
        'model': args.model,
        'accuracy': float(results['accuracy']),
        'precision': float(results['precision']),
        'recall': float(results['recall']),
        'f1': float(results['f1']),
        'num_samples': len(y_test),
        'num_classes': len(le.classes_),
        'classes': list(le.classes_),
        'timestamp': datetime.now().isoformat()
    }

    with open(results_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nResults saved to {results_path}")
    print(f"Model saved to {trainer.best_model_path}")
    print(f"Scaler saved to {Path(args.output_dir) / 'scaler.pkl'}")
    print(f"Label encoder saved to {Path(args.output_dir) / 'label_encoder.pkl'}")


if __name__ == "__main__":
    main()
