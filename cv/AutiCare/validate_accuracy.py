"""
Validation Framework
Compares screening results against known diagnoses to calculate accuracy
"""

import json
from autism_screening_model import AutismScreeningModel

def create_test_dataset():
    """Define test videos with known diagnoses"""
    return {
        "child_video.mp4": {
            "diagnosis": "unknown",  # Set to "autism" or "typical" based on ground truth
            "notes": "Edit this to match the actual child in the video"
        }
    }

def validate_accuracy(test_videos):
    """Run screening on known cases and calculate metrics"""
    
    model = AutismScreeningModel()
    results = []
    
    print("\n📋 VALIDATION TEST SUITE")
    print("=" * 70)
    print(f"Testing {len(test_videos)} videos with known diagnoses\n")
    
    for video_path, metadata in test_videos.items():
        print(f"Analyzing: {video_path}")
        print(f"   Known Diagnosis: {metadata['diagnosis']}")
        
        try:
            # Load video
            import cv2
            import numpy as np
            cap = cv2.VideoCapture(video_path)
            frames = []
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(frame)
            cap.release()
            
            # Run analysis
            metrics = model.analyze(frames)
            
            # Determine prediction
            eye_contact = metrics.eye_contact_duration
            if eye_contact < 50:
                prediction = "autism"
                confidence = min(100, 100 - eye_contact)
            else:
                prediction = "typical"
                confidence = min(100, eye_contact)
            
            result = {
                "video": video_path,
                "known_diagnosis": metadata['diagnosis'],
                "predicted_diagnosis": prediction,
                "confidence": confidence,
                "eye_contact": eye_contact,
                "match": prediction == metadata['diagnosis'] if metadata['diagnosis'] != "unknown" else "unknown"
            }
            
            results.append(result)
            
            print(f"   Prediction: {prediction} ({confidence:.0f}% confidence)")
            print(f"   Eye Contact: {eye_contact:.1f}%")
            print(f"   Match: {'✅' if result['match'] == True else '❌' if result['match'] == False else '❓'}\n")
            
        except Exception as e:
            print(f"   ❌ Error: {e}\n")
    
    # Calculate overall accuracy
    correct = sum(1 for r in results if r['match'] == True)
    total = sum(1 for r in results if r['match'] != "unknown")
    
    if total > 0:
        accuracy = 100 * correct / total
        print(f"\n📊 Overall Accuracy: {accuracy:.1f}% ({correct}/{total})")
    else:
        print("\n⚠️  No known diagnoses provided. Update test_dataset() with ground truth labels.")
    
    # Save validation report
    with open('validation_report.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("📄 Detailed report saved to: validation_report.json")
    
    return results

if __name__ == "__main__":
    test_videos = create_test_dataset()
    validate_accuracy(test_videos)
