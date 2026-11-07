"""
test_best_onnx.py
AI/ML Perception Module - Tests the fine-tuned 'best.onnx' model on Indian road scenes.
Measures ONNX inference latency, renders segmented drivable corridor, and saves/displays the result.
"""

import sys
import time
from pathlib import Path
import cv2
from ultralytics import YOLO

def test_onnx(show_gui=False):
    root_dir = Path("c:/Users/narut/OneDrive/Desktop/sih")
    onnx_path = root_dir / "perception" / "models" / "runs_idd" / "idd_road_seg" / "weights" / "best.onnx"
    output_dir = root_dir / "perception" / "models" / "test_results"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not onnx_path.exists():
        print(f"[ERROR] ONNX file not found at: {onnx_path}", flush=True)
        return

    print("===============================================================", flush=True)
    print("       TESTING FINE-TUNED BEST.ONNX ROAD SEGMENTATION          ", flush=True)
    print("===============================================================", flush=True)
    print(f"[*] ONNX Model Path: {onnx_path}", flush=True)
    print(f"[*] Loading model into YOLO ONNX Engine...", flush=True)
    
    # Load ONNX model
    model = YOLO(str(onnx_path), task="segment")
    print("[OK] ONNX model loaded successfully!", flush=True)

    # Find test images
    img_dir = root_dir / "IDD_RESIZED" / "image_archive"
    test_images = sorted(list(img_dir.glob("Image_*.png")))[:5]
    
    if not test_images:
        print("[!] No test images found in IDD_RESIZED/image_archive", flush=True)
        return

    print(f"[*] Running inference on {len(test_images)} sample Indian road images...\n", flush=True)

    for idx, img_path in enumerate(test_images):
        img = cv2.imread(str(img_path))
        if img is None:
            continue

        # Warmup and Inference timing
        t0 = time.perf_counter()
        results = model.predict(source=img, imgsz=512, conf=0.20, verbose=False)
        latency_ms = (time.perf_counter() - t0) * 1000

        res = results[0]
        annotated_img = res.plot()

        # Add HUD overlay
        hud_text = f"best.onnx | Latency: {latency_ms:.1f}ms | FPS: {1000/latency_ms:.1f}"
        cv2.putText(annotated_img, hud_text, (15, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)

        out_file = output_dir / f"onnx_pred_{img_path.stem}.jpg"
        cv2.imwrite(str(out_file), annotated_img)

        num_boxes = len(res.boxes) if res.boxes is not None else 0
        has_masks = res.masks is not None
        print(f"[{idx+1}/{len(test_images)}] {img_path.name} | Latency: {latency_ms:.1f}ms ({1000/latency_ms:.1f} FPS) | Objects: {num_boxes} | Road Masks: {has_masks}", flush=True)
        print(f"       -> Saved visualization to: {out_file}", flush=True)

        if show_gui:
            cv2.imshow("Fine-Tuned best.onnx - Indian Road Perception", annotated_img)
            key = cv2.waitKey(1000) & 0xFF
            if key == ord('q') or key == 27:
                break

    if show_gui:
        cv2.destroyAllWindows()

    print("\n===============================================================", flush=True)
    print("[SUCCESS] All ONNX tests completed successfully!", flush=True)
    print("===============================================================", flush=True)

if __name__ == "__main__":
    gui = "--gui" in sys.argv
    test_onnx(show_gui=gui)
