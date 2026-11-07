"""
test_live_idd_road_segmentation.py
Visual tester for the fine-tuned IDD Road / Corridor segmentation model.
Runs on webcam, video file, or test images and overlays the segmented drivable road surface.
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

def main():
    root_dir = Path("c:/Users/narut/OneDrive/Desktop/sih")
    best_weights = root_dir / "perception" / "models" / "runs_idd" / "idd_road_seg" / "weights" / "best.pt"
    
    if best_weights.exists():
        model_path = str(best_weights)
        print(f"[*] Loading fine-tuned weights: {model_path}")
    else:
        model_path = "yolov8n-seg.pt"
        print(f"[!] Fine-tuned weights not found yet. Using base model: {model_path}")
        
    model = YOLO(model_path)
    
    test_img_dir = root_dir / "IDD_RESIZED" / "image_archive"
    test_images = list(test_img_dir.glob("Image_*.png"))[:5]
    
    if not test_images:
        print("[!] No images found in IDD_RESIZED/image_archive")
        return
        
    print(f"[*] Displaying visual segmentation on {len(test_images)} Indian road scenes...")
    print("[*] Press any key to move to the next image (or 'q' to quit).")
    
    for img_p in test_images:
        img = cv2.imread(str(img_p))
        if img is None:
            continue
            
        results = model.predict(img, conf=0.25, verbose=False)
        annotated_frame = results[0].plot()
        
        # Add latency HUD
        speed = results[0].speed
        latency_ms = speed.get('preprocess', 0) + speed.get('inference', 0) + speed.get('postprocess', 0)
        cv2.putText(annotated_frame, f"IDD Road Seg | Latency: {latency_ms:.1f}ms", (15, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 120), 2)
                    
        cv2.imshow("IDD Road & Drivable Corridor Segmentation", annotated_frame)
        key = cv2.waitKey(0) & 0xFF
        if key == ord('q'):
            break
            
    cv2.destroyAllWindows()
    print("[OK] Visual testing complete.")

if __name__ == "__main__":
    main()
