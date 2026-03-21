"""
Diagnostic Checklist
Identifies potential issues affecting accuracy
"""

import cv2
import json

def check_video_quality(video_path):
    """Diagnose video quality issues"""
    
    cap = cv2.VideoCapture(video_path)
    
    print("\n✅ VIDEO QUALITY DIAGNOSTICS")
    print("=" * 70)
    
    # Check video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    print(f"Resolution: {width}x{height}")
    print(f"FPS: {fps}")
    print(f"Duration: {duration:.1f} seconds ({total_frames} frames)")
    
    issues = []
    recommendations = []
    
    # Check resolution
    if width < 640 or height < 480:
        issues.append("⚠️  Low resolution (< 640x480) - may affect face detection")
        recommendations.append("Use higher resolution video (720p or better)")
    else:
        print("✅ Resolution adequate for face detection")
    
    # Check duration
    if duration < 10:
        issues.append("⚠️  Video too short (< 10 seconds)")
        recommendations.append("Use longer videos for more accurate analysis (30-60 seconds)")
    else:
        print(f"✅ Duration adequate ({duration:.0f}s)")
    
    # Analyze frames
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    frames_with_faces = 0
    darkness_frames = 0
    brightness_frames = 0
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_idx += 1
        if frame_idx % 10 == 0:  # Sample every 10th frame
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            if len(faces) > 0:
                frames_with_faces += 1
            
            # Check brightness
            brightness = cv2.mean(gray)[0]
            if brightness < 50:
                darkness_frames += 1
            elif brightness > 200:
                brightness_frames += 1
    
    cap.release()
    
    sampled_frames = frame_idx // 10
    face_detection_rate = 100 * frames_with_faces / sampled_frames if sampled_frames > 0 else 0
    
    print(f"✅ Face detection rate: {face_detection_rate:.0f}%")
    
    if face_detection_rate < 50:
        issues.append("⚠️  Low face detection rate (< 50%)")
        recommendations.append("Ensure face is clearly visible and centered in frame")
        recommendations.append("Check lighting - avoid backlighting or shadows on face")
    
    if darkness_frames > sampled_frames * 0.3:
        issues.append("⚠️  Video too dark in many frames")
        recommendations.append("Improve lighting or use video from well-lit environment")
    
    if brightness_frames > sampled_frames * 0.3:
        issues.append("⚠️  Video too bright in many frames (overexposed)")
        recommendations.append("Reduce overexposure or use diffuse lighting")
    
    # Report
    if issues:
        print("\n🔴 ISSUES FOUND:")
        for issue in issues:
            print(f"   {issue}")
        print("\n💡 RECOMMENDATIONS:")
        for rec in recommendations:
            print(f"   • {rec}")
    else:
        print("\n✅ All quality checks passed!")
    
    return {
        "path": video_path,
        "duration": duration,
        "resolution": f"{width}x{height}",
        "fps": fps,
        "face_detection_rate": face_detection_rate,
        "issues": issues,
        "recommendations": recommendations
    }

if __name__ == "__main__":
    video_path = input("Enter video path: ").strip()
    diagnostics = check_video_quality(video_path)
    
    # Save diagnostics
    with open('diagnostics.json', 'w') as f:
        json.dump(diagnostics, f, indent=2)
