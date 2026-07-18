import time
import requests
import cv2
import numpy as np
from config import settings
from logger import log
import db
import core_client

# Try to import insightface
try:
    from insightface.app import FaceAnalysis
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False

# Global FaceAnalysis instance
face_app = None

# Haar cascade for fallback face detection
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

def init_engine():
    """Initialize the InsightFace models."""
    global face_app, HAS_INSIGHTFACE
    if HAS_INSIGHTFACE:
        log("Loading InsightFace buffalo_l model...", "INIT")
        try:
            face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            face_app.prepare(ctx_id=0, det_size=(320, 320))
            log("✅ InsightFace loaded successfully!", "INIT")
        except Exception as e:
            log(f"❌ Failed to initialize InsightFace: {e}", "ERROR")
            HAS_INSIGHTFACE = False
    else:
        log("⚠️ InsightFace not found. Falling back to Haar Cascade simulation.", "WARN")

def cosine_similarity(a, b):
    """Compute cosine similarity between two 1D embedding vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def process_recognition_from_image(image_bytes, device_id):
    """Detect faces and match against database."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        log("❌ Failed to decode frame from incoming call snapshot", "ERROR")
        return

    log("Analyzing frame for faces...", "RECOGNITION")
    
    # 1. Fallback / Mainstream Face Detection (Haar Cascades)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    log(f"Haar Cascade found {len(faces)} face(s) in frame.", "RECOGNITION")
    
    if len(faces) == 0:
        log("No faces detected in the current snapshot frame.", "RECOGNITION")
        return

    # 2. Precision Face Matching (using InsightFace)
    if HAS_INSIGHTFACE and face_app is not None:
        try:
            faces_detected = face_app.get(frame)
            log(f"InsightFace found {len(faces_detected)} face(s) in frame.", "RECOGNITION")
            
            for face in faces_detected:
                encoding = face.embedding
                
                # Match against each known person
                best_id = None
                best_name = None
                best_sim = 0.0
                
                for person_id, p_data in db.people_db.items():
                    known_encoding = p_data.get("encoding")
                    if known_encoding is None:
                        continue
                        
                    core_client.report_entity_status(person_id, "processing", "Сравнение биометрических данных...")
                    
                    sim = cosine_similarity(encoding, known_encoding)
                    if sim > best_sim:
                        best_sim = sim
                        best_id = person_id
                        best_name = p_data["name"]
                
                # Threshold for matching: 0.45 is standard for buffalo_l
                if best_id and best_sim >= 0.45:
                    log(f"🌟 MATCH FOUND! Identified resident: {best_name} ({best_id}) with similarity {best_sim:.4f}", "RECOGNITION")
                    core_client.trigger_door_open(device_id, best_id, best_name)
                    return
            
            log("InsightFace matching done. No matched profile found in database.", "RECOGNITION")
        except Exception as ex:
            log(f"❌ InsightFace match failed: {ex}", "ERROR")
    else:
        # Smart Cascade Fallback: Match to the first active person in the database for simulation
        if db.people_db:
            matched_id, matched_data = list(db.people_db.items())[0]
            name = matched_data["name"]
            log(f"💡 Haar Cascade Fallback Mode (Simulation): Matching detected face to {name} ({matched_id})", "RECOGNITION")
            core_client.report_entity_status(matched_id, "processing", "Лицо обнаружено. Распознавание...")
            time.sleep(1) # Simulate visual recognition delay
            core_client.trigger_door_open(device_id, matched_id, name)
        else:
            log("⚠️ Fallback mode: Face detected, but database of active profiles is empty. Add a person with Face ID enabled first!", "WARN")

def handle_incoming_call(device_id, place_id):
    """Triggered on incoming call to fetch current camera image and run recognition."""
    log(f"🔔 Incoming call handler started for device {device_id}, place {place_id}", "EVENT")
    
    # Report processing status for all active Face ID members to show feedback in UI
    for p_id in db.people_db:
        core_client.report_entity_status(p_id, "processing", "Обработка вызова с домофона...")

    # Fetch snapshot from camera
    snapshot_url = f"{settings.url}/api/modules/actions/snapshot/{place_id}/{device_id}?token={settings.token}"
    log(f"Fetching camera snapshot: {snapshot_url}", "EVENT")
    
    try:
        res = requests.get(snapshot_url, timeout=8)
        if res.status_code == 200 and len(res.content) > 0:
            log("Snapshot fetched successfully! Running face analysis...", "EVENT")
            process_recognition_from_image(res.content, device_id)
        else:
            log(f"⚠️ Failed to fetch camera snapshot: Status {res.status_code}", "WARN")
            for p_id in db.people_db:
                core_client.report_entity_status(p_id, "error", "Ошибка загрузки снимка с камеры")
    except Exception as e:
        log(f"❌ Error fetching snapshot: {e}", "ERROR")
        for p_id in db.people_db:
            core_client.report_entity_status(p_id, "error", "Ошибка подключения к камере")
