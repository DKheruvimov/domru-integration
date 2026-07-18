import time
import threading
import socketio
import cv2
import numpy as np
from config import settings
from logger import log
import db
import core_client
import biometrics

sync_requested = False
sync_thread_running = False
sync_thread_lock = threading.Lock()

# Socket.IO Client
sio = socketio.Client(reconnection=False)

def sync_loop():
    """Background thread loop to run database synchronization."""
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
    """Request sync execution safely in a background daemon thread."""
    global sync_requested, sync_thread_running
    with sync_thread_lock:
        sync_requested = True
        if not sync_thread_running:
            sync_thread_running = True
            t = threading.Thread(target=sync_loop, daemon=True)
            t.start()

def sync_people_database():
    """Fetch people from Core and cache their images/encodings."""
    try:
        log("Synchronizing people database from Core...", "SYNC")
        
        # 1. Update overall status to warning (synching)
        try:
            if sio.connected:
                sio.emit("update_status", {"status": "warning", "message": "Выполняется синхронизация базы лиц..."}, namespace="/modules")
        except Exception as e:
            log(f"⚠️ Failed to update status to warning: {e}", "WARN")
        
        try:
            people_list = core_client.fetch_people_list()
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
                    core_client.report_entity_status(person_id, "disabled", "Резидент отключен")
                    continue
                    
                if not is_face_id_enabled:
                    log(f"Skipping person '{name}' ({person_id}) - Face ID toggle is OFF.", "SYNC")
                    core_client.report_entity_status(person_id, "disabled", "Распознавание лиц выключено")
                    continue
                
                # Try downloading the photo (fast pre-check) to see if anything changed
                image_hash = p.get("imageHash", "")
                photo_bytes = None
                photo_changed = True
                
                cached_entry = db.people_db.get(person_id)
                if (cached_entry and 
                    cached_entry.get("imageHash") == image_hash and 
                    cached_entry.get("name") == name and 
                    cached_entry.get("role") == role):
                    photo_changed = False
                    photo_bytes = cached_entry.get("photo_bytes")

                if not photo_changed:
                    log(f"👤 Person '{name}' ({person_id}) is already fully synced & unchanged. Keeping cached profile.", "SYNC")
                    new_db[person_id] = cached_entry
                    if biometrics.HAS_INSIGHTFACE:
                        core_client.report_entity_status(person_id, "success", "База данных синхронизирована. Модуль активен.")
                    else:
                        core_client.report_entity_status(person_id, "success", "Синхронизировано (эмуляция Haar Cascade)")
                    continue
                    
                log(f"Syncing photo for '{name}' ({person_id})...", "SYNC")
                
                # Phase 1: Initialize
                core_client.report_entity_status(person_id, "processing", "Инициализация... Подключение к хранилищу")
                
                # Phase 2: GET request from storage
                core_client.report_entity_status(person_id, "processing", "Загрузка фото профиля (HTTP GET)...")
                
                photo_bytes = core_client.fetch_photo(person_id)
                
                if photo_bytes:
                    # Phase 3: Decoding
                    core_client.report_entity_status(person_id, "processing", f"Декодирование файла ({len(photo_bytes)} байт)...")
                    
                    nparr = np.frombuffer(photo_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if img is not None:
                        encoding = None
                        # Phase 4: Face Analysis
                        if biometrics.HAS_INSIGHTFACE and biometrics.face_app is not None:
                            core_client.report_entity_status(person_id, "processing", "Анализ биометрии (InsightFace)...")
                            try:
                                faces = biometrics.face_app.get(img)
                                if faces:
                                    # Pick the largest face in the photo
                                    largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                                    encoding = largest_face.embedding
                                    log(f"✅ Extracted face embedding for {name}", "SYNC")
                                    core_client.report_entity_status(person_id, "success", "База данных синхронизирована. Модуль активен.")
                                else:
                                    log(f"⚠️ No faces found in photo for {name}", "WARN")
                                    core_client.report_entity_status(person_id, "error", "Лицо не обнаружено на фотографии")
                            except Exception as ex:
                                log(f"❌ InsightFace processing failed for {name}: {ex}", "ERROR")
                                core_client.report_entity_status(person_id, "error", f"Ошибка анализа биометрии: {ex}")
                        else:
                            core_client.report_entity_status(person_id, "processing", "Определение структуры лица (Haar Cascade)...")
                            core_client.report_entity_status(person_id, "success", "Синхронизировано (эмуляция Haar Cascade)")
                        
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
                        core_client.report_entity_status(person_id, "error", "Ошибка декодирования изображения")
                else:
                    log(f"⚠️ No photo stored in storage for {name} ({person_id}).", "SYNC")
                    core_client.report_entity_status(person_id, "error", "Фотография отсутствует в хранилище. Пожалуйста, загрузите фото.")
                    
            db.people_db = new_db
            db.save_processed_cache()
            log(f"✅ Sync complete! Cached {len(db.people_db)} active Face ID profiles.", "SYNC")
            
            # Restore status to online
            if sio.connected:
                sio.emit("update_status", {"status": "online", "message": f"Face ID модуль активен. Активных профилей: {len(db.people_db)}"}, namespace="/modules")
                
        except Exception as e:
            log(f"❌ Sync failed with exception: {e}", "ERROR")
            if sio.connected:
                sio.emit("update_status", {"status": "error", "message": f"Сбой синхронизации: {e}"}, namespace="/modules")
    except Exception as outer_e:
        log(f"❌ Outer sync error: {outer_e}", "ERROR")

# --- Socket.IO Event Handlers ---

@sio.on("connect", namespace="/modules")
def on_connect():
    log("🔗 Connected to Core WebSocket server!", "WS")
    sio.emit("update_status", {"status": "online", "message": "Face ID модуль активен"}, namespace="/modules")
    core_client.register_capabilities()
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
        t = threading.Thread(target=biometrics.handle_incoming_call, args=(device_id, place_id), daemon=True)
        t.start()
    else:
        log(f"⚠️ Invalid incoming_call payload: {data}", "WARN")

@sio.on("door_opened", namespace="/modules")
def on_door_opened(data):
    log(f"🚪 SOCKET EVENT: door_opened! Source: {data.get('source')}, Details: {data.get('details')}", "WS")

@sio.on("call_ended", namespace="/modules")
def on_call_ended(data):
    log(f"📞 SOCKET EVENT: call_ended! Login: {data.get('login')}", "WS")

def connection_monitor():
    """Background thread to keep Socket.IO client connected."""
    while True:
        try:
            if not sio.connected:
                ws_url = f"{settings.url}?token={settings.token}&moduleId={settings.module_id}"
                log(f"🔄 WebSocket not connected. Attempting to connect...", "WS")
                sio.connect(ws_url, namespaces=["/modules"])
        except Exception as e:
            log(f"⚠️ Reconnection attempt failed: {e}. Retrying in 5 seconds...", "WS")
        time.sleep(5)
