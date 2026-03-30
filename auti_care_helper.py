"""
Standalone Helper for Integrating AutiCare AI Model into other projects.
Usage:
    from auti_care_helper import AutismDetector
    detector = AutismDetector('path/to/best_autism_detector_model.h5')
    result = detector.predict_image('child_photo.jpg')
    print(result['diagnosis'], result['confidence'])
"""
import tensorflow as tf
import numpy as np
import cv2
from PIL import Image
import os

class AutismDetector:
    def __init__(self, model_path):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
        self.model = tf.keras.models.load_model(model_path)
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def is_human_present(self, pil_image):
        """Check for human presence using Haar Cascades."""
        img_cv = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        return len(faces) > 0

    def preprocess(self, pil_image):
        """Prepare image for the AI model."""
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        img_resized = pil_image.resize((224, 224))
        img_array = np.array(img_resized).astype(np.float32) / 255.0
        return np.expand_dims(img_array, axis=0)

    def predict_image(self, image_input):
        """
        Predict Autism from a single image.
        image_input: path to image or PIL Image object
        """
        if isinstance(image_input, str):
            pil_image = Image.open(image_input)
        else:
            pil_image = image_input

        if not self.is_human_present(pil_image):
            return {"error": "No human detected. Please upload a clear photo of the child."}

        processed = self.preprocess(pil_image)
        score = self.model.predict(processed, verbose=0)[0][0]
        return self._interpret(score)

    def predict_video(self, video_path, sampling_rate=10, frames_per_sample=3):
        """
        Predict Autism from a video by sampling frames.
        """
        cap = cv2.VideoCapture(video_path)
        predictions = []
        frame_count = 0
        human_detected_count = 0
        total_samples = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % sampling_rate < frames_per_sample:
                total_samples += 1
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(frame_rgb)
                
                if self.is_human_present(pil_img):
                    human_detected_count += 1
                    processed = self.preprocess(pil_img)
                    pred = self.model.predict(processed, verbose=0)[0][0]
                    predictions.append(pred)
            frame_count += 1
        
        cap.release()

        if total_samples > 0 and (human_detected_count / total_samples) < 0.3:
            return {"error": "Non-human video detected. Please upload a video showing the child clearly."}

        if not predictions:
            return {"error": "Could not process any frames from the video."}

        return self._interpret(np.mean(predictions))

    def _interpret(self, score):
        """Convert probability score to human-readable result."""
        is_autistic = score > 0.5
        confidence = score if is_autistic else (1 - score)
        return {
            "diagnosis": "AUTISTIC TRAITS DETECTED" if is_autistic else "NON-AUTISTIC / TYPICAL",
            "confidence": round(float(confidence) * 100, 2),
            "raw_score": float(score)
        }
