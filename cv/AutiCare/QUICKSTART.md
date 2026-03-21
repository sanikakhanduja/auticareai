# 🚀 Quick Start Guide - AutiCare AI

Get your autism screening model up and running in 5 minutes!

## ✅ Step 1: Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# This will install:
# - opencv-python (video processing)
# - mediapipe (pose/face/hand detection)
# - tensorflow (deep learning)
# - fastapi (API server)
# - And more...
```

## ✅ Step 2: Test the Model

Run the test suite to make sure everything works:

```bash
python test_model.py
```

This will:
- ✓ Initialize the screening model
- ✓ Create a test video
- ✓ Process it through the full pipeline
- ✓ Generate a sample report

## ✅ Step 3: Analyze Your First Video

### Option A: Command Line

```bash
python autism_screening_model.py your_video.mp4
```

### Option B: Python Script

```python
from autism_screening_model import AutismScreeningModel

# Initialize
model = AutismScreeningModel()

# Process video
metrics = model.process_video("your_video.mp4")

# Generate report
report = model.generate_report(metrics, output_path="report.json")

print(f"Risk: {report['risk_assessment']['level']}")
```

## ✅ Step 4: Start the API Server (Optional)

For web/mobile integration:

```bash
# Start the server
python api_server.py

# Server runs at http://localhost:8000
```

Then open `demo_interface.html` in your browser to use the web interface!

## ✅ Step 5: Upload and Test

Using the web interface:
1. Open `demo_interface.html` in Chrome/Firefox
2. Click "Upload Video" or drag & drop
3. Click "Analyze Video"
4. View results!

Using API (curl):
```bash
curl -X POST "http://localhost:8000/api/screen" \
  -F "video=@test_video.mp4"
```

---

## 📊 Understanding the Results

Your analysis will show 5 key metrics:

### 1. Eye Contact Duration (Baseline: 75%)
- **What it measures:** How much time the child makes eye contact
- **Why it matters:** Reduced eye contact is an early autism marker

### 2. Attention Shifts (Baseline: 8/min)
- **What it measures:** How often gaze direction changes
- **Why it matters:** Excessive shifting may indicate attention difficulties

### 3. Gesture Frequency (Baseline: 6/min)
- **What it measures:** Communicative gestures (pointing, waving)
- **Why it matters:** Reduced gestures suggests communication challenges

### 4. Social Gaze (Baseline: 60%)
- **What it measures:** Looking at social cues
- **Why it matters:** Shows social awareness and joint attention

### 5. Response Latency (Baseline: 1.5s)
- **What it measures:** Time to respond to stimuli
- **Why it matters:** Delayed responses may indicate processing differences

---

## 🎥 Video Guidelines

For best results, record:

✅ **Duration:** 30-120 seconds
✅ **Angle:** Front-facing view of child's face
✅ **Lighting:** Good, even lighting
✅ **Activity:** Child interacting with parent/caregiver or toys
✅ **Format:** MP4, AVI, or MOV

**Good scenarios:**
- Parent-child play
- Response to name calling
- Toy play
- Book reading
- Free play

---

## 🛠️ Troubleshooting

### "ModuleNotFoundError: No module named 'cv2'"
```bash
pip install opencv-python
```

### "ModuleNotFoundError: No module named 'mediapipe'"
```bash
pip install mediapipe
```

### "API server not running"
```bash
# Make sure server is started:
python api_server.py

# Should see: "Uvicorn running on http://0.0.0.0:8000"
```

### "Processing takes too long"
- Use shorter videos (30-60 seconds)
- Reduce frame sampling rate in code
- Use GPU if available

### "Low accuracy / strange results"
- This is a baseline heuristic model
- Train the deep learning classifier with real data for better results
- See `deep_learning_classifier.py`

---

## 📱 Integrating with Your App

### React/Next.js

```javascript
async function analyzeVideo(videoFile) {
  const formData = new FormData();
  formData.append('video', videoFile);
  
  const response = await fetch('http://your-api.com/api/screen', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}
```

### React Native

```javascript
import DocumentPicker from 'react-native-document-picker';

const uploadVideo = async () => {
  const video = await DocumentPicker.pick({
    type: [DocumentPicker.types.video],
  });
  
  const formData = new FormData();
  formData.append('video', {
    uri: video.uri,
    type: video.type,
    name: video.name,
  });
  
  const response = await fetch('YOUR_API/api/screen', {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
};
```

### Flutter

```dart
import 'package:http/http.dart' as http;
import 'package:file_picker/file_picker.dart';

Future<Map> analyzeVideo() async {
  FilePickerResult? result = await FilePicker.platform.pickFiles(
    type: FileType.video,
  );
  
  if (result != null) {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('YOUR_API/api/screen'),
    );
    
    request.files.add(
      await http.MultipartFile.fromPath('video', result.files.single.path!),
    );
    
    var response = await request.send();
    var responseData = await response.stream.toBytes();
    var responseString = String.fromCharCodes(responseData);
    
    return jsonDecode(responseString);
  }
}
```

---

## 🔥 Next Steps

1. **Test with real videos:** Try with actual child behavioral videos
2. **Customize baselines:** Adjust thresholds based on your population
3. **Train ML model:** Use labeled data to train the deep learning classifier
4. **Deploy:** Follow DEPLOYMENT.md for production deployment
5. **Integrate:** Connect to your existing app/platform

---

## ⚠️ Important Reminders

1. **This is a screening tool, NOT a diagnostic tool**
2. **Results must be reviewed by healthcare professionals**
3. **For research/educational purposes**
4. **Obtain proper consent before processing videos**
5. **Follow privacy regulations (HIPAA, GDPR, etc.)**

---

## 📚 Documentation

- **README.md** - Full documentation
- **DEPLOYMENT.md** - Production deployment guide
- **deep_learning_classifier.py** - Advanced ML training
- **api_server.py** - API documentation

---

## 🤝 Need Help?

- Check the full README.md
- Run test_model.py to validate setup
- Review example code in the files
- Open an issue on GitHub

---

**Built with ❤️ for early intervention and better outcomes**

Made possible by: MediaPipe, TensorFlow, OpenCV, FastAPI
