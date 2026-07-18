import os
import requests
from config import settings
from logger import log

def fetch_module_id():
    """Retrieve module metadata dynamically based on token and cache it."""
    cached_id = None
    if os.path.exists(settings.module_id_file):
        try:
            with open(settings.module_id_file, "r", encoding="utf-8-sig") as f:
                cached_id = f.read().strip()
                log(f"Found cached Module ID: {cached_id}", "INIT")
        except Exception as e:
            log(f"⚠️ Failed to read cached module ID: {e}", "WARN")
            
    url = f"{settings.url}/api/modules/me?token={settings.token}"
    if cached_id:
        url += f"&id={cached_id}"
        
    log(f"Fetching module metadata from Core...", "INIT")
    try:
        res = requests.get(url, timeout=5)
        if res.ok:
            data = res.json()
            settings.module_id = data.get("id", settings.module_id)
            log(f"✅ Dynamically fetched Module ID: {settings.module_id}", "INIT")
            
            if not cached_id:
                try:
                    with open(settings.module_id_file, "w") as f:
                        f.write(settings.module_id)
                    log(f"Cached Module ID locally at {settings.module_id_file}", "INIT")
                except Exception as e:
                    log(f"⚠️ Failed to cache module ID: {e}", "WARN")
            return True
        else:
            log(f"❌ Core rejected metadata request: {res.text}.", "ERROR")
            if res.status_code == 403:
                log("❌ Access denied: This token is invalid or already claimed by another module instance.", "ERROR")
                os._exit(1)
    except Exception as e:
        log(f"⚠️ Failed to query module metadata from Core: {e}. Using fallback: {settings.module_id}", "WARN")
    return False

def register_capabilities():
    """Register Face ID capabilities with the Core."""
    log("Registering FACE_RECOGNITION capabilities with Core...", "INIT")
    cap_payload = {
        "capability": "FACE_RECOGNITION",
        "label": "Face ID (Python)",
        "supportedRoles": ["resident", "guest"],
        "mediaEndpoint": f"{settings.url}/api/modules/storage/{settings.module_id}"
    }
    
    url = f"{settings.url}/api/modules/actions/capabilities?token={settings.token}"
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

def report_entity_status(entity_id, status, message):
    """Report processing status back to Core to update React UI."""
    url = f"{settings.url}/api/modules/me/entity-status?token={settings.token}"
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
    url = f"{settings.url}/api/modules/actions/open?token={settings.token}"
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

def fetch_people_list():
    """Fetch the list of residents from the Core API."""
    people_url = f"{settings.url}/api/modules/actions/people?token={settings.token}"
    res = requests.get(people_url, timeout=5)
    if res.ok:
        return res.json()
    else:
        raise Exception(res.text)

def fetch_photo(person_id):
    """Fetch binary photo bytes for the resident from Core storage."""
    photo_url = f"{settings.url}/api/modules/storage/{settings.module_id}/{person_id}"
    photo_res = requests.get(photo_url, timeout=5)
    if photo_res.status_code == 200:
        return photo_res.content
    return None
