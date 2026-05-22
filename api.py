from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import io
from PIL import Image
import numpy as np
from typing import List, Optional

# Database support imports
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import pymysql
from sqlalchemy.engine.url import make_url
from datetime import datetime

# Load environment variables at startup
load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL") or "mysql+pymysql://root:@localhost/thyroid_db"

def ensure_mysql_db_exists(db_url):
    if db_url and (db_url.startswith("mysql+pymysql://") or db_url.startswith("mysql://")):
        try:
            url_obj = make_url(db_url)
            db_name = url_obj.database
            if not db_name:
                print("WARNING: No database name specified in MySQL connection URL.")
                return
            # Connect to MySQL server (without database name)
            connection = pymysql.connect(
                host=url_obj.host or 'localhost',
                user=url_obj.username or 'root',
                password=url_obj.password or '',
                port=url_obj.port or 3306
            )
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`")
                connection.commit()
                print(f"SUCCESS: Verified/Created MySQL database: '{db_name}'", flush=True)
            finally:
                connection.close()
        except Exception as e:
            print(f"WARNING: Automatic MySQL database creation check failed: {e}", flush=True)

# Ensure database exists
ensure_mysql_db_exists(DATABASE_URL)

# SQLAlchemy Database Engine setup
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ScanModel(Base):
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    prediction = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    level = Column(String(50), nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="Thyroid Ultrasound AI API", version="1.0")

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Doctor(BaseModel):
    name: str
    hospital: str
    phone: str

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    message: str
    level: Optional[str] = None
    doctors: List[Doctor] = []

class ChatRequest(BaseModel):
    message: str

class ScanHistoryResponse(BaseModel):
    id: int
    filename: str
    prediction: str
    confidence: float
    level: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

@app.get("/")
def read_root():
    return {"message": "Thyroid Detection API is running!"}

FALLBACK_RESPONSES = {
    "nodule": "A thyroid nodule is a lump that forms within the thyroid gland. Most nodules are benign (non-cancerous) and don't cause symptoms. However, some may need further evaluation with ultrasound, blood tests, or a fine-needle biopsy to rule out thyroid cancer.",
    "abnormal": "An 'Abnormal' result means the AI detected patterns consistent with a thyroid nodule. This does NOT automatically mean cancer — most nodules are benign. Please consult an endocrinologist for a proper clinical evaluation including blood work and possibly a biopsy.",
    "ultrasound": "To prepare for a thyroid ultrasound: no special preparation is needed. Wear a comfortable shirt with an open neck. The procedure is painless, takes about 15-20 minutes, and uses sound waves to create images of your thyroid gland.",
    "food": "Foods that support thyroid health include: iodine-rich foods (seafood, dairy, iodized salt), selenium-rich foods (Brazil nuts, tuna, eggs), and zinc-rich foods (oysters, beef, pumpkin seeds). Avoid excessive soy and raw cruciferous vegetables if you have thyroid issues.",
    "doctor": "You should see an endocrinologist if you notice a lump in your neck, have difficulty swallowing, experience unexplained weight changes, feel persistent fatigue, or if your AI scan shows abnormal results. Early consultation leads to better outcomes.",
    "tsh": "TSH (Thyroid Stimulating Hormone) is the primary blood test for thyroid function. Normal range is typically 0.4-4.0 mIU/L. High TSH may indicate hypothyroidism (underactive thyroid), while low TSH may indicate hyperthyroidism (overactive thyroid).",
    "symptom": "Common thyroid disorder symptoms include: fatigue, weight changes, hair loss, sensitivity to cold/heat, mood changes, irregular heartbeat, and neck swelling. If you experience these, consult your doctor for a TSH blood test.",
    "treatment": "Thyroid treatment depends on the condition: Hypothyroidism is treated with levothyroxine (synthetic T4). Hyperthyroidism may be treated with anti-thyroid medications, radioactive iodine, or surgery. Thyroid nodules may require monitoring, biopsy, or surgical removal.",
}

def get_fallback_reply(message: str) -> str:
    msg_lower = message.lower()
    for keyword, response in FALLBACK_RESPONSES.items():
        if keyword in msg_lower:
            return response
    return f"Thank you for your question about: '{message}'. I'm your Thyroid AI assistant. I can answer questions about thyroid nodules, TSH levels, symptoms, ultrasound preparation, diet tips, and when to see a doctor. Try asking about one of these topics!"

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # First try using Gemini API
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        
        # Check if the API key is present and not the default placeholder
        if api_key and api_key != "your_gemini_api_key_here":
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.0-flash')
            prompt = "You are a professional medical AI assistant specialized in thyroid health. Please provide a clear, concise, and helpful response to the following query: " + request.message
            response = model.generate_content(prompt)
            return {"reply": response.text}
    except Exception:
        pass
    
    # Fallback: provide intelligent built-in responses
    return {"reply": get_fallback_reply(request.message)}

@app.post("/predict", response_model=PredictionResponse)
async def predict_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    try:
        # Read the image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Preprocess the image (resize to match EfficientNetB3 expected input)
        image = image.resize((224, 224))
        image_array = np.array(image) / 255.0
        image_array = np.expand_dims(image_array, axis=0) # Add batch dimension

        if TF_AVAILABLE:
            # Here you would load your trained model:
            # model = tf.keras.models.load_model('models/thyroid_cv_model.h5')
            # For now, we mock the prediction logic since the model isn't trained yet.
            
            # Mock Prediction Logic:
            # Random confidence score for demonstration (forced above 0.85 to show 'Danger' doctor details)
            confidence = float(np.random.uniform(0.86, 0.99))
            
            # Mock threshold
            if confidence > 0.85:
                result = "Abnormal (Nodule Detected)"
                message = "High probability of thyroid abnormality. Please consult an endocrinologist."
                
                # Determine level based on confidence mock
                if confidence > 0.95:
                    level = "Severe (Stage III/IV)"
                elif confidence > 0.90:
                    level = "Moderate (Stage II)"
                else:
                    level = "Mild (Stage I)"
                    
                doctors = [
                    Doctor(name="Dr. Sarah Jenkins", hospital="City General Hospital", phone="+1 (555) 123-4567"),
                    Doctor(name="Dr. Michael Chen", hospital="Metro Health Medical Center", phone="+1 (555) 987-6543"),
                    Doctor(name="Dr. Emily Rodriguez", hospital="Endocrinology Specialists Clinic", phone="+1 (555) 456-7890")
                ]
            else:
                result = "Normal"
                message = "Thyroid appears normal based on the ultrasound scan."
                level = None
                doctors = []
            
            # Save prediction to local MySQL database
            db_scan = ScanModel(
                filename=file.filename,
                prediction=result,
                confidence=round(confidence * 100, 2),
                level=level,
                message=message
            )
            db.add(db_scan)
            db.commit()
            db.refresh(db_scan)
                
            return PredictionResponse(
                prediction=result,
                confidence=round(confidence * 100, 2),
                message=message,
                level=level,
                doctors=doctors
            )
        else:
            result = "Mock Prediction (TensorFlow not ready)"
            confidence = 85.5
            message = "Please wait for TensorFlow to finish installing."
            level = None
            
            # Save prediction to local MySQL database
            db_scan = ScanModel(
                filename=file.filename,
                prediction=result,
                confidence=confidence,
                level=level,
                message=message
            )
            db.add(db_scan)
            db.commit()
            db.refresh(db_scan)
            
            return PredictionResponse(
                prediction=result,
                confidence=confidence,
                message=message,
                level=level,
                doctors=[]
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history", response_model=List[ScanHistoryResponse])
def get_history(db: Session = Depends(get_db)):
    scans = db.query(ScanModel).order_by(ScanModel.created_at.desc()).all()
    return [
        ScanHistoryResponse(
            id=s.id,
            filename=s.filename,
            prediction=s.prediction,
            confidence=s.confidence,
            level=s.level,
            created_at=s.created_at
        ) for s in scans
    ]

@app.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    db.query(ScanModel).delete()
    db.commit()
    return {"message": "All history deleted successfully"}

@app.delete("/history/{scan_id}")
def delete_scan(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(ScanModel).filter(ScanModel.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    db.delete(scan)
    db.commit()
    return {"message": f"Scan {scan_id} deleted successfully"}

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

