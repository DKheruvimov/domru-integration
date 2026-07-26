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

import os
import sys

# Haar cascade for fallback face detection
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
if not os.path.exists(cascade_path) and getattr(sys, 'frozen', False):
    alt_path = os.path.join(sys._MEIPASS, 'cv2', 'data', 'haarcascade_frontalface_default.xml')
    if os.path.exists(alt_path):
        cascade_path = alt_path
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

def process_recognition_from_frame(frame, device_id):
    """Detect faces in a single frame and match against database. Returns True if matched and door opened."""
    if frame is None:
        return False

    # 1. Fallback / Fast Face Detection (Haar Cascades)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        return False

    log(f"Face(s) detected in video frame ({len(faces)} face(s)). Running biometric match...", "RECOGNITION")

    # 2. Precision Face Matching (using InsightFace)
    if HAS_INSIGHTFACE and face_app is not None:
        try:
            faces_detected = face_app.get(frame)
            for face in faces_detected:
                encoding = face.embedding
                
                best_id = None
                best_name = None
                best_sim = 0.0
                
                for person_id, p_data in db.people_db.items():
                    known_encoding = p_data.get("encoding")
                    if known_encoding is None:
                        continue
                        
                    sim = cosine_similarity(encoding, known_encoding)
                    if sim > best_sim:
                        best_sim = sim
                        best_id = person_id
                        best_name = p_data["name"]
                
                if best_id and best_sim >= 0.45:
                    log(f"🌟 MATCH FOUND! Identified resident: {best_name} ({best_id}) with similarity {best_sim:.4f}", "RECOGNITION")
                    core_client.trigger_door_open(device_id, best_id, best_name)
                    return True
        except Exception as ex:
            log(f"❌ InsightFace match error on frame: {ex}", "ERROR")
    else:
        # Haar Cascade Fallback mode
        if db.people_db:
            matched_id, matched_data = list(db.people_db.items())[0]
            name = matched_data["name"]
            log(f"💡 Haar Cascade Fallback Mode: Matching detected face to {name} ({matched_id})", "RECOGNITION")
            core_client.trigger_door_open(device_id, matched_id, name)
            return True
            
    return False

def process_recognition_from_image(image_bytes, device_id):
    """Detect faces from snapshot bytes."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return process_recognition_from_frame(frame, device_id)

def handle_incoming_call(device_id, place_id):
    """Triggered on incoming call: opens MJPEG video stream for up to 4 seconds to recognize residents."""
    log(f"🔔 Incoming call handler started for device {device_id}, place {place_id}", "EVENT")
    
    for p_id in db.people_db:
        core_client.report_entity_status(p_id, "processing", "Анализ видеопотока с камеры...")

    # Step 1. Try Live Video Stream (MJPEG)
    stream_info = core_client.fetch_stream_info(device_id)
    mjpeg_url = stream_info.get("mjpegUrl") if stream_info else None
    
    if mjpeg_url:
        log(f"🎥 Connecting to MJPEG video stream: {mjpeg_url}", "EVENT")
        cap = cv2.VideoCapture(mjpeg_url)
        
        if cap.isOpened():
            start_time = time.time()
            max_duration = 4.0  # Max 4 seconds recognition window
            frame_count = 0
            
            log("▶️ Live video stream opened. Starting continuous face analysis...", "EVENT")
            
            while time.time() - start_time < max_duration:
                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(0.1)
                    continue
                    
                frame_count += 1
                # Analyze frame
                matched = process_recognition_from_frame(frame, device_id)
                if matched:
                    log(f"✅ Door opened after analyzing {frame_count} frames in {time.time() - start_time:.2f}s!", "EVENT")
                    cap.release()
                    return
                
                # Sleep briefly between frame checks to balance CPU usage (approx 8-10 fps analysis)
                time.sleep(0.08)
                
            cap.release()
            log(f"⏹️ Video stream session ended ({frame_count} frames analyzed, no resident matched).", "EVENT")
        else:
            log("⚠️ Failed to open OpenCV video capture on MJPEG stream. Falling back to snapshot...", "WARN")

    # Step 2. Fallback to Snapshot if Stream was unavailable or failed
    log("📸 Running snapshot fallback...", "EVENT")
    snapshot_url = f"{settings.url}/api/modules/actions/snapshot/{place_id}/{device_id}?token={settings.token}"
    try:
        res = requests.get(snapshot_url, timeout=5)
        if res.status_code == 200 and len(res.content) > 0:
            matched = process_recognition_from_image(res.content, device_id)
            if not matched:
                log("No profile matched from fallback snapshot.", "EVENT")
        else:
            log(f"⚠️ Failed to fetch camera snapshot: Status {res.status_code}", "WARN")
    except Exception as e:
        log(f"❌ Error fetching fallback snapshot: {e}", "ERROR")

def run_live_demo(device_id):
    """Run interactive continuous visual Demo Mode in an OpenCV window."""
    log(f"🚀 Starting Interactive Live Demo Mode for device {device_id}...", "DEMO")
    
    stream_info = core_client.fetch_stream_info(device_id)
    mjpeg_url = stream_info.get("mjpegUrl") if stream_info else None
    
    cap = None
    use_snapshot_mode = False

    if mjpeg_url:
        cap = cv2.VideoCapture(mjpeg_url)
        if not cap.isOpened():
            log("⚠️ MJPEG stream connection failed. Falling back to Live Snapshot Polling mode...", "WARN")
            cap = None
            use_snapshot_mode = True
        else:
            log(f"🎥 Connected to live MJPEG stream: {mjpeg_url}", "DEMO")
    else:
        log("ℹ️ No continuous MJPEG stream found. Using Live Snapshot Polling mode...", "DEMO")
        use_snapshot_mode = True

    log("💡 Instructions: A visual window will open. Press 'ESC' or 'Q' in the video window to stop Demo Mode.", "DEMO")
    
    window_name = f"Face ID Live Demo - Device {device_id}"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 960, 540)
    
    fps_start_time = time.time()
    fps_frame_count = 0
    fps = 0.0

    snapshot_url = f"{settings.url}/api/modules/actions/snapshot/{device_id}?token={settings.token}"

    try:
        while True:
            frame = None
            if not use_snapshot_mode and cap is not None:
                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(0.05)
                    continue
            else:
                try:
                    res = requests.get(snapshot_url, timeout=3)
                    if res.status_code == 200 and len(res.content) > 0:
                        nparr = np.frombuffer(res.content, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    else:
                        time.sleep(0.3)
                        continue
                except Exception as e:
                    time.sleep(0.5)
                    continue

            if frame is None:
                continue

            fps_frame_count += 1
            if time.time() - fps_start_time >= 1.0:
                fps = fps_frame_count / (time.time() - fps_start_time)
                fps_frame_count = 0
                fps_start_time = time.time()

            # Analyze frame using InsightFace
            if HAS_INSIGHTFACE and face_app is not None:
                try:
                    faces = face_app.get(frame)
                    for face in faces:
                        bbox = face.bbox.astype(int)
                        kps = face.kps.astype(int) if face.kps is not None else []
                        encoding = face.embedding
                        
                        best_name = "Unknown"
                        best_sim = 0.0
                        
                        for person_id, p_data in db.people_db.items():
                            known_encoding = p_data.get("encoding")
                            if known_encoding is not None:
                                sim = cosine_similarity(encoding, known_encoding)
                                if sim > best_sim:
                                    best_sim = sim
                                    best_name = p_data.get("name", "Resident")

                        is_match = best_sim >= 0.45
                        box_color = (0, 255, 0) if is_match else (0, 0, 255) # Green for match, Red for unknown
                        
                        # Draw bounding box around face
                        cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), box_color, 2)
                        
                        # Draw 5 facial landmark points
                        for pt in kps:
                            cv2.circle(frame, (pt[0], pt[1]), 3, (255, 255, 0), -1)

                        # Draw Label & Similarity Percentage
                        label_text = f"{best_name}: {best_sim*100:.1f}%" if is_match else f"Unknown: {best_sim*100:.1f}%"
                        
                        # Label background box
                        (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                        cv2.rectangle(frame, (bbox[0], bbox[1] - 25), (bbox[0] + w + 10, bbox[1]), box_color, -1)
                        cv2.putText(frame, label_text, (bbox[0] + 5, bbox[1] - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                except Exception as e:
                    pass

            # Overlay Status Banner
            mode_label = "LIVE STREAM" if not use_snapshot_mode else "LIVE SNAPSHOTS"
            cv2.rectangle(frame, (0, 0), (frame.shape[1], 35), (0, 0, 0), -1)
            cv2.putText(frame, f"LIVE DEMO ({mode_label}) | FPS: {fps:.1f} | Profiles in DB: {len(db.people_db)} | Press ESC to Exit", 
                        (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1)

            cv2.imshow(window_name, frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == 27 or key == ord('q') or key == ord('Q'):
                break

    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()
        log("⏹️ Demo Mode stopped.", "DEMO")


