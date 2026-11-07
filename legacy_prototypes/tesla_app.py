"""
=============================================================================
TESLA SMART VEHICLE TOUCHSCREEN COCKPIT & LIVE PERCEPTION APP
=============================================================================
Native Desktop Application featuring:
  - Tesla Model 3 / Model S Center Touchscreen Experience
  - Tesla Vision 3D Autopilot (FSD Beta) Road & Obstacle Projection
  - Live YOLOv8 Camera Perception Stream (Auto-Rickshaws, Cattle, Pedestrians)
  - PRND Gear Controls, Plaid / Chill Speed Modes, Power Meter & AEB
=============================================================================
Run with:  python3 tesla_app.py
=============================================================================
"""

import os
import sys
import time
import base64
import threading
from pathlib import Path
import cv2
import numpy as np

# Ensure working directory is this file's folder
BASE_DIR = Path(__file__).resolve().parent
os.chdir(str(BASE_DIR))

# Try importing pywebview for genuine native macOS App window
try:
    import webview
    WEBVIEW_AVAILABLE = True
except ImportError:
    WEBVIEW_AVAILABLE = False

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


class TeslaVisionBridge:
    """Python-to-JavaScript API Bridge for Camera & Telemetry."""

    def __init__(self):
        self.cap = None
        self.model = None
        self.latest_frame_b64 = ""
        self.is_running = True
        self.detections = []

        # Load YOLO model
        self.load_model()
        # Start camera thread
        self.start_camera_worker()

    def load_model(self):
        if not YOLO_AVAILABLE:
            print("⚠️ Ultralytics not installed. Running in mock perception mode.")
            return

        model_candidates = [
            BASE_DIR / "perception" / "models" / "runs_idd" / "idd_road_seg" / "weights" / "best.pt",
            BASE_DIR / "yolov8n.pt",
            BASE_DIR / "perception" / "models" / "yolov8n.pt"
        ]
        chosen = None
        for cand in model_candidates:
            if cand.exists():
                chosen = str(cand)
                break

        if not chosen:
            chosen = "yolov8n.pt"

        try:
            print(f"Loading YOLO model: {chosen}...")
            self.model = YOLO(chosen)
            print("✅ YOLO model loaded successfully.")
        except Exception as e:
            print(f"⚠️ Model load error: {e}. Trying fallback 'yolov8n.pt'...")
            try:
                self.model = YOLO("yolov8n.pt")
            except Exception as e2:
                print(f"❌ Fallback failed: {e2}")

    def start_camera_worker(self):
        t = threading.Thread(target=self._camera_loop, daemon=True)
        t.start()

    def _camera_loop(self):
        # Connect to webcam
        for idx in [0, 1, 2]:
            temp = cv2.VideoCapture(idx)
            if temp.isOpened():
                ret, _ = temp.read()
                if ret:
                    self.cap = temp
                    print(f"✅ Connected to live webcam index {idx}")
                    break
                temp.release()

        while self.is_running:
            frame = None
            if self.cap is not None and self.cap.isOpened():
                ret, img = self.cap.read()
                if ret:
                    frame = img

            if frame is None:
                # Generate synthetic frame with moving obstacles
                frame = self._generate_simulated_frame()

            # Run YOLO detection
            if self.model is not None:
                try:
                    res = self.model.predict(frame, conf=0.35, verbose=False)
                    for r in res:
                        for box in r.boxes:
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            cls_id = int(box.cls[0])
                            conf = float(box.conf[0])
                            name = self.model.names.get(cls_id, str(cls_id))
                            box_h = max(10, y2 - y1)
                            dist = round((1.65 * 550.0) / box_h, 1)

                            color = (0, 0, 255) if dist < 5.0 else (0, 255, 120)
                            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                            cv2.putText(frame, f"{name} {int(conf*100)}% | {dist}m",
                                        (x1, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)
                except Exception:
                    pass

            # Encode frame to JPEG
            try:
                frame_high = cv2.resize(frame, (640, 440))
                _, buf = cv2.imencode(".jpg", frame_high, [cv2.IMWRITE_JPEG_QUALITY, 80])
                b64_str = base64.b64encode(buf).decode("utf-8")
                self.latest_frame_b64 = f"data:image/jpeg;base64,{b64_str}"
            except Exception:
                pass

            time.sleep(0.033)  # ~30 FPS

    def _generate_simulated_frame(self):
        h, w = 360, 540
        img = np.zeros((h, w, 3), dtype=np.uint8)
        img[0:int(h * 0.45), :] = [30, 20, 15]
        img[int(h * 0.45):, :] = [45, 45, 45]

        # Draw road
        road_poly = np.array([
            [int(w * 0.42), int(h * 0.45)],
            [int(w * 0.58), int(h * 0.45)],
            [int(w * 0.95), h],
            [int(w * 0.05), h]
        ], np.int32)
        cv2.fillPoly(img, [road_poly], (55, 60, 68))
        cv2.line(img, (int(w * 0.5), int(h * 0.45)), (int(w * 0.5), h), (240, 240, 240), 2)

        # Draw simulated rickshaw
        t = time.time()
        rx = int(w * 0.48 + 15 * np.sin(t * 0.8))
        ry = int(h * 0.65)
        cv2.rectangle(img, (rx - 30, ry - 40), (rx + 30, ry), (0, 200, 255), -1)
        cv2.rectangle(img, (rx - 25, ry - 35), (rx + 25, ry - 12), (20, 140, 20), -1)
        cv2.putText(img, "AUTO 4.8m", (rx - 36, ry - 48), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        return img

    def get_latest_frame(self):
        return self.latest_frame_b64


def main():
    print("=================================================================")
    print("  🚗 LAUNCHING TESLA SMART VEHICLE TOUCHSCREEN COCKPIT APP")
    print("=================================================================")

    html_file = BASE_DIR / "tesla_cockpit" / "index.html"
    if not html_file.exists():
        print(f"❌ Error: {html_file} not found.")
        sys.exit(1)

    api_bridge = TeslaVisionBridge()

    if WEBVIEW_AVAILABLE:
        print("⚡ Opening Native Apple WebKit App Window...")

        window = webview.create_window(
            title="Tesla Nav-Bharat Smart Vehicle Touchscreen Cockpit",
            url=str(html_file),
            width=1340,
            height=860,
            min_size=(1050, 700),
            resizable=True,
            js_api=api_bridge
        )

        def poll_camera():
            while api_bridge.is_running:
                if api_bridge.latest_frame_b64:
                    try:
                        window.evaluate_js(f"""
                            const pip = document.getElementById('pip-camera-img');
                            if (pip) {{ pip.src = '{api_bridge.latest_frame_b64}'; }}
                            const realcam = document.getElementById('realcam-stream');
                            if (realcam) {{ realcam.src = '{api_bridge.latest_frame_b64}'; }}
                        """)
                    except Exception:
                        pass
                time.sleep(0.033)

        t_poll = threading.Thread(target=poll_camera, daemon=True)
        t_poll.start()

        webview.start(debug=False)
        api_bridge.is_running = False

    else:
        # Fallback to default browser
        import webbrowser
        print("Opening in default browser...")
        webbrowser.open(f"file://{html_file}")


if __name__ == "__main__":
    main()
