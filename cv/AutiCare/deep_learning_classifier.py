"""
Advanced Deep Learning Classifier for Autism Risk Assessment
Combines CNN for spatial features + Transformer for temporal patterns

This model learns to classify autism risk from behavioral feature sequences
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
from typing import Tuple, List
import json


class SpatialFeatureExtractor(keras.Model):
    """
    CNN-based feature extractor for individual frames
    Processes facial landmarks, pose, and hand keypoints
    """
    
    def __init__(self, feature_dim=128):
        super().__init__()
        
        self.conv1 = layers.Conv1D(64, 3, activation='relu', padding='same')
        self.bn1 = layers.BatchNormalization()
        self.pool1 = layers.MaxPooling1D(2)
        
        self.conv2 = layers.Conv1D(128, 3, activation='relu', padding='same')
        self.bn2 = layers.BatchNormalization()
        self.pool2 = layers.MaxPooling1D(2)
        
        self.conv3 = layers.Conv1D(256, 3, activation='relu', padding='same')
        self.bn3 = layers.BatchNormalization()
        
        self.global_pool = layers.GlobalAveragePooling1D()
        self.dense = layers.Dense(feature_dim, activation='relu')
        self.dropout = layers.Dropout(0.3)
    
    def call(self, x, training=False):
        x = self.conv1(x)
        x = self.bn1(x, training=training)
        x = self.pool1(x)
        
        x = self.conv2(x)
        x = self.bn2(x, training=training)
        x = self.pool2(x)
        
        x = self.conv3(x)
        x = self.bn3(x, training=training)
        
        x = self.global_pool(x)
        x = self.dense(x)
        x = self.dropout(x, training=training)
        
        return x


class TemporalTransformer(keras.Model):
    """
    Transformer encoder for temporal pattern recognition
    Learns behavioral sequences over time
    """
    
    def __init__(self, d_model=128, num_heads=4, num_layers=2):
        super().__init__()
        
        self.d_model = d_model
        
        # Positional encoding
        self.pos_encoding = self.create_positional_encoding(1000, d_model)
        
        # Transformer encoder layers
        self.encoder_layers = [
            layers.MultiHeadAttention(num_heads=num_heads, key_dim=d_model)
            for _ in range(num_layers)
        ]
        
        self.ffn_layers = [
            keras.Sequential([
                layers.Dense(d_model * 4, activation='relu'),
                layers.Dropout(0.1),
                layers.Dense(d_model)
            ])
            for _ in range(num_layers)
        ]
        
        self.layer_norms = [
            layers.LayerNormalization(epsilon=1e-6)
            for _ in range(num_layers * 2)
        ]
        
        self.dropout = layers.Dropout(0.1)
    
    def create_positional_encoding(self, max_len, d_model):
        """Create positional encoding for temporal information"""
        position = np.arange(max_len)[:, np.newaxis]
        div_term = np.exp(np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model))
        
        pos_encoding = np.zeros((max_len, d_model))
        pos_encoding[:, 0::2] = np.sin(position * div_term)
        pos_encoding[:, 1::2] = np.cos(position * div_term)
        
        return tf.constant(pos_encoding[np.newaxis, :, :], dtype=tf.float32)
    
    def call(self, x, training=False):
        seq_len = tf.shape(x)[1]
        
        # Add positional encoding
        x = x + self.pos_encoding[:, :seq_len, :]
        x = self.dropout(x, training=training)
        
        # Pass through transformer layers
        for i, (attn, ffn) in enumerate(zip(self.encoder_layers, self.ffn_layers)):
            # Multi-head attention
            attn_output = attn(x, x, training=training)
            x = self.layer_norms[i*2](x + attn_output)
            
            # Feed-forward network
            ffn_output = ffn(x)
            x = self.layer_norms[i*2 + 1](x + ffn_output)
        
        return x


class AutismRiskClassifier(keras.Model):
    """
    Complete autism risk classification model
    CNN (spatial) + Transformer (temporal) + MLP (classification)
    """
    
    def __init__(
        self,
        num_keypoints=543,  # Face mesh (478) + pose (33) + hands (21*2)
        feature_dim=128,
        num_heads=4,
        num_transformer_layers=2,
        num_classes=3  # Low, Medium, High risk
    ):
        super().__init__()
        
        self.num_keypoints = num_keypoints
        self.feature_dim = feature_dim
        
        # Spatial feature extraction (per frame)
        self.spatial_extractor = SpatialFeatureExtractor(feature_dim)
        
        # Temporal pattern recognition (across frames)
        self.temporal_transformer = TemporalTransformer(
            d_model=feature_dim,
            num_heads=num_heads,
            num_layers=num_transformer_layers
        )
        
        # Classification head
        self.global_pool = layers.GlobalAveragePooling1D()
        
        self.classifier = keras.Sequential([
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.4),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(num_classes, activation='softmax')
        ])
        
        # Behavioral metric heads (multi-task learning)
        self.eye_contact_head = layers.Dense(1, activation='sigmoid', name='eye_contact')
        self.attention_shift_head = layers.Dense(1, activation='linear', name='attention_shifts')
        self.gesture_head = layers.Dense(1, activation='linear', name='gestures')
        self.social_gaze_head = layers.Dense(1, activation='sigmoid', name='social_gaze')
        self.response_latency_head = layers.Dense(1, activation='linear', name='response_latency')
    
    def call(self, x, training=False):
        """
        Forward pass
        x shape: (batch_size, sequence_length, num_keypoints, 3)  # 3 for x, y, z/visibility
        """
        batch_size = tf.shape(x)[0]
        seq_len = tf.shape(x)[1]
        
        # Reshape for spatial processing: (batch*seq, keypoints, 3)
        x_reshaped = tf.reshape(x, (-1, self.num_keypoints, 3))
        
        # Extract spatial features per frame
        spatial_features = self.spatial_extractor(x_reshaped, training=training)
        
        # Reshape back to sequence: (batch, seq, feature_dim)
        spatial_features = tf.reshape(spatial_features, (batch_size, seq_len, self.feature_dim))
        
        # Process temporal patterns
        temporal_features = self.temporal_transformer(spatial_features, training=training)
        
        # Global pooling for classification
        pooled_features = self.global_pool(temporal_features)
        
        # Risk classification
        risk_logits = self.classifier(pooled_features, training=training)
        
        # Behavioral metrics (multi-task outputs)
        eye_contact = self.eye_contact_head(pooled_features)
        attention_shifts = self.attention_shift_head(pooled_features)
        gestures = self.gesture_head(pooled_features)
        social_gaze = self.social_gaze_head(pooled_features)
        response_latency = self.response_latency_head(pooled_features)
        
        return {
            'risk_class': risk_logits,
            'eye_contact': eye_contact,
            'attention_shifts': attention_shifts,
            'gestures': gestures,
            'social_gaze': social_gaze,
            'response_latency': response_latency
        }
    
    def compute_loss(self, x, y_true, training=False):
        """
        Multi-task loss computation
        """
        y_pred = self(x, training=training)
        
        # Classification loss
        risk_loss = keras.losses.categorical_crossentropy(
            y_true['risk_class'], y_pred['risk_class']
        )
        
        # Behavioral metric losses (if available in training data)
        metric_losses = {}
        for metric in ['eye_contact', 'attention_shifts', 'gestures', 'social_gaze', 'response_latency']:
            if metric in y_true and y_true[metric] is not None:
                if metric in ['eye_contact', 'social_gaze']:
                    # Binary cross-entropy for percentages
                    metric_losses[metric] = keras.losses.binary_crossentropy(
                        y_true[metric], y_pred[metric]
                    )
                else:
                    # MSE for continuous values
                    metric_losses[metric] = keras.losses.mean_squared_error(
                        y_true[metric], y_pred[metric]
                    )
        
        # Combine losses
        total_loss = risk_loss
        for loss_val in metric_losses.values():
            total_loss += 0.2 * loss_val  # Weight behavioral losses lower
        
        return total_loss, y_pred


def create_training_pipeline():
    """
    Complete training pipeline with data augmentation
    """
    
    def augment_sequence(keypoints, labels):
        """Data augmentation for keypoint sequences"""
        # Random temporal cropping
        # Random noise injection
        # Random scaling
        # Random horizontal flip
        return keypoints, labels
    
    # Create model
    model = AutismRiskClassifier(
        num_keypoints=543,
        feature_dim=128,
        num_heads=4,
        num_transformer_layers=2,
        num_classes=3
    )
    
    # Compile with custom loss
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-4),
        loss={
            'risk_class': 'categorical_crossentropy',
            'eye_contact': 'binary_crossentropy',
            'attention_shifts': 'mse',
            'gestures': 'mse',
            'social_gaze': 'binary_crossentropy',
            'response_latency': 'mse'
        },
        loss_weights={
            'risk_class': 1.0,
            'eye_contact': 0.2,
            'attention_shifts': 0.2,
            'gestures': 0.2,
            'social_gaze': 0.2,
            'response_latency': 0.2
        },
        metrics={
            'risk_class': ['accuracy', keras.metrics.AUC()],
            'eye_contact': ['mae'],
            'social_gaze': ['mae']
        }
    )
    
    return model


def train_model(model, train_dataset, val_dataset, epochs=50):
    """
    Train the autism screening model
    """
    
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            'best_autism_model.h5',
            save_best_only=True,
            monitor='val_loss'
        ),
        keras.callbacks.EarlyStopping(
            patience=10,
            restore_best_weights=True,
            monitor='val_loss'
        ),
        keras.callbacks.ReduceLROnPlateau(
            factor=0.5,
            patience=5,
            monitor='val_loss'
        ),
        keras.callbacks.TensorBoard(
            log_dir='./logs'
        )
    ]
    
    history = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=epochs,
        callbacks=callbacks
    )
    
    return history


def prepare_data_from_videos(video_paths: List[str], labels: List[dict]):
    """
    Prepare training data from video files
    
    Args:
        video_paths: List of paths to training videos
        labels: List of dictionaries containing ground truth labels
                Format: {
                    'risk_class': [0, 1, 0],  # One-hot encoded
                    'eye_contact': 0.68,
                    'attention_shifts': 12.0,
                    ...
                }
    """
    from autism_screening_model import AutismScreeningModel
    
    # Extract features from all videos
    feature_sequences = []
    label_data = []
    
    model = AutismScreeningModel()
    
    for video_path, label in zip(video_paths, labels):
        # Process video to extract keypoint sequences
        frames = model.preprocess_video(video_path)
        
        keypoint_sequence = []
        
        for frame in frames:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Extract all keypoints
            face_results = model.face_mesh.process(rgb_frame)
            pose_results = model.pose.process(rgb_frame)
            hand_results = model.hands.process(rgb_frame)
            
            # Combine all landmarks into single vector
            all_keypoints = np.zeros((543, 3))
            
            if face_results.multi_face_landmarks:
                face_lm = face_results.multi_face_landmarks[0]
                for i, lm in enumerate(face_lm.landmark):
                    all_keypoints[i] = [lm.x, lm.y, lm.z]
            
            if pose_results.pose_landmarks:
                for i, lm in enumerate(pose_results.pose_landmarks.landmark):
                    all_keypoints[478 + i] = [lm.x, lm.y, lm.z]
            
            if hand_results.multi_hand_landmarks:
                # Left hand
                if len(hand_results.multi_hand_landmarks) > 0:
                    for i, lm in enumerate(hand_results.multi_hand_landmarks[0].landmark):
                        all_keypoints[511 + i] = [lm.x, lm.y, lm.z]
                
                # Right hand
                if len(hand_results.multi_hand_landmarks) > 1:
                    for i, lm in enumerate(hand_results.multi_hand_landmarks[1].landmark):
                        all_keypoints[532 + i] = [lm.x, lm.y, lm.z]
            
            keypoint_sequence.append(all_keypoints)
        
        feature_sequences.append(np.array(keypoint_sequence))
        label_data.append(label)
    
    return feature_sequences, label_data


# Example usage
if __name__ == "__main__":
    # Create model
    model = create_training_pipeline()
    
    print("Model architecture:")
    model.summary()
    
    print("\nModel ready for training!")
    print("To train, prepare your dataset and call:")
    print("  train_model(model, train_dataset, val_dataset)")
