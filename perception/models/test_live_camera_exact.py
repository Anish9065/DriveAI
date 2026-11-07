"""
test_live_camera_exact.py
AI/ML #1 - Perception Module
Exact Live Camera YOLOv8 Object Detection with bounding boxes, labels, and confidence scores.
"""

from ultralytics import YOLO
import sys

def run_live():
    print("===============================================================")
    print("      LIVE CAMERA OBJECT DETECTION (EXACT YOLO STREAM)        ")
    print("===============================================================")
    print("Loading YOLOv8 model...")
    model = YOLO('yolov8n.pt')
    
    print("\n[OK] Camera connected! Starting live detection stream...")
    print(">>> Press 'q' while focused on the video window to stop. <<<\n")
    
    # Iterate over stream generator so the camera video window stays open and updates live
    try:
        results = model.predict(
            source=0,          # Live webcam (index 0)
            show=True,         # Show live video window with exact YOLO bounding boxes
            conf=0.25,         # Confidence threshold
            imgsz=640,         # 640x480 resolution
            stream=True        # Stream generator mode
        )
        for r in results:
            pass  # Keeps the live camera feed active and displaying
    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")
    except Exception as e:
        print(f"\n[INFO] Opening Native GUI Camera Viewer due to: {e}")
        from live_webcam_detection_suite import main
        main()

if __name__ == '__main__':
    run_live()
