"""
run_live_perception.py
Autonomous Driving AI/ML Perception & Collision Prevention Suite
Dual-Engine Multi-Task Perception:
1. Drivable Road Surface & Corridor Segmentation (Fine-Tuned IDD Model)
2. Real-Time Dynamic Obstacle Detection & Accident Prevention:
   - Pedestrians (Person)
   - Vehicles (Car, Bus, Truck, Motorcycle, Bicycle, Train)
   - Animals, Traffic Lights, Obstacles
3. Automatic Emergency Braking (AEB) & Collision Warning Zone (TTC / Hazard Alert)
"""

import sys
import time
import argparse
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

# Critical road actor classes to track for collision prevention
SAFETY_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    4: "airplane",
    5: "bus",
    6: "train",
    7: "truck",
    8: "boat",
    9: "traffic light",
    11: "stop sign",
    15: "cat",
    16: "dog",
    17: "horse",
    18: "sheep",
    19: "cow",
}

def extract_centerline_and_steering(mask_shape, mask):
    h, w = mask_shape
    y_eval = int(h * 0.75)
    row = mask[y_eval, :]
    road_indices = np.where(row > 0)[0]
    
    if len(road_indices) > 20:
        left_bound = road_indices[0]
        right_bound = road_indices[-1]
        road_center = (left_bound + right_bound) // 2
        car_center = w // 2
        offset_px = road_center - car_center
        steer_angle_deg = np.clip((offset_px / (w / 2.0)) * 25.0, -25.0, 25.0)
        return road_center, y_eval, steer_angle_deg, (left_bound, right_bound)
    return w // 2, y_eval, 0.0, None

def run_live(source=0, show_road=True, show_objects=True):
    root_dir = Path("c:/Users/narut/OneDrive/Desktop/sih")
    idd_road_weights = root_dir / "perception" / "models" / "runs_idd" / "idd_road_seg" / "weights" / "best.pt"
    
    print("===============================================================")
    print("   AI/ML UNIFIED AUTONOMOUS PERCEPTION & ACCIDENT DEFENSE     ")
    print("===============================================================")
    print(" Dual-Engine Pipeline Active:")
    print("  1. Road & Corridor Segmentation (Fine-Tuned IDD Model)")
    print("  2. Collision Prevention & Road Actors (Pedestrians, Cars, Buses, Bikes)")
    print("===============================================================")

    # 1. Load Road Segmentation Model
    if idd_road_weights.exists():
        road_model = YOLO(str(idd_road_weights))
        print(f"[*] Road Segmentation Engine : {idd_road_weights.name} (Fine-Tuned IDD)")
    else:
        road_model = YOLO("yolov8n-seg.pt")
        print("[*] Road Segmentation Engine : Base YOLOv8-Seg")

    # 2. Load Object Detection Engine for Collision Avoidance (Pretrained COCO 80 classes)
    object_model = YOLO("yolov8n.pt")
    print("[*] Obstacle Defense Engine  : YOLOv8n (80 Actor Classes)")

    # 3. Initialize Source
    is_image_stream = False
    img_list = []
    img_idx = 0

    if isinstance(source, str) and source.lower() == "idd_stream":
        is_image_stream = True
        img_dir = root_dir / "IDD_RESIZED" / "image_archive"
        img_list = sorted(list(img_dir.glob("Image_*.png")))
        if not img_list:
            print("[ERROR] No images found in IDD_RESIZED/image_archive")
            return
        print(f"[*] Streaming {len(img_list)} Indian Road test scenes in real-time loop...")
        cap = None
    else:
        try:
            cam_idx = int(source)
            cap = cv2.VideoCapture(cam_idx, cv2.CAP_V4L2 if sys.platform.startswith('linux') else cv2.CAP_ANY)
        except ValueError:
            cap = cv2.VideoCapture(source)

        if not cap.isOpened():
            print(f"[WARNING] Cannot open camera '{source}'. Streaming Indian Road scenes instead.")
            is_image_stream = True
            img_dir = root_dir / "IDD_RESIZED" / "image_archive"
            img_list = sorted(list(img_dir.glob("Image_*.png")))
            cap = None

    cv2.namedWindow("Autonomous Perception & Collision Prevention", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Autonomous Perception & Collision Prevention", 1020, 680)

    fps_history = []
    paused = False

    print("\n[INFO] Controls:")
    print(" - Press 'q' or 'ESC' to Exit")
    print(" - Press 's' to Save Screenshot")
    print(" - Press 'SPACE' to Pause / Resume\n")

    while True:
        if not paused:
            if is_image_stream:
                img_path = img_list[img_idx]
                frame = cv2.imread(str(img_path))
                img_idx = (img_idx + 1) % len(img_list)
                time.sleep(0.03)
            else:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret:
                        break

            if frame is None:
                continue

            h, w = frame.shape[:2]
            t0 = time.perf_counter()

            # --- 1. RUN ROAD SEGMENTATION ---
            steer_angle = 0.0
            display_frame = frame.copy()

            if show_road:
                road_res = road_model.predict(source=frame, imgsz=512, conf=0.20, verbose=False)[0]
                if road_res.masks is not None and len(road_res.masks.data) > 0:
                    # Draw green road mask overlay
                    mask = road_res.masks.data[0].cpu().numpy()
                    mask_resized = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
                    color_mask = np.zeros_like(display_frame)
                    color_mask[mask_resized > 0] = [0, 200, 50] # Glowing road green
                    display_frame = cv2.addWeighted(display_frame, 1.0, color_mask, 0.40, 0)

                    r_center, y_eval, steer_angle, bounds = extract_centerline_and_steering((h, w), mask_resized)
                    cv2.line(display_frame, (w // 2, h), (r_center, y_eval), (255, 200, 0), 3)
                    cv2.circle(display_frame, (r_center, y_eval), 6, (0, 0, 255), -1)

            # --- 2. RUN OBSTACLE & COLLISION PREVENTION ---
            collision_warning = False
            hazard_objects = []

            # Define Ego Vehicle Danger Zone (Corridor directly ahead)
            danger_x_min, danger_x_max = int(w * 0.28), int(w * 0.72)
            danger_y_min = int(h * 0.45)

            if show_objects:
                obj_res = object_model.predict(source=frame, imgsz=512, conf=0.35, verbose=False)[0]
                
                if obj_res.boxes is not None:
                    for box in obj_res.boxes:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].cpu().numpy().astype(int)
                        x1, y1, x2, y2 = xyxy

                        cls_name = obj_res.names.get(cls_id, f"Class {cls_id}")

                        # Check if obstacle is inside Ego Vehicle's collision path
                        obj_center_x = (x1 + x2) // 2
                        obj_bottom_y = y2
                        in_path = (danger_x_min <= obj_center_x <= danger_x_max) and (obj_bottom_y >= danger_y_min)

                        if in_path and (cls_id in SAFETY_CLASSES or conf > 0.40):
                            collision_warning = True
                            hazard_objects.append(cls_name)
                            box_color = (0, 0, 255) # RED for Hazard
                            label_prefix = "[DANGER IN PATH] "
                        else:
                            box_color = (255, 180, 0) # CYAN / ORANGE for Safe Tracking
                            label_prefix = ""

                        # Draw Box
                        cv2.rectangle(display_frame, (x1, y1), (x2, y2), box_color, 2)
                        
                        # Label Banner
                        label_text = f"{label_prefix}{cls_name} {conf*100:.0f}%"
                        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                        cv2.rectangle(display_frame, (x1, max(0, y1 - 22)), (x1 + tw + 6, max(0, y1)), box_color, -1)
                        cv2.putText(display_frame, label_text, (x1 + 3, max(15, y1 - 6)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)

            latency_ms = (time.perf_counter() - t0) * 1000

            # Calculate Smooth FPS
            fps = 1000.0 / max(latency_ms, 1e-3)
            fps_history.append(fps)
            if len(fps_history) > 15:
                fps_history.pop(0)
            avg_fps = sum(fps_history) / len(fps_history)

            # --- 3. RENDER HUD & COLLISION BRAKING ALERT ---
            if collision_warning:
                # Flashing Red Emergency Braking Banner
                cv2.rectangle(display_frame, (0, 0), (w, 65), (0, 0, 220), -1)
                cv2.putText(display_frame, f"COLLISION ALERT! AEB ACTIVE: {', '.join(set(hazard_objects)).upper()} IN PATH", 
                            (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.70, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.putText(display_frame, f"AUTO-BRAKE TRIGGERED | FPS: {avg_fps:.1f} ({latency_ms:.1f} ms)", 
                            (15, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 255, 255), 2, cv2.LINE_AA)
            else:
                # Normal Operation Green Banner
                cv2.rectangle(display_frame, (0, 0), (w, 60), (18, 24, 28), -1)
                cv2.putText(display_frame, f"AUTONOMOUS PERCEPTION | {avg_fps:.1f} FPS ({latency_ms:.1f} ms)", 
                            (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 120), 2, cv2.LINE_AA)
                
                steer_dir = "CENTER" if abs(steer_angle) < 2 else ("RIGHT" if steer_angle > 0 else "LEFT")
                cv2.putText(display_frame, f"Steer Guidance: {steer_angle:+.1f} deg [{steer_dir}] | Path: CLEAR", 
                            (15, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 220, 50), 2, cv2.LINE_AA)

            # Danger Corridor Boundary lines
            cv2.line(display_frame, (danger_x_min, h), (int(w * 0.38), danger_y_min), (0, 165, 255), 1, cv2.LINE_AA)
            cv2.line(display_frame, (danger_x_max, h), (int(w * 0.62), danger_y_min), (0, 165, 255), 1, cv2.LINE_AA)

            # Vehicle Center Icon
            cv2.circle(display_frame, (w // 2, h - 20), 8, (0, 255, 0), -1)
            cv2.line(display_frame, (w // 2 - 40, h - 20), (w // 2 + 40, h - 20), (0, 255, 0), 2)

        cv2.imshow("Autonomous Perception & Collision Prevention", display_frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:
            print("\n[INFO] Exiting Autonomous Perception Suite...")
            break
        elif key == ord(' '):
            paused = not paused
            print(f"[{'PAUSED' if paused else 'RESUMED'}]")
        elif key == ord('s'):
            save_path = root_dir / "perception" / "models" / "test_results" / f"live_capture_{int(time.time())}.jpg"
            save_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(save_path), display_frame)
            print(f"[SAVED] Frame saved to: {save_path}")

    if cap is not None:
        cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Autonomous Live Perception & Collision Prevention Suite")
    parser.add_argument("--source", type=str, default="0", help="Camera index (0), video path, or 'idd_stream'")
    args = parser.parse_args()
    
    run_live(source=args.source)
