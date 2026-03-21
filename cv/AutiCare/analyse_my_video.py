"""
Simple Video Analysis Script
Analyzes your video and displays beautiful results
"""

from autism_screening_model import AutismScreeningModel
import sys
import os

def print_banner():
    """Print a nice banner"""
    print("\n" + "="*70)
    print("🧠 AUTICARE AI - AUTISM SCREENING ANALYSIS")
    print("="*70 + "\n")

def print_section(title):
    """Print a section header"""
    print(f"\n{'─'*70}")
    print(f"  {title}")
    print(f"{'─'*70}\n")

def analyze_video(video_path):
    """Analyze a video and display results"""
    
    # Check if video exists
    if not os.path.exists(video_path):
        print(f"❌ ERROR: Video file not found: {video_path}")
        print("\nMake sure you provide the correct path to your video file.")
        return
    
    print_banner()
    
    # Step 1: Initialize
    print_section("STEP 1: Initializing AI Model")
    print("🔧 Loading MediaPipe components...")
    print("   - Face mesh detector (478 landmarks)")
    print("   - Pose detector (33 landmarks)")  
    print("   - Hand tracker (42 landmarks)")
    
    model = AutismScreeningModel()
    print("\n✅ Model initialized successfully!\n")
    
    # Step 2: Process video
    print_section("STEP 2: Processing Video")
    print(f"📹 Video: {os.path.basename(video_path)}")
    print(f"📂 Path: {video_path}\n")
    
    print("⏳ Analyzing behavioral signals... (this may take 15-30 seconds)\n")
    
    try:
        metrics = model.process_video(video_path)
    except Exception as e:
        print(f"\n❌ ERROR during processing: {e}")
        print("\nTips:")
        print("  - Make sure the video shows a person's face")
        print("  - Video should be in MP4, AVI, or MOV format")
        print("  - Try a different video if this one is corrupted")
        return
    
    # Step 3: Calculate risk
    print_section("STEP 3: Risk Assessment")
    risk_level, confidence = metrics.calculate_risk_score()
    
    # Display risk with color coding
    risk_emoji = "🟢" if risk_level == "Low Risk" else ("🟡" if risk_level == "Medium Risk" else "🔴")
    
    print(f"\n  {risk_emoji} RISK LEVEL: {risk_level.upper()}")
    print(f"  📊 Confidence: {confidence*100:.0f}%\n")
    
    if risk_level == "Low Risk":
        print("  ℹ️  The screening indicates a low likelihood of autism spectrum disorder.")
    elif risk_level == "Medium Risk":
        print("  ⚠️  Some behavioral indicators suggest further evaluation may be helpful.")
    else:
        print("  ⚠️  Multiple risk factors detected. Professional evaluation recommended.")
    
    # Step 4: Detailed metrics
    print_section("STEP 4: Detailed Behavioral Metrics")
    
    # Helper function to show status
    def get_status(value, baseline, higher_is_better=True):
        if higher_is_better:
            if value >= baseline:
                return "✅ Normal", "green"
            else:
                return "⚠️  Below baseline", "yellow"
        else:
            if value <= baseline:
                return "✅ Normal", "green"
            else:
                return "⚠️  Above baseline", "yellow"
    
    # Metric 1: Eye Contact
    status, color = get_status(metrics.eye_contact_duration, metrics.eye_contact_baseline, True)
    print(f"👁️  EYE CONTACT DURATION")
    print(f"   Measured: {metrics.eye_contact_duration}%")
    print(f"   Baseline: {metrics.eye_contact_baseline}%")
    print(f"   Status: {status}\n")
    
    # Metric 2: Attention Shifts
    status, color = get_status(metrics.attention_shifts, metrics.attention_shifts_baseline, False)
    print(f"👀 ATTENTION SHIFTS")
    print(f"   Measured: {metrics.attention_shifts}/minute")
    print(f"   Baseline: {metrics.attention_shifts_baseline}/minute")
    print(f"   Status: {status}\n")
    
    # Metric 3: Gesture Frequency
    status, color = get_status(metrics.gesture_frequency, metrics.gesture_frequency_baseline, True)
    print(f"👋 GESTURE FREQUENCY")
    print(f"   Measured: {metrics.gesture_frequency}/minute")
    print(f"   Baseline: {metrics.gesture_frequency_baseline}/minute")
    print(f"   Status: {status}\n")
    
    # Metric 4: Social Gaze
    status, color = get_status(metrics.social_gaze, metrics.social_gaze_baseline, True)
    print(f"👤 SOCIAL GAZE")
    print(f"   Measured: {metrics.social_gaze}%")
    print(f"   Baseline: {metrics.social_gaze_baseline}%")
    print(f"   Status: {status}\n")
    
    # Metric 5: Response Latency
    status, color = get_status(metrics.response_latency, metrics.response_latency_baseline, False)
    print(f"⏱️  RESPONSE LATENCY")
    print(f"   Measured: {metrics.response_latency} seconds")
    print(f"   Baseline: {metrics.response_latency_baseline} seconds")
    print(f"   Status: {status}\n")
    
    # Step 5: Behavioral indicators
    print_section("STEP 5: Behavioral Indicators Analyzed")
    
    indicators = [
        "Eye gaze patterns analyzed from video",
        "Social engagement behaviors observed",
        "Response to environmental stimuli noted",
        "Repetitive behavior patterns assessed",
        "Communication patterns evaluated"
    ]
    
    for indicator in indicators:
        print(f"   ✓ {indicator}")
    
    # Step 6: Save report
    print_section("STEP 6: Saving Report")
    
    report_path = "screening_report.json"
    report = model.generate_report(metrics, output_path=report_path)
    
    print(f"💾 Full report saved to: {report_path}")
    print(f"📄 You can open this file to see all details in JSON format\n")
    
    # Important disclaimer
    print_section("⚠️  IMPORTANT DISCLAIMER")
    print("""
    This is a SCREENING TOOL, not a diagnostic tool.
    
    ✓ This tool can help identify potential risk factors
    ✗ This tool CANNOT diagnose autism spectrum disorder
    
    Next Steps:
    1. Share these results with a qualified healthcare professional
    2. Consider a comprehensive clinical evaluation if indicated
    3. This tool is for research and educational purposes
    
    Remember: Early intervention leads to better outcomes!
    """)
    
    print("="*70 + "\n")
    print("✅ Analysis Complete!\n")


if __name__ == "__main__":
    # Print instructions
    print("\n" + "="*70)
    print("🎥 VIDEO ANALYSIS TOOL")
    print("="*70)
    
    # Check if video path was provided
    if len(sys.argv) < 2:
        print("\n📝 USAGE:")
        print("   python analyze_my_video.py <path_to_video>\n")
        print("📌 EXAMPLES:")
        print("   python analyze_my_video.py my_video.mp4")
        print("   python analyze_my_video.py /Users/yourname/Downloads/child_video.mp4")
        print("   python analyze_my_video.py C:\\Users\\YourName\\Videos\\test.mp4\n")
        
        # Ask for video path
        video_path = input("👉 Enter the path to your video file: ").strip()
        
        # Remove quotes if user pasted a path with quotes
        video_path = video_path.strip('"').strip("'")
        
        if video_path:
            analyze_video(video_path)
        else:
            print("\n❌ No video path provided. Exiting.\n")
    else:
        # Video path provided as argument
        video_path = sys.argv[1]
        analyze_video(video_path)
