#!/usr/bin/env python3
import sys
import time
import threading

# 1. Imports configuration which applies threading env limits and UTF-8 console configurations
import config
from logger import log
import db
import core_client
import biometrics
import ws_client
import cli

def main():
    # 2. Parse command line arguments
    config.parse_args()
    
    log("Starting Face ID (Python) integration...", "INIT")
    log(f"Core URL: {config.settings.url}", "INIT")
    log(f"Module Token: {config.settings.token}", "INIT")
    log(f"InsightFace available: {biometrics.HAS_INSIGHTFACE}", "INIT")
    
    # 3. Initialize Face Recognition Engine
    biometrics.init_engine()
    
    # 4. Load persistent profiles cache from disk
    db.load_processed_cache()
    
    # 5. Retrieve module metadata dynamically
    core_client.fetch_module_id()
    
    # 6. Register Capabilities with Core
    if not core_client.register_capabilities():
        log("⚠️ Initialization notice: Core is currently not reachable or hasn't booted yet. Will retry after connection.", "WARN")
        
    # 7. Start WebSocket Connection Monitor Thread
    t_conn = threading.Thread(target=ws_client.connection_monitor, daemon=True)
    t_conn.start()
        
    # 8. Start interactive command loop in a separate thread if running in interactive terminal
    if sys.stdin and sys.stdin.isatty():
        t_cli = threading.Thread(target=cli.command_loop, daemon=True)
        t_cli.start()
    else:
        log("No interactive terminal available (stdin is not a TTY). Running in background mode.", "SYS")
    
    # 9. Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Shutting down...", "SYS")
        ws_client.sio.disconnect()

if __name__ == "__main__":
    main()
