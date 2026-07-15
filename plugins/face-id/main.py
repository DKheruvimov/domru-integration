#!/usr/bin/env python3
import os
import sys
import argparse
import requests
import socketio
import threading
import time
import base64
import json
import cv2
import numpy as np
import random

sync_requested = False
sync_thread_running = False
sync_thread_lock = threading.Lock()

def sync_loop():
    global sync_requested, sync_thread_running
    while True:
        with sync_thread_lock:
            if not sync_requested:
                sync_thread_running = False
                break
            sync_requested = False
        
        try:
            sync_people_database()
        except Exception as e:
            log(f"Error in sync_loop: {e}", "ERROR")

def trigger_sync():
    global sync_requested, sync_thread_running
    with sync_thread_lock:
        sync_requested = True
        if not sync_thread_running:
            sync_thread_running = True
            t = threading.Thread(target=sync_loop, daemon=True)
            t.start()

# Try to import face_recognition
try:
    import face_recognition
    HAS_FACE_RECOGNITION = True
except ImportError:
    HAS_FACE_RECOGNITION = False

DEFAULT_TOKEN = "mod_006d444a104af28092c11312f7dda065d38adda378f136ab"
DEFAULT_URL = "http://localhost:3000"
MODULE_ID = "42627e35-57ad-4ed1-8c66-6aa9fccaf4f2"

# In-memory storage for synced people and face encodings
# structure: { person_id: { "name": name, "encoding": encoding, "image": np_image, "imageHash": hash } }
people_db = {}

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "processed_profiles.json")

def load_processed_cache():
    global people_db
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cached = json.load(f)
            log(f"Loaded {len(cached)} profiles from persistent cache on disk.", "INIT")
            for person_id, data in cached.items():
                encoding = data.get("encoding")
                if encoding is not None:
                    encoding = np.array(encoding)
                
                photo_bytes_b64 = data.get("photo_bytes_b64")
                photo_bytes = None
                img = None
                if photo_bytes_b64:
                    photo_bytes = base64.b64decode(photo_bytes_b64)
                    nparr = np.frombuffer(photo_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                people_db[person_id] = {
                    "name": data.get("name"),
                    "role": data.get("role"),
                    "imageHash": data.get("imageHash"),
                    "photo_bytes": photo_bytes,
                    "encoding": encoding,
                    "image": img
                }
        except Exception as e:
            log(f"⚠️ Failed to load persistent cache from disk: {e}", "WARN")

def save_processed_cache():
    try:
        serializable = {}
        for person_id, data in people_db.items():
            encoding = data.get("encoding")
            if isinstance(encoding, np.ndarray):
                encoding = encoding.tolist()
            
            photo_bytes = data.get("photo_bytes")
            photo_bytes_b64 = None
            if photo_bytes:
                photo_bytes_b64 = base64.b64encode(photo_bytes).decode("utf-8")
                
            serializable[person_id] = {
                "name": data.get("name"),
                "role": data.get("role"),
                "imageHash": data.get("imageHash"),
                "photo_bytes_b64": photo_bytes_b64,
                "encoding": encoding
            }
        with open(CACHE_FILE, "w") as f:
            json.dump(serializable, f, indent=2)
        log(f"Saved {len(people_db)} profiles to persistent cache on disk.", "SYNC")
    except Exception as e:
        log(f"⚠️ Failed to save persistent cache to disk: {e}", "WARN")

# Haar cascade for fallback face detection
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

# Socket.IO Client
sio = socketio.Client(reconnection=False)

# Globals
args = None

def log(message, level="INFO"):
    print(f"[{level}] {message}", flush=True)

def register_capabilities():
    """Register Face ID capabilities with the Core."""
    log("Registering FACE_RECOGNITION capabilities with Core...", "INIT")
    cap_payload = {
        "capability": "FACE_RECOGNITION",
        "label": "Face ID (Python)",
        "supportedRoles": ["resident", "guest"],
        "mediaEndpoint": f"/api/modules/storage/{MODULE_ID}"
    }
    
    url = f"{args.url}/api/modules/actions/capabilities?token={args.token}"
    try:
        res = requests.post(url, json=cap_payload, timeout=5)
        if res.ok:
            log("✅ Successfully registered FACE_RECOGNITION capability!", "INIT")
            return True
        else:
            log(f"❌ Core rejected capabilities registration: {res.text}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ Failed to reach Core for capabilities: {e}", "ERROR")
        return False

def sync_people_database():
    """Fetch people from Core and cache their images/encodings."""
    global people_db
    
    try:
        log("Synchronizing people database from Core...", "SYNC")
        
        # 1. Update overall status to warning (synching)
        try:
            if sio.connected:
                sio.emit("update_status", {"status": "warning", "message": "Выполняется синхронизация базы лиц..."}, namespace="/modules")
        except Exception as e:
            log(f"⚠️ Failed to update status to warning: {e}", "WARN")
        
        people_url = f"{args.url}/api/modules/actions/people?token={args.token}"
        try:
            res = requests.get(people_url, timeout=5)
            if not res.ok:
                log(f"❌ Failed to fetch people: {res.text}", "ERROR")
                if sio.connected:
                    sio.emit("update_status", {"status": "error", "message": f"Ошибка синхронизации: {res.text}"}, namespace="/modules")
                return
            
            people_list = res.json()
            log(f"Fetched {len(people_list)} people from Core.", "SYNC")
            
            new_db = {}
            for p in people_list:
                person_id = p.get("id")
                name = p.get("name")
                role = p.get("role")
                enabled = p.get("enabled", True)
                plugin_settings = p.get("pluginSettings", {})
                
                # Check if this person's role supports FACE_RECOGNITION
                if role not in ["resident", "guest"]:
                    continue

                # Check if Face ID is enabled for this person
                is_face_id_enabled = plugin_settings.get("FACE_RECOGNITION", False)
                
                if not enabled:
                    log(f"Skipping person '{name}' ({person_id}) because they are disabled.", "SYNC")
                    report_entity_status(person_id, "disabled", "Резидент отключен")
                    continue
                    
                if not is_face_id_enabled:
                    log(f"Skipping person '{name}' ({person_id}) - Face ID toggle is OFF.", "SYNC")
                    report_entity_status(person_id, "disabled", "Распознавание лиц выключено")
                    continue
                
                # Try downloading the photo (fast pre-check) to see if anything changed
                image_hash = p.get("imageHash", "")
                photo_bytes = None
                photo_changed = True
                
                cached_entry = people_db.get(person_id)
                if (cached_entry and 
                    cached_entry.get("imageHash") == image_hash and 
                    cached_entry.get("name") == name and 
                    cached_entry.get("role") == role):
                    photo_changed = False
                    photo_bytes = cached_entry.get("photo_bytes")

                if not photo_changed:
                    log(f"👤 Person '{name}' ({person_id}) is already fully synced & unchanged. Keeping cached profile.", "SYNC")
                    # Keep the cached profile
                    new_db[person_id] = cached_entry
                    # Core status is reset on write or restart, so ensure it reflects SUCCESS state even if we skipped simulation
                    if HAS_FACE_RECOGNITION:
                        report_entity_status(person_id, "success", "База данных синхронизирована. Модуль активен.")
                    else:
                        report_entity_status(person_id, "success", "Синхронизировано (эмуляция Haar Cascade)")
                    continue
                    
                log(f"Syncing photo for '{name}' ({person_id})...", "SYNC")
                
                # Phase 1: Initialize
                report_entity_status(person_id, "processing", "Инициализация... Подключение к хранилищу")
                time.sleep(random.uniform(5.0, 7.0))
                
                # Phase 2: GET request from storage
                report_entity_status(person_id, "processing", "Загрузка фото профиля (HTTP GET)...")
                time.sleep(random.uniform(5.0, 7.0))
                
                photo_url = f"{args.url}/api/modules/storage/{MODULE_ID}/{person_id}"
                try:
                    photo_res = requests.get(photo_url, timeout=5)
                    if photo_res.status_code == 200:
                        photo_bytes = photo_res.content
                except Exception as e:
                    log(f"❌ Error downloading photo for {name}: {e}", "ERROR")
                
                if photo_bytes:
                    # Phase 3: Decoding
                    report_entity_status(person_id, "processing", f"Декодирование файла ({len(photo_bytes)} байт)...")
                    time.sleep(random.uniform(10.0, 15.0))
                    
                    # Convert to numpy array for CV2
                    nparr = np.frombuffer(photo_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if img is not None:
                        encoding = None
                        # Phase 4: Face Analysis
                        if HAS_FACE_RECOGNITION:
                            report_entity_status(person_id, "processing", "Анализ биометрии (face_recognition)...")
                            time.sleep(random.uniform(20.0, 30.0))
                            # Convert BGR (OpenCV) to RGB (face_recognition)
                            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                            encodings = face_recognition.face_encodings(rgb_img)
                            if encodings:
                                encoding = encodings[0]
                                log(f"✅ Extracted face encoding for {name}", "SYNC")
                                report_entity_status(person_id, "success", "База данных синхронизирована. Модуль активен.")
                            else:
                                log(f"⚠️ No faces found in photo for {name}", "WARN")
                                report_entity_status(person_id, "error", "Лицо не обнаружено на фотографии")
                        else:
                            report_entity_status(person_id, "processing", "Определение структуры лица (Haar Cascade)...")
                            time.sleep(random.uniform(20.0, 30.0))
                            report_entity_status(person_id, "success", "Синхронизировано (эмуляция Haar Cascade)")
                        
                        new_db[person_id] = {
                            "name": name,
                            "role": role,
                            "image": img,
                            "encoding": encoding,
                            "photo_bytes": photo_bytes,
                            "imageHash": image_hash
                        }
                    else:
                        log(f"⚠️ Failed to decode image for {name}", "WARN")
                        report_entity_status(person_id, "error", "Ошибка декодирования изображения")
                else:
                    log(f"⚠️ No photo stored in storage for {name} ({person_id}).", "SYNC")
                    report_entity_status(person_id, "error", "Фотография отсутствует в хранилище. Пожалуйста, загрузите фото.")
                    
            people_db = new_db
            save_processed_cache()
            log(f"✅ Sync complete! Cached {len(people_db)} active Face ID profiles.", "SYNC")
            
            # Restore status to online
            if sio.connected:
                sio.emit("update_status", {"status": "online", "message": f"Face ID модуль активен. Активных профилей: {len(people_db)}"}, namespace="/modules")
                
        except Exception as e:
            log(f"❌ Sync failed with exception: {e}", "ERROR")
            if sio.connected:
                sio.emit("update_status", {"status": "error", "message": f"Сбой синхронизации: {e}"}, namespace="/modules")
    except Exception as outer_e:
        log(f"❌ Outer sync error: {outer_e}", "ERROR")

def report_entity_status(entity_id, status, message):
    """Report processing status back to Core to update React UI."""
    url = f"{args.url}/api/modules/me/entity-status?token={args.token}"
    payload = {
        "entityType": "person",
        "entityId": entity_id,
        "status": status,
        "message": message
    }
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        log(f"Failed to report entity status for {entity_id}: {e}", "ERROR")

def trigger_door_open(device_id, person_id, person_name):
    """Command Core to open the door."""
    url = f"{args.url}/api/modules/actions/open?token={args.token}"
    payload = {
        "deviceId": int(device_id),
        "personId": person_id,
        "capability": "FACE_RECOGNITION"
    }
    log(f"🚪 Sending DOOR OPEN command for {person_name} (ID: {person_id}) to device {device_id}...", "ACTION")
    try:
        res = requests.post(url, json=payload, timeout=5)
        if res.ok:
            log(f"✅ Door open command successfully accepted by Core!", "ACTION")
            report_entity_status(person_id, "success", f"Лицо распознано. Дверь открыта!")
        else:
            log(f"❌ Core rejected door open command: {res.text}", "ERROR")
            report_entity_status(person_id, "error", f"Ошибка открытия двери: {res.text}")
    except Exception as e:
        log(f"❌ Exception sending door open command: {e}", "ERROR")
        report_entity_status(person_id, "error", f"Ошибка сети при открытии двери")

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

    # 2. Precision Face Matching (if face_recognition package is present)
    if HAS_FACE_RECOGNITION:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        log(f"face_recognition found {len(face_encodings)} face encodings.", "RECOGNITION")
        
        for encoding in face_encodings:
            # Match against each known person
            for person_id, p_data in people_db.items():
                known_encoding = p_data.get("encoding")
                if known_encoding is None:
                    continue
                    
                report_entity_status(person_id, "processing", "Сравнение биометрических данных...")
                
                # Compare face encodings
                matches = face_recognition.compare_faces([known_encoding], encoding, tolerance=0.6)
                if matches[0]:
                    name = p_data["name"]
                    log(f"🌟 MATCH FOUND! Identified resident: {name} ({person_id})", "RECOGNITION")
                    trigger_door_open(device_id, person_id, name)
                    return
        
        log("Precision matching done. No matched profile found in database.", "RECOGNITION")
    else:
        # Smart Cascade Fallback: Match to the first active person in the database for simulation
        if people_db:
            matched_id, matched_data = list(people_db.items())[0]
            name = matched_data["name"]
            log(f"💡 Haar Cascade Fallback Mode (Simulation): Matching detected face to {name} ({matched_id})", "RECOGNITION")
            report_entity_status(matched_id, "processing", "Лицо обнаружено. Распознавание...")
            time.sleep(1) # Simulate visual recognition delay
            trigger_door_open(device_id, matched_id, name)
        else:
            log("⚠️ Fallback mode: Face detected, but database of active profiles is empty. Add a person with Face ID enabled first!", "WARN")


def handle_incoming_call(device_id, place_id):
    """Triggered on incoming call to fetch current camera image and run recognition."""
    log(f"🔔 Incoming call handler started for device {device_id}, place {place_id}", "EVENT")
    
    # Report processing status for all active Face ID members to show feedback in UI
    for p_id in people_db:
        report_entity_status(p_id, "processing", "Обработка вызова с домофона...")

    # Fetch snapshot from camera
    snapshot_url = f"{args.url}/api/modules/actions/snapshot/{place_id}/{device_id}?token={args.token}"
    log(f"Fetching camera snapshot: {snapshot_url}", "EVENT")
    
    try:
        res = requests.get(snapshot_url, timeout=8)
        if res.status_code == 200 and len(res.content) > 0:
            log("Snapshot fetched successfully! Running face analysis...", "EVENT")
            process_recognition_from_image(res.content, device_id)
        else:
            log(f"⚠️ Failed to fetch camera snapshot: Status {res.status_code}", "WARN")
            for p_id in people_db:
                report_entity_status(p_id, "error", "Ошибка загрузки снимка с камеры")
    except Exception as e:
        log(f"❌ Error fetching snapshot: {e}", "ERROR")
        for p_id in people_db:
            report_entity_status(p_id, "error", "Ошибка подключения к камере")


# --- Socket.IO Event Handlers ---

@sio.on("connect", namespace="/modules")
def on_connect():
    log("🔗 Connected to Core WebSocket server!", "WS")
    # Send online status to Core
    sio.emit("update_status", {"status": "online", "message": "Face ID модуль активен"}, namespace="/modules")
    
    # Auto-register capabilities and schema upon connection to handle server restart / resets
    register_capabilities()
    
    # Run sync in background thread to prevent blocking socket heartbeats!
    trigger_sync()

@sio.on("people_updated", namespace="/modules")
def on_people_updated(data):
    log("👥 SOCKET EVENT: people_updated! Triggering database sync...", "WS")
    trigger_sync()

@sio.on("module_data_updated", namespace="/modules")
def on_module_data_updated(data):
    log(f"📦 SOCKET EVENT: module_data_updated! Payload: {data}. Triggering database sync...", "WS")
    trigger_sync()

@sio.on("disconnect", namespace="/modules")
def on_disconnect():
    log("🔌 Disconnected from Core WebSocket server", "WS")

@sio.on("incoming_call", namespace="/modules")
def on_incoming_call(data):
    log(f"📞 SOCKET EVENT: incoming_call received! Payload: {data}", "WS")
    device_id = data.get("deviceId")
    place_id = data.get("placeId")
    
    if device_id and place_id:
        # Run recognition in a separate thread to prevent blocking WebSocket client
        t = threading.Thread(target=handle_incoming_call, args=(device_id, place_id), daemon=True)
        t.start()
    else:
        log(f"⚠️ Invalid incoming_call payload: {data}", "WARN")

@sio.on("door_opened", namespace="/modules")
def on_door_opened(data):
    log(f"🚪 SOCKET EVENT: door_opened! Source: {data.get('source')}, Details: {data.get('details')}", "WS")

@sio.on("call_ended", namespace="/modules")
def on_call_ended(data):
    log(f"📞 SOCKET EVENT: call_ended! Login: {data.get('login')}", "WS")


# --- Interactive CLI Thread ---

def command_loop():
    print("\n" + "="*50)
    print("      FACE ID MODULE INTERACTIVE TERMINAL")
    print("="*50)
    print("Commands:")
    print("  sync           - Force synchronizing database of faces")
    print("  status         - Show current database & connection status")
    print("  trigger <dev_id> <place_id> - Simulate incoming call on device")
    print("  open <dev_id> <person_id>   - Open door manually for a person")
    print("  help           - Show list of commands")
    print("  exit           - Exit Face ID Module")
    print("="*50 + "\n")
    
    while True:
        try:
            line = input("> ").strip()
            if not line:
                continue
                
            parts = line.split()
            cmd = parts[0].lower()
            
            if cmd == "exit":
                log("Shutting down...", "SYS")
                sio.disconnect()
                os._exit(0)
            elif cmd == "help":
                print("Commands: sync, status, trigger <dev_id> <place_id>, open <dev_id> <person_id>, exit")
            elif cmd == "sync":
                sync_people_database()
            elif cmd == "status":
                print(f"Core URL: {args.url}")
                print(f"Token: {args.token}")
                print(f"WebSocket Connected: {sio.connected}")
                print(f"Face Recognition Engine Loaded: {HAS_FACE_RECOGNITION}")
                print(f"Loaded Profiles in Database: {len(people_db)}")
                for p_id, p_data in people_db.items():
                    print(f" - {p_data['name']} (ID: {p_id}, Role: {p_data['role']}, Encoding: {'Yes' if p_data['encoding'] is not None else 'No'})")
            elif cmd == "trigger":
                if len(parts) < 3:
                    print("Usage: trigger <device_id> <place_id>")
                    continue
                dev_id, pl_id = parts[1], parts[2]
                log(f"Simulating incoming call trigger for device {dev_id}, place {pl_id}...", "CLI")
                t = threading.Thread(target=handle_incoming_call, args=(dev_id, pl_id), daemon=True)
                t.start()
            elif cmd == "open":
                if len(parts) < 3:
                    print("Usage: open <device_id> <person_id>")
                    continue
                dev_id, p_id = parts[1], parts[2]
                name = people_db.get(p_id, {}).get("name", p_id)
                trigger_door_open(dev_id, p_id, name)
            else:
                print(f"Unknown command: '{cmd}'. Type 'help' for commands.")
        except EOFError:
            log("No interactive terminal available (running in background).", "SYS")
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            print()
            log("Use 'exit' command to shutdown.", "SYS")
        except Exception as e:
            print(f"Error executing command: {e}")

def fetch_module_id():
    """Retrieve module metadata dynamically based on token and cache it."""
    global MODULE_ID
    
    script_dir = os.path.dirname(os.path.realpath(__file__))
    id_file_path = os.path.join(script_dir, ".module_id")
    
    cached_id = None
    if os.path.exists(id_file_path):
        try:
            with open(id_file_path, "r") as f:
                cached_id = f.read().strip()
                log(f"Found cached Module ID: {cached_id}", "INIT")
        except Exception as e:
            log(f"⚠️ Failed to read cached module ID: {e}", "WARN")
            
    url = f"{args.url}/api/modules/me?token={args.token}"
    if cached_id:
        url += f"&id={cached_id}"
        
    log(f"Fetching module metadata from Core...", "INIT")
    try:
        res = requests.get(url, timeout=5)
        if res.ok:
            data = res.json()
            MODULE_ID = data.get("id", MODULE_ID)
            log(f"✅ Dynamically fetched Module ID: {MODULE_ID}", "INIT")
            
            if not cached_id:
                try:
                    with open(id_file_path, "w") as f:
                        f.write(MODULE_ID)
                    log(f"Cached Module ID locally at {id_file_path}", "INIT")
                except Exception as e:
                    log(f"⚠️ Failed to cache module ID: {e}", "WARN")
            return True
        else:
            log(f"❌ Core rejected metadata request: {res.text}.", "ERROR")
            if res.status_code == 403:
                log("❌ Access denied: This token is invalid or already claimed by another module instance.", "ERROR")
                sys.exit(1)
    except Exception as e:
        log(f"⚠️ Failed to query module metadata from Core: {e}. Using fallback: {MODULE_ID}", "WARN")
    return False

def connection_monitor():
    """Background thread to ensure WebSocket connection is always active, retrying on disconnects or connection errors."""
    while True:
        try:
            if not sio.connected:
                ws_url = f"{args.url}?token={args.token}&moduleId={MODULE_ID}"
                log(f"🔄 WebSocket not connected. Attempting to connect...", "WS")
                sio.connect(ws_url, namespaces=["/modules"])
        except Exception as e:
            log(f"⚠️ Reconnection attempt failed: {e}. Retrying in 5 seconds...", "WS")
        time.sleep(5)

def main():
    global args
    parser = argparse.ArgumentParser(description="Face ID Integration Module")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Module Authorization Token")
    parser.add_argument("--url", default=DEFAULT_URL, help="Core application base URL")
    args = parser.parse_args()
    
    log(f"Starting Face ID (Python) integration...", "INIT")
    log(f"Core URL: {args.url}", "INIT")
    log(f"Module Token: {args.token}", "INIT")
    log(f"Face Recognition Lib available: {HAS_FACE_RECOGNITION}", "INIT")
    
    # Load persistent profiles cache from disk
    load_processed_cache()
    
    # 0. Retrieve module metadata dynamically
    fetch_module_id()
    
    # 1. Register Capabilities with Core
    if not register_capabilities():
        log("⚠️ Initialization notice: Core is currently not reachable or hasn't booted yet. Will retry after connection.", "WARN")
        
    # 2. Start WebSocket Connection Monitor
    t_conn = threading.Thread(target=connection_monitor, daemon=True)
    t_conn.start()
        
    # Start command loop in a separate thread
    t = threading.Thread(target=command_loop, daemon=True)
    t.start()
    
    # Keep main thread alive
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
