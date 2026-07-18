import os
import sys
import argparse

# Configure threading environment variables to prevent ONNX Runtime/BLAS deadlocks in background threads
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Reconfigure standard streams to UTF-8 to prevent UnicodeEncodeError on Windows console
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

class Settings:
    def __init__(self):
        # Default fallback values
        self.token = "mod_006d444a104af28092c11312f7dda065d38adda378f136ab"
        self.url = "http://localhost:3000"
        self.module_id = "42627e35-57ad-4ed1-8c66-6aa9fccaf4f2"
        
        # Paths
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.cache_file = os.path.join(self.script_dir, "processed_profiles.json")
        self.module_id_file = os.path.join(self.script_dir, ".module_id")

settings = Settings()

def parse_args():
    parser = argparse.ArgumentParser(description="Face ID Integration Module")
    parser.add_argument("--token", default=settings.token, help="Module Authorization Token")
    parser.add_argument("--url", default=settings.url, help="Core application base URL")
    parsed = parser.parse_args()
    
    settings.token = parsed.token
    settings.url = parsed.url
    return parsed
