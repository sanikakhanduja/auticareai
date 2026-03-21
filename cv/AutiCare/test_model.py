"""
Test script for Autism Screening Model
Creates synthetic test data and validates model functionality
"""

import cv2
import numpy as np
from autism_screening_model import AutismScreeningModel, BehavioralMetrics
import os


def create_test_video(
    output_path: str = "test_video.mp4",
    duration_seconds: int = 10,
    fps: int = 30,
    width: int = 640,
    height: int = 480
):
    """
    Create a synthetic test video with a simple moving circle
    (In real testing, use actual child behavioral videos)
    """
    
    print(f"Creating test video: {output_path}")
    
    # Video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    total_frames = duration_seconds * fps
    
    for frame_idx in range(total_frames):
        # Create blank frame
        frame = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Add moving circle (simulates face/person)
        circle_x = int(width / 2 + 100 * np.sin(frame_idx * 0.05))
        circle_y = int(height / 2 + 50 * np.cos(frame_idx * 0.03))
        
        # Draw circle (represents face)
        cv2.circle(frame, (circle_x, circle_y), 50, (100, 150, 200), -1)
        
        # Add eyes (small circles)
        cv2.circle(frame, (circle_x - 15, circle_y - 10), 5, (0, 0, 0), -1)
        cv2.circle(frame, (circle_x + 15, circle_y - 10), 5, (0, 0, 0), -1)
        
        # Add some text
        cv2.putText(
            frame,
            f"Test Frame {frame_idx + 1}/{total_frames}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 0),
            2
        )
        
        out.write(frame)
    
    out.release()
    print(f"✓ Test video created: {output_path}")
    return output_path


def test_basic_model():
    """Test basic model initialization and processing"""
    
    print("\n" + "="*60)
    print("TEST 1: Basic Model Initialization")
    print("="*60)
    
    try:
        model = AutismScreeningModel()
        print("✓ Model initialized successfully")
        
        # Check components
        assert model.face_mesh is not None, "Face mesh not initialized"
        assert model.pose is not None, "Pose detection not initialized"
        assert model.hands is not None, "Hand tracking not initialized"
        print("✓ All MediaPipe components loaded")
        
        return True
    except Exception as e:
        print(f"✗ Model initialization failed: {e}")
        return False


def test_video_preprocessing():
    """Test video loading and preprocessing"""
    
    print("\n" + "="*60)
    print("TEST 2: Video Preprocessing")
    print("="*60)
    
    # Create test video
    test_video_path = create_test_video(
        output_path="test_video_preprocessing.mp4",
        duration_seconds=5
    )
    
    try:
        model = AutismScreeningModel()
        frames = model.preprocess_video(test_video_path)
        
        print(f"✓ Loaded {len(frames)} frames")
        assert len(frames) > 0, "No frames extracted"
        assert frames[0].shape[2] == 3, "Invalid frame format"
        print(f"✓ Frame shape: {frames[0].shape}")
        
        # Cleanup
        os.remove(test_video_path)
        
        return True
    except Exception as e:
        print(f"✗ Video preprocessing failed: {e}")
        if os.path.exists(test_video_path):
            os.remove(test_video_path)
        return False


def test_full_pipeline():
    """Test complete processing pipeline"""
    
    print("\n" + "="*60)
    print("TEST 3: Full Processing Pipeline")
    print("="*60)
    
    # Create test video
    test_video_path = create_test_video(
        output_path="test_video_full.mp4",
        duration_seconds=10
    )
    
    try:
        model = AutismScreeningModel()
        
        print("\nProcessing video through full pipeline...")
        metrics = model.process_video(test_video_path)
        
        # Validate metrics
        print("\n✓ Metrics extracted successfully:")
        print(f"  - Eye Contact: {metrics.eye_contact_duration}%")
        print(f"  - Attention Shifts: {metrics.attention_shifts}/min")
        print(f"  - Gestures: {metrics.gesture_frequency}/min")
        print(f"  - Social Gaze: {metrics.social_gaze}%")
        print(f"  - Response Latency: {metrics.response_latency}s")
        
        # Test risk calculation
        risk_level, confidence = metrics.calculate_risk_score()
        print(f"\n✓ Risk Assessment: {risk_level} (confidence: {confidence:.0%})")
        
        # Test report generation
        report = model.generate_report(metrics, output_path="test_report.json")
        print("\n✓ Report generated successfully")
        
        # Validate report structure
        assert 'risk_assessment' in report
        assert 'metrics' in report
        print("✓ Report structure validated")
        
        # Cleanup
        os.remove(test_video_path)
        if os.path.exists("test_report.json"):
            os.remove("test_report.json")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Full pipeline test failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Cleanup
        if os.path.exists(test_video_path):
            os.remove(test_video_path)
        if os.path.exists("test_report.json"):
            os.remove("test_report.json")
        
        return False


def test_behavioral_metrics():
    """Test BehavioralMetrics class"""
    
    print("\n" + "="*60)
    print("TEST 4: Behavioral Metrics")
    print("="*60)
    
    try:
        # Create test metrics
        metrics = BehavioralMetrics(
            eye_contact_duration=68.0,
            attention_shifts=12.0,
            gesture_frequency=4.0,
            social_gaze=45.0,
            response_latency=2.3
        )
        
        print("✓ Metrics object created")
        
        # Test to_dict
        metrics_dict = metrics.to_dict()
        print("✓ Converted to dictionary")
        
        # Validate structure
        assert 'objective_signals' in metrics_dict
        assert 'behavioral_indicators' in metrics_dict
        print("✓ Dictionary structure validated")
        
        # Test risk calculation
        risk_level, confidence = metrics.calculate_risk_score()
        print(f"✓ Risk calculation: {risk_level} ({confidence:.0%})")
        
        return True
        
    except Exception as e:
        print(f"✗ Behavioral metrics test failed: {e}")
        return False


def test_api_integration():
    """Test API endpoints (requires server to be running)"""
    
    print("\n" + "="*60)
    print("TEST 5: API Integration (Optional)")
    print("="*60)
    
    try:
        import requests
        
        # Check if server is running
        try:
            response = requests.get("http://localhost:8000/health", timeout=2)
            server_running = response.status_code == 200
        except:
            server_running = False
        
        if not server_running:
            print("⚠ API server not running - skipping API tests")
            print("  To test API, run: python api_server.py")
            return None  # Not a failure, just skipped
        
        print("✓ API server is running")
        
        # Test baselines endpoint
        response = requests.get("http://localhost:8000/api/baselines")
        assert response.status_code == 200
        baselines = response.json()
        print("✓ Baselines endpoint working")
        print(f"  Retrieved {len(baselines)} baseline metrics")
        
        # Test health endpoint
        response = requests.get("http://localhost:8000/health")
        assert response.status_code == 200
        health = response.json()
        assert health['status'] == 'healthy'
        print("✓ Health check passed")
        
        # Create test video for upload
        test_video_path = create_test_video(
            output_path="test_api_video.mp4",
            duration_seconds=5
        )
        
        # Test screening endpoint
        with open(test_video_path, 'rb') as f:
            files = {'video': f}
            response = requests.post(
                "http://localhost:8000/api/screen",
                files=files,
                timeout=60
            )
        
        assert response.status_code == 200
        result = response.json()
        print("✓ Screening endpoint working")
        print(f"  Risk: {result['risk_assessment']['level']}")
        
        # Cleanup
        os.remove(test_video_path)
        
        return True
        
    except ImportError:
        print("⚠ 'requests' library not installed - skipping API tests")
        print("  Install with: pip install requests")
        return None
    except Exception as e:
        print(f"✗ API integration test failed: {e}")
        if os.path.exists("test_api_video.mp4"):
            os.remove("test_api_video.mp4")
        return False


def run_all_tests():
    """Run all test suites"""
    
    print("\n" + "="*60)
    print("AUTISM SCREENING MODEL - TEST SUITE")
    print("="*60)
    
    results = {}
    
    # Run tests
    results['basic_model'] = test_basic_model()
    results['video_preprocessing'] = test_video_preprocessing()
    results['behavioral_metrics'] = test_behavioral_metrics()
    results['full_pipeline'] = test_full_pipeline()
    results['api_integration'] = test_api_integration()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASS" if result is True else ("✗ FAIL" if result is False else "⊘ SKIP")
        print(f"{status:8} - {test_name}")
    
    print(f"\nResults: {passed}/{total} passed, {failed} failed, {skipped} skipped")
    
    if failed == 0 and passed > 0:
        print("\n🎉 All tests passed!")
    elif failed > 0:
        print(f"\n⚠️  {failed} test(s) failed - review errors above")
    
    return results


if __name__ == "__main__":
    # Run all tests
    results = run_all_tests()
    
    # Create example usage demonstration
    print("\n" + "="*60)
    print("EXAMPLE USAGE DEMONSTRATION")
    print("="*60)
    
    print("\nCreating example video for demonstration...")
    demo_video = create_test_video(
        output_path="demo_video.mp4",
        duration_seconds=30,
        fps=30
    )
    
    print("\nTo analyze a real video, run:")
    print(f"  python autism_screening_model.py demo_video.mp4")
    print("\nOr use programmatically:")
    print("""
from autism_screening_model import AutismScreeningModel

model = AutismScreeningModel()
metrics = model.process_video("demo_video.mp4")
report = model.generate_report(metrics)
    """)
    
    print("\n" + "="*60)
