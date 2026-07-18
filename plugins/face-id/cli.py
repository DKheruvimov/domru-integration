import os
import threading
from config import settings
from logger import log
import db
import ws_client
import core_client
import biometrics

def command_loop():
    """Interactive command loop for CLI control."""
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
                ws_client.sio.disconnect()
                os._exit(0)
            elif cmd == "help":
                print("Commands: sync, status, trigger <dev_id> <place_id>, open <dev_id> <person_id>, exit")
            elif cmd == "sync":
                ws_client.sync_people_database()
            elif cmd == "status":
                print(f"Core URL: {settings.url}")
                print(f"Token: {settings.token}")
                print(f"WebSocket Connected: {ws_client.sio.connected}")
                print(f"Face Recognition Engine Loaded: {biometrics.HAS_INSIGHTFACE}")
                print(f"Loaded Profiles in Database: {len(db.people_db)}")
                for p_id, p_data in db.people_db.items():
                    encoding_status = "Yes" if p_data.get("encoding") is not None else "No"
                    print(f" - {p_data['name']} (ID: {p_id}, Role: {p_data['role']}, Encoding: {encoding_status})")
            elif cmd == "trigger":
                if len(parts) < 3:
                    print("Usage: trigger <device_id> <place_id>")
                    continue
                dev_id, pl_id = parts[1], parts[2]
                log(f"Simulating incoming call trigger for device {dev_id}, place {pl_id}...", "CLI")
                t = threading.Thread(target=biometrics.handle_incoming_call, args=(dev_id, pl_id), daemon=True)
                t.start()
            elif cmd == "open":
                if len(parts) < 3:
                    print("Usage: open <device_id> <person_id>")
                    continue
                dev_id, p_id = parts[1], parts[2]
                name = db.people_db.get(p_id, {}).get("name", p_id)
                core_client.trigger_door_open(dev_id, p_id, name)
            else:
                print(f"Unknown command: '{cmd}'. Type 'help' for commands.")
        except EOFError:
            log("No interactive terminal available (running in background).", "SYS")
            import time
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            print()
            log("Use 'exit' command to shutdown.", "SYS")
        except Exception as e:
            print(f"Error executing command: {e}")
