"""
test_live_video_stream.py
Live Real-Time Video Stream Object Detection Tester using YOLOv8.
Runs live detection frame-by-frame on any video file (e.g., MP4 driving footage).
"""

import cv2
import os
import sys
import time
from ultralytics import YOLO

def test_live_video(video_path: str = None):
    print("===============================================================")
    print("        LIVE VIDEO STREAM OBJECT DETECTION TESTER             ")
    print("===============================================================")
    
    # Load Model
    model = YOLO('yolov8n.pt')
    
    # If no video provided, use default test video or prompt
    if not video_path or not os.path.isfile(video_path):
        # Look for sample video in perception folder
        sample_vid = os.path.join(os.path.dirname(__file__), '..', 'perception_simulation_demo.mp4')
        if os.path.isfile(sample_vid):
            video_path = sample_vid
        else:
            print("[INFO] No video file specified. Opening live Webcam (camera 0)...")
            video_path = 0

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video source: {video_path}")
        return

    print(f"[OK] Playing video source: {video_path}")
    print(">>> Press 'q' on the video window anytime to stop. <<<\n")

    prev_time = time.time()
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("[INFO] Video stream ended or looped.")
            break

        # Run YOLO inference
        results = model.predict(frame, conf=0.30, verbose=False)
        annotated_frame = results[0].plot()

        # Calculate live FPS
        curr_time = time.time()
        fps = 1.0 / (curr_time - prev_time)
        prev_time = curr_time

        # Overlay FPS on video
        cv2.putText(annotated_frame, f"LIVE YOLO FPS: {fps:.1f}", 
                    (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

        # Show live visual window
        cv2.imshow("Live Perception Model Feed", annotated_frame)

        if cv2.waitKey(25) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Live test ended.")

if __name__ == '__main__':
    vid_arg = sys.argv[1] if len(sys.argv) > 1 else None
    test_live_video(vid_arg)
