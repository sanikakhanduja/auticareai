# Deployment Guide - AutiCare AI Screening System

## 📦 Production Deployment Options

### Option 1: Cloud Deployment (Recommended)

#### AWS Deployment

**1. Using AWS EC2**

```bash
# Launch EC2 instance (recommend: t3.xlarge or better)
# Ubuntu 22.04 LTS, GPU instance for faster processing

# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3.9 python3-pip
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0  # OpenCV deps

# Clone repository
git clone https://github.com/yourusername/auticareai.git
cd auticareai

# Install Python packages
pip3 install -r requirements.txt

# Run with gunicorn for production
pip3 install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker api_server:app --bind 0.0.0.0:8000
```

**2. Using AWS Lambda + API Gateway**

```python
# For serverless deployment
# Create lambda_handler.py

import json
import base64
from autism_screening_model import AutismScreeningModel
import tempfile
import os

model = AutismScreeningModel()

def lambda_handler(event, context):
    try:
        # Decode video from base64
        video_data = base64.b64decode(event['body'])
        
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
            tmp.write(video_data)
            tmp_path = tmp.name
        
        # Process
        metrics = model.process_video(tmp_path)
        risk_level, confidence = metrics.calculate_risk_score()
        
        # Cleanup
        os.unlink(tmp_path)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'risk_level': risk_level,
                'confidence': confidence,
                'metrics': metrics.to_dict()
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

**3. Using AWS ECS (Container)**

```dockerfile
# Dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and deploy
docker build -t auticareai .
docker run -p 8000:8000 auticareai

# Push to ECR
aws ecr create-repository --repository-name auticareai
docker tag auticareai:latest YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/auticareai:latest
docker push YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/auticareai:latest

# Deploy to ECS
# Use AWS Console or CLI to create ECS service
```

#### Google Cloud Platform

```bash
# Using Cloud Run (serverless containers)

# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/auticareai

# Deploy
gcloud run deploy auticareai \
  --image gcr.io/YOUR_PROJECT_ID/auticareai \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --timeout 300s \
  --allow-unauthenticated
```

#### Azure

```bash
# Using Azure Container Instances

# Login
az login

# Create resource group
az group create --name auticareai-rg --location eastus

# Deploy container
az container create \
  --resource-group auticareai-rg \
  --name auticareai \
  --image YOUR_REGISTRY/auticareai:latest \
  --cpu 2 \
  --memory 4 \
  --ports 8000 \
  --environment-variables API_KEY=your-key
```

### Option 2: On-Premise Deployment

**For Hospitals/Clinics**

```bash
# Install on local server
# Recommended: Ubuntu 20.04+, 16GB RAM, 4+ cores

# 1. System setup
sudo apt-get update
sudo apt-get install -y python3.9 nginx

# 2. Application setup
cd /opt
sudo git clone https://github.com/yourusername/auticareai.git
cd auticareai
sudo pip3 install -r requirements.txt

# 3. Create systemd service
sudo nano /etc/systemd/system/auticareai.service
```

```ini
[Unit]
Description=AutiCare AI Screening Service
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/auticareai
Environment="PATH=/usr/local/bin"
ExecStart=/usr/local/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker api_server:app --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 4. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/auticareai
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Increase timeouts for video processing
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Increase max upload size
        client_max_body_size 100M;
    }
}
```

```bash
# 5. Enable and start services
sudo systemctl enable auticareai
sudo systemctl start auticareai
sudo systemctl enable nginx
sudo systemctl restart nginx

# 6. Setup SSL with Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 3: Mobile Backend (For React Native App)

**Backend Configuration**

```python
# mobile_api.py - Optimized for mobile clients

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

app = FastAPI()

# Configure for mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/mobile/screen")
async def mobile_screen(
    video: UploadFile = File(...),
    compress: bool = True,
    quick_mode: bool = False
):
    """
    Mobile-optimized screening endpoint
    - Supports compression for bandwidth
    - Quick mode for faster results
    """
    # ... implementation
    pass

@app.get("/mobile/progress/{job_id}")
async def get_progress(job_id: str):
    """
    Progress tracking for long-running analyses
    """
    # ... implementation
    pass
```

## 🔒 Security Considerations

### 1. HIPAA Compliance (For Healthcare)

```python
# Add encryption for data at rest and in transit

# requirements.txt additions:
# cryptography==41.0.0
# python-jose[cryptography]==3.3.0

from cryptography.fernet import Fernet
import os

# Encryption for stored videos
class SecureStorage:
    def __init__(self):
        self.key = os.environ.get('ENCRYPTION_KEY').encode()
        self.cipher = Fernet(self.key)
    
    def encrypt_video(self, video_data: bytes) -> bytes:
        return self.cipher.encrypt(video_data)
    
    def decrypt_video(self, encrypted_data: bytes) -> bytes:
        return self.cipher.decrypt(encrypted_data)

# Use in API
storage = SecureStorage()

@app.post("/secure/screen")
async def secure_screen(video: UploadFile):
    # Encrypt immediately upon upload
    video_data = await video.read()
    encrypted = storage.encrypt_video(video_data)
    
    # Process...
    # Delete after processing
```

### 2. API Authentication

```python
# Add JWT authentication

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta

SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
ALGORITHM = "HS256"

security = HTTPBearer()

def create_access_token(user_id: str):
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/api/screen")
async def authenticated_screen(
    video: UploadFile,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user_id = verify_token(credentials)
    # Process with user_id for audit trail
```

### 3. Rate Limiting

```python
# Add rate limiting

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/screen")
@limiter.limit("5/hour")  # 5 requests per hour per IP
async def rate_limited_screen(request: Request, video: UploadFile):
    # ... process
    pass
```

## 📊 Monitoring & Logging

### Application Performance Monitoring

```python
# Add Sentry for error tracking

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,
)

# Add custom logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auticareai.log'),
        logging.StreamHandler()
    ]
)
```

### Prometheus Metrics

```python
# Add prometheus metrics

from prometheus_client import Counter, Histogram, make_asgi_app
from prometheus_fastapi_instrumentator import Instrumentator

# Add metrics
videos_processed = Counter('videos_processed_total', 'Total videos processed')
processing_time = Histogram('video_processing_seconds', 'Time to process video')

# Instrument app
Instrumentator().instrument(app).expose(app)

@app.post("/api/screen")
async def monitored_screen(video: UploadFile):
    with processing_time.time():
        # ... process
        videos_processed.inc()
```

## 🚀 Performance Optimization

### 1. GPU Acceleration

```python
# For TensorFlow/PyTorch models
import tensorflow as tf

# Configure GPU
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)
```

### 2. Model Optimization

```bash
# Convert to ONNX for faster inference
pip install onnx tf2onnx

python -m tf2onnx.convert \
    --saved-model saved_model_dir \
    --output model.onnx

# Use ONNX Runtime
pip install onnxruntime-gpu
```

### 3. Caching

```python
# Add Redis caching for repeated analyses

import redis
import hashlib
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_video_hash(video_data: bytes) -> str:
    return hashlib.sha256(video_data).hexdigest()

@app.post("/api/screen")
async def cached_screen(video: UploadFile):
    video_data = await video.read()
    video_hash = get_video_hash(video_data)
    
    # Check cache
    cached = redis_client.get(f"result:{video_hash}")
    if cached:
        return json.loads(cached)
    
    # Process
    result = process_video(video_data)
    
    # Cache result (expire after 24 hours)
    redis_client.setex(
        f"result:{video_hash}",
        86400,
        json.dumps(result)
    )
    
    return result
```

## 📱 Integration Examples

### Frontend (React)

```jsx
// components/VideoUpload.jsx
import React, { useState } from 'react';
import axios from 'axios';

function VideoUpload() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post(
        'https://your-api.com/api/screen',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log(`Upload Progress: ${percentCompleted}%`);
          }
        }
      );
      
      setResult(response.data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? 'Analyzing...' : 'Upload & Analyze'}
      </button>
      
      {result && (
        <div>
          <h3>Results:</h3>
          <p>Risk Level: {result.risk_assessment.level}</p>
          <p>Confidence: {(result.risk_assessment.confidence * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}
```

## 🔧 Troubleshooting

### Common Issues

**1. MediaPipe Installation Fails**
```bash
# If pip install fails, try:
pip install --upgrade pip
pip install mediapipe --no-cache-dir
```

**2. OpenCV Issues**
```bash
# Install system dependencies
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0
```

**3. Out of Memory**
```python
# Reduce batch size or frame sampling rate
frame_skip = max(1, int(self.fps / 5))  # Sample 5 fps instead of 10
```

**4. Slow Processing**
```bash
# Use GPU-enabled TensorFlow
pip install tensorflow-gpu

# Or use model quantization
```

---

**For support**: [your-email@domain.com]
