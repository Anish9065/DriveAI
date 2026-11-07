"""
train_idd_road_segmentation.py
Fine-tunes YOLOv8-seg on IDD Drivable Road / Lane Segmentation using GPU.
"""

import os
import sys
from pathlib import Path
from ultralytics import YOLO
import torch

def main():
    root_dir = Path("c:/Users/narut/OneDrive/Desktop/sih")
    data_yaml = root_dir / "IDD_YOLO_DATASET" / "idd_road.yaml"
    
    device = 0 if torch.cuda.is_available() else "cpu"
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print(f"[*] Training on device: {device} ({device_name})", flush=True)
    
    # Load pretrained YOLOv8 nano segmentation model
    print("[*] Loading YOLOv8-seg pretrained weights...", flush=True)
    model = YOLO("yolov8n-seg.pt")
    
    print("[*] Starting Fine-tuning on Indian Road Dataset...", flush=True)
    results = model.train(
        data=str(data_yaml),
        epochs=10,
        imgsz=512,
        batch=16,
        workers=0,
        device=device,
        project=str(root_dir / "perception" / "models" / "runs_idd"),
        name="idd_road_seg",
        exist_ok=True,
        save=True,
        plots=True,
        verbose=True
    )
    
    print("\n[SUCCESS] Model training complete!", flush=True)
    save_dir = root_dir / "perception" / "models" / "runs_idd" / "idd_road_seg"
    print(f"Results and best weights saved in: {save_dir}", flush=True)

if __name__ == "__main__":
    main()
