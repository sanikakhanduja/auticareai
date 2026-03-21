"""
Validation script to visualize what the model detects
Shows face detection, eye detection, and gaze tracking on video frames
"""

import cv2
import numpy as np

def validate_video_analysis(video_path):
    """Show what features are being detected in the video"""
    
    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    frame_count = 0
    faces_detected = 0
    eyes_detected = 0
    
    # Load cascades
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    
    print("\n🔍 VALIDATION MODE - Feature Detection Analysis")
    print("=" * 70)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) > 0:
            faces_detected += 1
            x, y, w, h = faces[0]
            
            # Draw face rectangle
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
            
            # Detect eyes in face region
            face_roi = frame[y:y+h, x:x+w]
            gray_roi = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(gray_roi)
            
            if len(eyes) > 0:
                eyes_detected += 1
                # Draw eye circles
                for (ex, ey, ew, eh) in eyes:
                    center = (x + ex + ew//2, y + ey + eh//2)
                    radius = (ew + eh)//4
                    cv2.circle(frame, center, radius, (0, 255, 0), 2)
        
        # Display frame
        cv2.imshow('Feature Detection', frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Print statistics
    print(f"\n📊 Detection Statistics:")
    print(f"   Total Frames: {frame_count}")
    print(f"   Frames with Faces: {faces_detected} ({100*faces_detected/frame_count:.1f}%)")
    print(f"   Frames with Eyes: {eyes_detected} ({100*eyes_detected/frame_count:.1f}%)")
    
    if faces_detected == 0:
        print("\n⚠️  WARNING: No faces detected! Check video quality/lighting")
    if eyes_detected == 0:
        print("\n⚠️  WARNING: No eyes detected! May affect eye contact analysis")

if __name__ == "__main__":
    video_path = input("Enter video path: ").strip()
    validate_video_analysis(video_path)
