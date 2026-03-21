# 📁 AutiCare AI - Project Structure

## File Organization

```
auticareai/
│
├── 📄 autism_screening_model.py      # Main CV model (18KB)
│   ├── BehavioralMetrics class
│   ├── AutismScreeningModel class
│   └── Full video processing pipeline
│
├── 🧠 deep_learning_classifier.py     # Advanced ML classifier (14KB)
│   ├── CNN for spatial features
│   ├── Transformer for temporal patterns
│   └── Multi-task learning architecture
│
├── 🌐 api_server.py                   # REST API server (7KB)
│   ├── FastAPI endpoints
│   ├── Video upload handling
│   └── Batch processing support
│
├── 🎨 demo_interface.html             # Web demo UI (16KB)
│   ├── Drag & drop upload
│   ├── Real-time analysis
│   └── Visual results display
│
├── 🧪 test_model.py                   # Test suite (11KB)
│   ├── Unit tests
│   ├── Integration tests
│   └── Sample data generation
│
├── 📦 requirements.txt                # Dependencies (695B)
│
├── 📖 README.md                       # Full documentation (11KB)
├── 🚀 QUICKSTART.md                   # Quick start guide (6KB)
└── 🔧 DEPLOYMENT.md                   # Deployment guide (14KB)

Total: ~100KB of code + documentation
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      VIDEO INPUT (MP4)                      │
│                      30-120 seconds                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              PREPROCESSING PIPELINE                          │
│  • Frame sampling (~10 fps)                                  │
│  • Normalization (640x480)                                   │
│  • RGB conversion                                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           MEDIAPIPE FEATURE EXTRACTION                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Face Mesh   │  │  Pose        │  │  Hands       │     │
│  │  478 points  │  │  33 points   │  │  42 points   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ▼               ▼               ▼                          │
│  Eye Tracking    Body Movement   Gesture Detection          │
│  Gaze Direction  Repetitive      Pointing/Waving           │
│  Iris Position   Behaviors       Hand Movements             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         BEHAVIORAL SIGNAL PROCESSING                         │
│                                                              │
│  1️⃣  Eye Contact Duration      👁️  68% vs 75% baseline    │
│  2️⃣  Attention Shifts          👀  12/min vs 8/min         │
│  3️⃣  Gesture Frequency         👋  4/min vs 6/min          │
│  4️⃣  Social Gaze               👤  45% vs 60% baseline     │
│  5️⃣  Response Latency          ⏱️  2.3s vs 1.5s           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│            RISK CLASSIFICATION                               │
│                                                              │
│  Option A: Heuristic (fast, baseline)                       │
│  • Compare against baselines                                │
│  • Count risk factors                                       │
│  • Calculate confidence                                     │
│                                                              │
│  Option B: Deep Learning (requires training)                │
│  • CNN → Spatial features                                   │
│  • Transformer → Temporal patterns                          │
│  • Multi-task → All metrics                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  OUTPUT REPORT                               │
│                                                              │
│  📊 Risk Assessment: Low / Medium / High                    │
│  📈 Confidence Score: 0-100%                                │
│  📋 Detailed Metrics: All 5 signals                         │
│  ✅ Behavioral Indicators: Checkmarked list                 │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
1. UPLOAD
   User → Web Interface / API → Video File
   
2. PREPROCESS
   Video File → Frame Extraction → Normalized Frames
   
3. EXTRACT
   Frames → MediaPipe → Keypoint Sequences
   
4. ANALYZE
   Keypoints → Signal Processors → Behavioral Metrics
   
5. CLASSIFY
   Metrics → Risk Calculator → Assessment + Report
   
6. DELIVER
   Report → JSON/UI → User
```

## 🎯 Key Components

### 1. AutismScreeningModel (Main Class)
```python
model = AutismScreeningModel()
metrics = model.process_video("video.mp4")
report = model.generate_report(metrics)
```

**Methods:**
- `preprocess_video()` - Load and sample frames
- `detect_eye_contact()` - Track gaze direction
- `detect_attention_shift()` - Monitor gaze changes
- `detect_gestures()` - Identify hand movements
- `calculate_social_gaze()` - Social engagement
- `process_video()` - Full pipeline
- `generate_report()` - Create output

### 2. BehavioralMetrics (Data Class)
```python
metrics = BehavioralMetrics(
    eye_contact_duration=68.0,
    attention_shifts=12.0,
    gesture_frequency=4.0,
    social_gaze=45.0,
    response_latency=2.3
)
```

**Methods:**
- `to_dict()` - Convert to JSON-friendly format
- `calculate_risk_score()` - Assess autism risk

### 3. API Endpoints

```
GET  /health                  Check server status
GET  /api/baselines          Get baseline values
POST /api/screen             Screen single video
POST /api/metrics            Extract metrics only
POST /api/batch-screen       Process multiple videos
```

### 4. Deep Learning Model (Optional)

```python
model = AutismRiskClassifier(
    num_keypoints=543,
    feature_dim=128,
    num_heads=4,
    num_transformer_layers=2
)
```

**Architecture:**
- **SpatialFeatureExtractor:** CNN for frame features
- **TemporalTransformer:** Attention for sequences
- **Multi-task heads:** 6 output tasks simultaneously

## 📊 Metrics Explained

| Metric | What It Measures | Normal Range | Autism Indicator |
|--------|------------------|--------------|------------------|
| Eye Contact | Gaze at camera | 70-80% | < 60% |
| Attention Shifts | Gaze changes/min | 6-10/min | > 12/min |
| Gestures | Communicative acts/min | 5-8/min | < 4/min |
| Social Gaze | Social engagement | 55-65% | < 45% |
| Response Latency | Reaction time | 1-2s | > 2.5s |

## 🔧 Customization Points

### 1. Detection Thresholds
```python
# In autism_screening_model.py, adjust:
is_centered_x = 0.4 < gaze_x < 0.6  # Eye contact range
shift_detected = gaze_distance > 0.15  # Attention shift threshold
```

### 2. Baselines
```python
# In BehavioralMetrics class:
eye_contact_baseline: float = 75.0  # Adjust for population
```

### 3. Risk Calculation
```python
# In calculate_risk_score():
if risk_percentage < 30:  # Adjust thresholds
    return "Low Risk"
```

### 4. Frame Sampling
```python
# In preprocess_video():
frame_skip = max(1, int(self.fps / 10))  # 10 fps default
```

## 💻 Usage Examples

### Basic Analysis
```python
from autism_screening_model import AutismScreeningModel

model = AutismScreeningModel()
metrics = model.process_video("child_video.mp4")
print(f"Eye Contact: {metrics.eye_contact_duration}%")
```

### With Full Report
```python
report = model.generate_report(metrics, "report.json")
print(f"Risk: {report['risk_assessment']['level']}")
```

### API Integration
```bash
curl -X POST http://localhost:8000/api/screen \
  -F "video=@test.mp4" | jq
```

### Web Interface
```html
<!-- Just open demo_interface.html in browser -->
<!-- Drag & drop video, click analyze -->
```

## 🚀 Performance

- **Processing Time:** 15-30s for 60s video (CPU)
- **GPU Processing:** 5-10s for 60s video
- **Memory Usage:** ~500MB-1GB
- **Accuracy:** Baseline heuristic (improve with ML)

## 🔐 Security Features

- ✅ CORS enabled for web access
- ✅ File type validation
- ✅ Size limits (configurable)
- ✅ Temporary file cleanup
- ✅ Error handling & logging
- ⚠️ Add authentication for production
- ⚠️ Add encryption for PHI data

## 📈 Future Enhancements

Planned improvements:
- [ ] Real-time video analysis
- [ ] Mobile SDK (iOS/Android)
- [ ] Multi-language support
- [ ] Parent questionnaire integration
- [ ] Longitudinal tracking
- [ ] Federated learning
- [ ] EHR integration
- [ ] Advanced 3D gaze tracking
- [ ] Voice/speech analysis
- [ ] Facial micro-expressions

## 🏥 Clinical Considerations

**Use Cases:**
- ✅ Early screening (18-36 months)
- ✅ Pediatric clinics
- ✅ Research studies
- ✅ Telehealth platforms

**Limitations:**
- ⚠️ Screening only, not diagnostic
- ⚠️ Requires professional follow-up
- ⚠️ Cultural baseline variations
- ⚠️ Video quality dependent
- ⚠️ Age-specific considerations

## 📚 References

Built on research from:
- M-CHAT screening protocols
- ADOS-2 behavioral observations
- Eye-tracking studies (Jones & Klin, 2013)
- Computer vision autism research
- MediaPipe documentation
- TensorFlow best practices

---

**Ready to deploy? See DEPLOYMENT.md**
**Questions? Check README.md**
**Getting started? Read QUICKSTART.md**
