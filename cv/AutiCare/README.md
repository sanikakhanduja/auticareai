# AutiCare AI - Early Autism Screening System

**AI-powered early autism detection using computer vision and behavioral analysis**

## 🎯 Overview

This system uses state-of-the-art computer vision and deep learning to analyze behavioral signals from video recordings and assess autism risk in young children. The platform provides objective, quantitative metrics that can help parents and clinicians identify early signs of autism spectrum disorder.

## 🔬 How It Works

### Behavioral Signals Analyzed

The system extracts and quantifies five key behavioral markers:

1. **Eye Contact Duration** (baseline: 75%)
   - Measures percentage of time child maintains eye contact with camera
   - Uses iris tracking and gaze direction estimation

2. **Attention Shifts** (baseline: 8/min)
   - Counts rapid gaze direction changes
   - Indicates focus and attention patterns

3. **Gesture Frequency** (baseline: 6/min)
   - Detects communicative gestures (pointing, waving, reaching)
   - Measures social communication attempts

4. **Social Gaze** (baseline: 60%)
   - Percentage of time engaged in socially-directed gaze
   - Indicates social awareness and joint attention

5. **Response Latency** (baseline: 1.5s)
   - Time taken to respond to environmental stimuli
   - Measures processing speed and engagement

### Technical Architecture

```
Video Input (MP4)
    ↓
Frame Preprocessing
    ├── Frame Sampling (~10 fps)
    ├── Normalization
    └── Resize (640x480)
    ↓
Feature Extraction (MediaPipe)
    ├── Face Mesh (478 landmarks)
    │   ├── Eye tracking
    │   ├── Gaze direction
    │   └── Facial expressions
    ├── Pose Detection (33 landmarks)
    │   ├── Body movements
    │   └── Repetitive behaviors
    └── Hand Tracking (42 landmarks)
        └── Gesture detection
    ↓
Behavioral Signal Processing
    ├── Eye contact analyzer
    ├── Attention shift detector
    ├── Gesture classifier
    ├── Social gaze tracker
    └── Response latency calculator
    ↓
Deep Learning Classifier (Optional)
    ├── CNN (Spatial Features)
    ├── Transformer (Temporal Patterns)
    └── Multi-task Learning
    ↓
Risk Assessment Report
    ├── Low / Medium / High Risk
    ├── Confidence Score
    └── Detailed Metrics
```

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/auticareai.git
cd auticareai

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Basic Usage

```python
from autism_screening_model import AutismScreeningModel

# Initialize model
model = AutismScreeningModel()

# Process video
metrics = model.process_video("child_video.mp4")

# Generate report
report = model.generate_report(metrics, output_path="report.json")

# Print results
print(f"Risk Level: {report['risk_assessment']['level']}")
print(f"Confidence: {report['risk_assessment']['confidence']}")
```

### Command Line

```bash
python autism_screening_model.py path/to/video.mp4
```

## 🌐 API Deployment

### Start the API Server

```bash
python api_server.py
```

The server will start at `http://localhost:8000`

### API Endpoints

#### 1. Screen Video
```bash
POST /api/screen
Content-Type: multipart/form-data

curl -X POST "http://localhost:8000/api/screen" \
  -F "video=@child_video.mp4" \
  -F "save_report=true"
```

**Response:**
```json
{
  "risk_assessment": {
    "level": "Low Risk",
    "confidence": 0.85,
    "description": "The screening indicates a low risk likelihood of autism spectrum disorder."
  },
  "metrics": {
    "objective_signals": {
      "eye_contact_duration": {
        "value": "68%",
        "baseline": "75%",
        "status": "below_baseline"
      },
      ...
    }
  }
}
```

#### 2. Get Metrics Only
```bash
POST /api/metrics

curl -X POST "http://localhost:8000/api/metrics" \
  -F "video=@child_video.mp4"
```

#### 3. Batch Processing
```bash
POST /api/batch-screen

curl -X POST "http://localhost:8000/api/batch-screen" \
  -F "videos=@video1.mp4" \
  -F "videos=@video2.mp4"
```

#### 4. Get Baselines
```bash
GET /api/baselines

curl "http://localhost:8000/api/baselines"
```

## 🧠 Advanced: Deep Learning Classifier

For research or clinical deployment with labeled training data:

```python
from deep_learning_classifier import create_training_pipeline, train_model

# Create model
model = create_training_pipeline()

# Prepare data (requires labeled videos)
from deep_learning_classifier import prepare_data_from_videos

video_paths = ["video1.mp4", "video2.mp4", ...]
labels = [
    {
        'risk_class': [1, 0, 0],  # Low risk (one-hot)
        'eye_contact': 0.75,
        'attention_shifts': 7.5,
        ...
    },
    ...
]

# Extract features
features, labels = prepare_data_from_videos(video_paths, labels)

# Create datasets
train_dataset = tf.data.Dataset.from_tensor_slices((features, labels))
train_dataset = train_dataset.batch(32).prefetch(tf.data.AUTOTUNE)

# Train
history = train_model(model, train_dataset, val_dataset, epochs=50)

# Save model
model.save('autism_classifier_model.h5')
```

## 📊 Example Output

```
==============================================================
AUTISM SCREENING REPORT
==============================================================

Risk Assessment: Low Risk
Confidence: 85%

Objective Behavioral Signals:
  • Eye Contact Duration: 68% (baseline: 75%)
  • Attention Shifts: 12/min (baseline: 8/min)
  • Gesture Frequency: 4/min (baseline: 6/min)
  • Social Gaze: 45% (baseline: 60%)
  • Response Latency: 2.3s (baseline: 1.5s)

Behavioral Indicators Analyzed:
  ✓ Eye gaze patterns analyzed from video
  ✓ Social engagement behaviors observed
  ✓ Response to environmental stimuli noted
  ✓ Repetitive behavior patterns assessed
  ✓ Communication patterns evaluated
==============================================================
```

## 🎥 Video Requirements

For best results, videos should:

- **Length**: 30-120 seconds
- **Format**: MP4, AVI, or MOV
- **Content**: Child interacting with caregiver or toys
- **Lighting**: Good, even lighting
- **Angle**: Front-facing view of child's face
- **Quality**: 720p or higher recommended

### Ideal Video Scenarios

1. **Parent-child play interaction**
2. **Response to name calling**
3. **Toy play with social referencing**
4. **Book reading or storytelling**
5. **Free play observation**

## ⚙️ Configuration

### Adjusting Detection Sensitivity

```python
# In autism_screening_model.py

# Eye contact threshold (default: gaze within 40-60% horizontal, 30-70% vertical)
is_centered_x = 0.4 < gaze_x < 0.6
is_centered_y = 0.3 < gaze_y < 0.7

# Attention shift threshold (default: 0.15 distance)
shift_detected = gaze_distance > 0.15

# Frame sampling rate (default: 10 fps)
frame_skip = max(1, int(self.fps / 10))
```

### Customizing Baselines

```python
metrics = BehavioralMetrics(
    eye_contact_duration=68.0,
    eye_contact_baseline=70.0,  # Custom baseline
    attention_shifts=12.0,
    attention_shifts_baseline=10.0,  # Custom baseline
    # ... etc
)
```

## 🔧 Integration with Your App

### Frontend Integration (React/Vue)

```javascript
// Upload video for screening
async function screenVideo(videoFile) {
  const formData = new FormData();
  formData.append('video', videoFile);
  
  const response = await fetch('http://localhost:8000/api/screen', {
    method: 'POST',
    body: formData
  });
  
  const report = await response.json();
  return report;
}

// Display results
function displayResults(report) {
  const riskLevel = report.risk_assessment.level;
  const metrics = report.metrics.objective_signals;
  
  // Update UI with results
  // ... your UI code
}
```

### Mobile App Integration (React Native)

```javascript
import DocumentPicker from 'react-native-document-picker';

async function uploadAndScreen() {
  const video = await DocumentPicker.pick({
    type: [DocumentPicker.types.video],
  });
  
  const formData = new FormData();
  formData.append('video', {
    uri: video.uri,
    type: video.type,
    name: video.name,
  });
  
  const response = await fetch('YOUR_API_URL/api/screen', {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
}
```

## 📈 Performance Metrics

- **Processing Time**: ~15-30 seconds for 60-second video (CPU)
- **GPU Processing**: ~5-10 seconds for 60-second video
- **Accuracy**: Baseline heuristic model (improve with ML training)
- **Frame Rate**: Processes 10 frames/second effectively

## 🛡️ Important Disclaimers

**⚠️ This is a screening tool, NOT a diagnostic tool**

1. **Not a substitute for professional evaluation**: This tool is designed to flag potential risk factors, not diagnose autism.

2. **Requires clinical confirmation**: Any concerning results should be followed up with a qualified healthcare professional.

3. **Research/Educational purposes**: Current version is for demonstration and research purposes.

4. **Cultural considerations**: Behavioral norms vary across cultures; baselines may need adjustment.

5. **Age considerations**: Most effective for children 18-36 months.

## 🔬 Research Background

This implementation is based on validated autism screening approaches:

- **M-CHAT** (Modified Checklist for Autism in Toddlers)
- **ADOS-2** (Autism Diagnostic Observation Schedule)
- Computer vision research in autism detection
- Behavioral marker studies from peer-reviewed literature

### Key References

1. Eye tracking studies (Chawarska et al., 2013)
2. Gaze patterns in ASD (Jones & Klin, 2013)
3. Automated behavioral analysis (Rehg et al., 2014)
4. Deep learning for autism detection (recent studies)

## 🤝 Contributing

This is a research/educational project. To improve it:

1. **Collect labeled data**: Videos with clinical diagnoses
2. **Train ML models**: Use the deep learning classifier
3. **Validate results**: Compare with clinical assessments
4. **Add features**: New behavioral markers
5. **Optimize performance**: Model compression, quantization

## 📝 License

This project is for educational and research purposes. Consult with legal/medical professionals before clinical deployment.

## 🔮 Future Enhancements

- [ ] Real-time video analysis
- [ ] Mobile app deployment
- [ ] Multi-language support
- [ ] Parent questionnaire integration
- [ ] Longitudinal tracking dashboard
- [ ] Federated learning for privacy-preserving model training
- [ ] Integration with EHR systems
- [ ] Telehealth platform integration

## 📞 Support

For questions, issues, or collaboration:
- Create an issue on GitHub
- Contact: [your-email@domain.com]
- Documentation: [your-docs-url]

## 🙏 Acknowledgments

Built with:
- MediaPipe (Google)
- TensorFlow/Keras
- OpenCV
- FastAPI

---

**Made with ❤️ for early intervention and better outcomes**
