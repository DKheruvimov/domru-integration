import os
import json
import base64
import cv2
import numpy as np
from config import settings
from logger import log

# In-memory storage for synced people and face encodings
# structure: { person_id: { "name": name, "encoding": encoding, "image": np_image, "imageHash": hash, "photo_bytes": bytes } }
people_db = {}

def load_processed_cache():
    """Load persistent profiles cache from disk."""
    global people_db
    if os.path.exists(settings.cache_file):
        try:
            with open(settings.cache_file, "r") as f:
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
    """Save memory database back to persistent disk cache."""
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
        with open(settings.cache_file, "w") as f:
            json.dump(serializable, f, indent=2)
        log(f"Saved {len(people_db)} profiles to persistent cache on disk.", "SYNC")
    except Exception as e:
        log(f"⚠️ Failed to save persistent cache to disk: {e}", "WARN")
