"""
DriveAI - Configuration Manager
Loads, validates, and exposes configuration parameters for DriveAI.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "driveai" / "config.json"

DEFAULT_CONFIG: Dict[str, Any] = {
    "system": {"name": "DriveAI", "version": "1.0.0"},
    "model": {
        "primary_model_path": "yolov8n.pt",
        "fallback_model_path": "perception/models/yolov8n.pt",
        "segmentation_model_path": "perception/models/runs_idd/idd_road_seg/weights/best.pt",
        "device": "cpu",
        "input_size": 640,
        "confidence_threshold": 0.35,
        "iou_threshold": 0.45,
        "inference_fps_limit": 30
    },
    "camera": {
        "default_source": 0,
        "available_sources": [
            {"id": "webcam_0", "name": "Live Primary Webcam (Device 0)", "type": "webcam", "index": 0},
            {"id": "prerecorded_demo", "name": "Prerecorded Indian Road Video (Demo)", "type": "video", "path": "perception/perception_simulation_demo.mp4"}
        ],
        "resolution": {"width": 640, "height": 480}
    },
    "simulation": {
        "total_route_km": 50.0,
        "default_preset": "village_rural"
    },
    "database": {
        "mongodb_uri": "",
        "database_name": "driveai_telemetry",
        "enable_mongodb": True,
        "connection_timeout_ms": 2500
    },
    "server": {"host": "127.0.0.1", "port": 8000}
}


def load_config() -> Dict[str, Any]:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                return cfg
        except Exception as e:
            print(f"⚠️ [Config] Error reading {CONFIG_PATH}: {e}. Using defaults.")
    return DEFAULT_CONFIG


def get_resolved_path(rel_or_abs_path: str) -> Path:
    p = Path(rel_or_abs_path)
    if not p.is_absolute():
        p = REPO_ROOT / p
    return p
