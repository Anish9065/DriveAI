"""
vehicle_control_app.py
Redirects to the new Tesla Smart Vehicle Touchscreen Cockpit App (tesla_app.py).
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    tesla_script = BASE_DIR / "tesla_app.py"
    if tesla_script.exists():
        import tesla_app
        tesla_app.main()
    else:
        print("Error: tesla_app.py not found.")
