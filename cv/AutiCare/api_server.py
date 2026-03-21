"""
FastAPI server for Autism Screening Model
Provides REST API endpoints for video upload and analysis
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import os
from pathlib import Path
import tempfile
from autism_screening_model import AutismScreeningModel, BehavioralMetrics
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AutiCare AI Screening API",
    description="AI-powered early autism screening from behavioral video analysis",
    version="1.0.0"
)

# Configure CORS for web app integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance (loaded once at startup)
screening_model = None

# Create temporary directory for uploads
UPLOAD_DIR = Path("./temp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Initialize the screening model on server startup"""
    global screening_model
    logger.info("Initializing Autism Screening Model...")
    screening_model = AutismScreeningModel()
    logger.info("Model initialized successfully!")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on server shutdown"""
    # Clean up temporary files
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "AutiCare AI Screening API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "model_loaded": screening_model is not None,
        "endpoints": {
            "screening": "/api/screen",
            "metrics": "/api/metrics"
        }
    }


@app.post("/api/screen")
async def screen_video(
    video: UploadFile = File(...),
    save_report: bool = False
):
    """
    Main screening endpoint
    
    Upload a video file for autism screening analysis
    
    Args:
        video: MP4 video file (ideally 30-60 seconds)
        save_report: Whether to save detailed JSON report
    
    Returns:
        Complete screening report with risk assessment and behavioral metrics
    """
    
    if not screening_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Validate file type
    if not video.filename.endswith(('.mp4', '.avi', '.mov')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload MP4, AVI, or MOV video."
        )
    
    # Save uploaded file temporarily
    temp_file_path = UPLOAD_DIR / f"temp_{video.filename}"
    
    try:
        # Save uploaded video
        with temp_file_path.open("wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        logger.info(f"Processing video: {video.filename}")
        
        # Run screening analysis
        metrics = screening_model.process_video(str(temp_file_path))
        
        # Calculate risk assessment
        risk_level, confidence = metrics.calculate_risk_score()
        
        # Generate report
        report_path = None
        if save_report:
            report_path = f"screening_report_{video.filename.split('.')[0]}.json"
        
        report = screening_model.generate_report(metrics, output_path=report_path)
        
        logger.info(f"Analysis complete: {risk_level}")
        
        return JSONResponse(content=report)
    
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    
    finally:
        # Clean up temporary file
        if temp_file_path.exists():
            temp_file_path.unlink()


@app.post("/api/metrics")
async def get_metrics_only(video: UploadFile = File(...)):
    """
    Extract only behavioral metrics without full report
    Faster endpoint for real-time analysis
    """
    
    if not screening_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    temp_file_path = UPLOAD_DIR / f"temp_{video.filename}"
    
    try:
        with temp_file_path.open("wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        metrics = screening_model.process_video(str(temp_file_path))
        
        return JSONResponse(content=metrics.to_dict())
    
    except Exception as e:
        logger.error(f"Error extracting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if temp_file_path.exists():
            temp_file_path.unlink()


@app.get("/api/baselines")
async def get_baselines():
    """
    Get baseline values for all behavioral metrics
    Useful for UI display
    """
    return {
        "eye_contact_duration": {
            "baseline": 75.0,
            "unit": "percentage",
            "description": "Percentage of time making eye contact with camera"
        },
        "attention_shifts": {
            "baseline": 8.0,
            "unit": "per_minute",
            "description": "Number of gaze direction changes per minute"
        },
        "gesture_frequency": {
            "baseline": 6.0,
            "unit": "per_minute",
            "description": "Communicative gestures per minute"
        },
        "social_gaze": {
            "baseline": 60.0,
            "unit": "percentage",
            "description": "Percentage of time engaged in social gaze"
        },
        "response_latency": {
            "baseline": 1.5,
            "unit": "seconds",
            "description": "Average time to respond to stimuli"
        }
    }


@app.post("/api/batch-screen")
async def batch_screen(videos: list[UploadFile] = File(...)):
    """
    Batch processing endpoint for multiple videos
    Useful for research or clinic settings
    """
    
    if not screening_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    
    for video in videos:
        temp_file_path = UPLOAD_DIR / f"temp_{video.filename}"
        
        try:
            with temp_file_path.open("wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
            
            metrics = screening_model.process_video(str(temp_file_path))
            risk_level, confidence = metrics.calculate_risk_score()
            
            results.append({
                "filename": video.filename,
                "risk_level": risk_level,
                "confidence": confidence,
                "metrics": metrics.to_dict()
            })
        
        except Exception as e:
            results.append({
                "filename": video.filename,
                "error": str(e)
            })
        
        finally:
            if temp_file_path.exists():
                temp_file_path.unlink()
    
    return JSONResponse(content={"results": results})


if __name__ == "__main__":
    import uvicorn
    
    # Run server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
