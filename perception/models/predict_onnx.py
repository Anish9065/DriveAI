"""
predict_onnx.py
Autonomous Driving AI/ML Perception Prediction Suite for ONNX Models
Performs high-speed ONNX inference on images, video, webcam, or dataset folders.
Renders instance segmentation masks, bounding boxes, class labels, confidence %, and FPS HUD.
"""

import sys
import time
import argparse
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

def predict_on_image(model, img_path, output_dir, conf=0.25, show_gui=True):
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"[ERROR] Could not read image: {img_path}")
        return None

    h, w = img.shape[:2]
    t0 = time.perf_counter()
    
    # Run ONNX Prediction
    results = model.predict(source=img, imgsz=640, conf=conf, verbose=False)
    latency_ms = (time.perf_counter() - t0) * 1000

    res = results[0]
    annotated = res.plot()

    # Metrics
    num_boxes = len(res.boxes) if res.boxes is not None else 0
    num_masks = len(res.masks) if res.masks is not None else 0

    # Overlay HUD
    hud_text = f"ONNX Prediction | Latency: {latency_ms:.1f}ms ({1000/latency_ms:.1f} FPS) | Objects: {num_boxes} | Masks: {num_masks}"
    cv2.rectangle(annotated, (0, 0), (w, 40), (20, 24, 30), -1)
    cv2.putText(annotated, hud_text, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2, cv2.LINE_AA)

    # Print detected classes
    detected_classes = []
    if res.boxes is not None:
        for box in res.boxes:
            c_id = int(box.cls[0].item())
            c_name = res.names.get(c_id, f"ID_{c_id}")
            c_conf = float(box.conf[0].item())
            detected_classes.append(f"{c_name} ({c_conf*100:.0f}%)")

    print(f"[PREDICT] {img_path.name} -> {latency_ms:.1f} ms | Found: {', '.join(detected_classes) if detected_classes else 'No objects above threshold'}")

    # Save to disk
    out_file = output_dir / f"pred_{img_path.stem}.jpg"
    cv2.imwrite(str(out_file), annotated)
    print(f"          Saved to: {out_file}")

    if show_gui:
        cv2.imshow("ONNX Prediction Viewer (Press any key for next, 'q' to exit)", annotated)
        key = cv2.waitKey(0) & 0xFF
        if key == ord('q') or key == 27:
            return "QUIT"
    return annotated

def predict_on_stream(model, source, conf=0.25):
    try:
        cam_idx = int(source)
        cap = cv2.VideoCapture(cam_idx)
    except ValueError:
        cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"[ERROR] Could not open video/camera source: {source}")
        return

    print(f"[*] Starting live ONNX prediction stream on source '{source}'...")
    print("    Press 'q' or 'ESC' to exit, 's' to save current frame.")

    cv2.namedWindow("Live ONNX Prediction Stream", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Live ONNX Prediction Stream", 960, 640)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        t0 = time.perf_counter()
        results = model.predict(source=frame, imgsz=640, conf=conf, verbose=False)
        latency_ms = (time.perf_counter() - t0) * 1000

        res = results[0]
        annotated = res.plot()

        fps = 1000.0 / max(latency_ms, 1e-3)
        cv2.rectangle(annotated, (0, 0), (w, 40), (20, 24, 30), -1)
        cv2.putText(annotated, f"LIVE ONNX | {fps:.1f} FPS ({latency_ms:.1f} ms)", 
                    (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 120), 2, cv2.LINE_AA)

        cv2.imshow("Live ONNX Prediction Stream", annotated)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

def main():
    root_dir = Path("c:/Users/narut/OneDrive/Desktop/sih")
    default_best_onnx = root_dir / "perception" / "models" / "runs_idd" / "idd_road_seg" / "weights" / "best.onnx"
    default_seg_onnx  = root_dir / "yolov8n-seg.onnx"
    output_dir = root_dir / "perception" / "models" / "predictions"
    output_dir.mkdir(parents=True, exist_ok=True)

    parser = argparse.ArgumentParser(description="ONNX Model Prediction Suite")
    parser.add_argument("--model", type=str, default="seg", choices=["best", "seg", "detect"],
                        help="Model to use: 'best' (IDD best.onnx), 'seg' (yolov8n-seg.onnx), 'detect' (yolov8n.onnx)")
    parser.add_argument("--source", type=str, default="sample",
                        help="Source: 'sample' (IDD test images), '0' (webcam), path to image file, or path to folder")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--no-gui", action="store_true", help="Run in headless mode without popup window")
    args = parser.parse_args()

    # Select model path
    if args.model == "best" and default_best_onnx.exists():
        model_path = str(default_best_onnx)
    elif args.model == "detect":
        model_path = str(root_dir / "yolov8n.onnx")
    else:
        model_path = str(default_seg_onnx)

    print("===============================================================")
    print("          AI/ML PERCEPTION - ONNX MODEL PREDICTION             ")
    print("===============================================================")
    print(f"[*] ONNX Model: {model_path}")
    print(f"[*] Confidence: {args.conf}")
    print("===============================================================\n")

    # Load ONNX model
    model = YOLO(model_path)

    # 1. Live Camera or Video
    if args.source.isdigit() or args.source.endswith((".mp4", ".avi", ".mkv", ".mov")):
        predict_on_stream(model, args.source, conf=args.conf)
        return

    # 2. Sample Indian Road Dataset Images
    if args.source == "sample":
        img_dir = root_dir / "IDD_RESIZED" / "image_archive"
        images = sorted(list(img_dir.glob("Image_*.png")))[:10]
    elif Path(args.source).is_dir():
        images = sorted(list(Path(args.source).glob("*.png")) + list(Path(args.source).glob("*.jpg")))
    elif Path(args.source).is_file():
        images = [Path(args.source)]
    else:
        print(f"[ERROR] Source '{args.source}' not found.")
        return

    print(f"[*] Processing {len(images)} images...\n")
    for img_path in images:
        res = predict_on_image(model, img_path, output_dir, conf=args.conf, show_gui=not args.no_gui)
        if res == "QUIT":
            break

    cv2.destroyAllWindows()
    print("\n===============================================================")
    print(f"[SUCCESS] Predictions complete! Results saved in: {output_dir}")
    print("===============================================================")

if __name__ == "__main__":
    main()
