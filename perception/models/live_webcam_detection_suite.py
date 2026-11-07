"""
live_webcam_detection_suite.py
AI/ML #1 - Perception Module
Robust Real-Time Live Camera Object Detection Suite using YOLOv8 & Tkinter/OpenCV.
Runs a live camera feed window with bounding boxes, class labels, confidence scores,
live FPS counter, and snapshot capture.
"""

import cv2
import time
import os
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk
from ultralytics import YOLO

class LiveYOLOApp:
    def __init__(self, root):
        self.root = root
        self.root.title("SIH Autonomous Driving - Live Object Detection (YOLOv8)")
        self.root.geometry("850x700")
        self.root.configure(bg="#1a1d24")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        # Output folder for snapshots
        self.snapshot_dir = os.path.join(os.path.dirname(__file__), 'test_results')
        os.makedirs(self.snapshot_dir, exist_ok=True)
        self.snapshot_count = 0

        # Load YOLO model
        print("Loading YOLOv8 model...")
        self.model = YOLO('yolov8n.pt')
        print("[OK] YOLOv8 model loaded successfully.")

        # Camera connection
        self.cap = None
        for idx in [0, 1, 2]:
            temp = cv2.VideoCapture(idx)
            if temp.isOpened():
                self.cap = temp
                print(f"[OK] Connected to Camera index {idx}")
                break
            temp.release()

        if self.cap is None or not self.cap.isOpened():
            messagebox.showerror("Camera Error", "No webcam detected on your PC/Laptop!\nPlease check camera connections.")
            self.root.destroy()
            return

        self.conf_threshold = 0.30
        self.prev_time = time.time()
        self.is_running = True
        self.current_annotated_frame = None

        # Build UI Layout
        # 1. Header Title
        title_frame = tk.Frame(root, bg="#1a1d24")
        title_frame.pack(fill=tk.X, pady=10)
        lbl_title = tk.Label(title_frame, text="SIH AUTONOMOUS DRIVING - REAL-TIME PERCEPTION", 
                             font=("Arial", 14, "bold"), fg="#38bdf8", bg="#1a1d24")
        lbl_title.pack()

        # 2. Camera Video Canvas
        self.canvas_label = tk.Label(root, bg="#0f1117")
        self.canvas_label.pack(padx=15, pady=5)

        # 3. Status Bar
        self.lbl_status = tk.Label(root, text="FPS: 0.0 | Latency: 0.0 ms | Detections: 0", 
                                   font=("Arial", 11, "bold"), fg="#4ade80", bg="#1a1d24")
        self.lbl_status.pack(pady=5)

        # 4. Controls Bar
        btn_frame = tk.Frame(root, bg="#1a1d24")
        btn_frame.pack(fill=tk.X, pady=10)

        btn_snap = tk.Button(btn_frame, text="📸 Save Snapshot ('s')", font=("Arial", 10, "bold"),
                             bg="#0284c7", fg="white", padx=15, pady=5, command=self.save_snapshot)
        btn_snap.pack(side=tk.LEFT, padx=30)

        # Confidence slider
        lbl_conf = tk.Label(btn_frame, text="Confidence:", font=("Arial", 10), fg="white", bg="#1a1d24")
        lbl_conf.pack(side=tk.LEFT, padx=5)

        self.slider_conf = tk.Scale(btn_frame, from_=0.15, to=0.85, resolution=0.05, 
                                    orient=tk.HORIZONTAL, bg="#262b36", fg="white", 
                                    highlightthickness=0, command=self.update_conf)
        self.slider_conf.set(0.30)
        self.slider_conf.pack(side=tk.LEFT, padx=5)

        btn_quit = tk.Button(btn_frame, text="❌ Exit ('q')", font=("Arial", 10, "bold"),
                             bg="#e11d48", fg="white", padx=15, pady=5, command=self.on_close)
        btn_quit.pack(side=tk.RIGHT, padx=30)

        # Keyboard shortcuts
        root.bind('<s>', lambda event: self.save_snapshot())
        root.bind('<S>', lambda event: self.save_snapshot())
        root.bind('<q>', lambda event: self.on_close())
        root.bind('<Q>', lambda event: self.on_close())
        root.bind('<Escape>', lambda event: self.on_close())

        # Start Video Processing Loop
        self.update_frame()

    def update_conf(self, val):
        self.conf_threshold = float(val)

    def save_snapshot(self):
        if self.current_annotated_frame is not None:
            self.snapshot_count += 1
            path = os.path.join(self.snapshot_dir, f"live_camera_snapshot_{self.snapshot_count}.jpg")
            cv2.imwrite(path, self.current_annotated_frame)
            print(f"[OK] Saved snapshot to: {path}")
            self.lbl_status.config(text=f"Snapshot saved to: test_results/live_camera_snapshot_{self.snapshot_count}.jpg")

    def update_frame(self):
        if not self.is_running:
            return

        ret, frame = self.cap.read()
        if ret:
            # Resize frame for smooth display
            frame = cv2.resize(frame, (640, 480))
            
            # Run YOLO inference
            t0 = time.time()
            results = self.model.predict(frame, conf=self.conf_threshold, verbose=False)
            latency_ms = (time.time() - t0) * 1000

            # Get annotated BGR frame
            annotated_bgr = results[0].plot()
            self.current_annotated_frame = annotated_bgr

            # Calculate FPS
            curr_time = time.time()
            fps = 1.0 / max(0.001, (curr_time - self.prev_time))
            self.prev_time = curr_time

            # Number of detected objects
            num_dets = len(results[0].boxes)
            self.lbl_status.config(text=f"FPS: {fps:4.1f} | Latency: {latency_ms:4.1f} ms | Conf: {self.conf_threshold:.2f} | Detections: {num_dets}")

            # Convert BGR to RGB for Tkinter display
            rgb_frame = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(rgb_frame)
            img_tk = ImageTk.PhotoImage(image=img_pil)

            self.canvas_label.img_tk = img_tk
            self.canvas_label.configure(image=img_tk)

        self.root.after(10, self.update_frame)

    def on_close(self):
        self.is_running = False
        if self.cap and self.cap.isOpened():
            self.cap.release()
        self.root.destroy()
        print("[INFO] Live camera session closed.")

def main():
    root = tk.Tk()
    app = LiveYOLOApp(root)
    root.mainloop()

if __name__ == '__main__':
    main()
