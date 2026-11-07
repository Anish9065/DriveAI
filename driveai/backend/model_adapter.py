"""
DriveAI - Model Integration Adapter
===================================
Inspects, validates, and runs inference on the user's existing trained vision model.
IMPORTANT:
  - This model performs 2D OBJECT DETECTION / SEGMENTATION.
  - It does NOT directly output steering torque, throttle, or braking actuators.
  - Vehicle actions in AI Demonstration mode are computed via the separate ControlAdapter.
"""

import time
from pathlib import Path
from typing import Dict, Any, List, Optional
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

from .config import load_config, get_resolved_path


class ExistingModelAdapter:
    """
    Adapter wrapping the user's trained YOLOv8 / ONNX model.
    Encapsulates lifecycle, preprocessing, inference, and output parsing.
    """

    def __init__(self):
        self.config = load_config()
        self.model = None
        self.model_path: Optional[Path] = None
        self.is_loaded = False
        self.error_message: Optional[str] = None
        self.classes: Dict[int, str] = {}
        self.task_type: str = "detection"
        self.capabilities = {
            "object_detection": False,
            "drivable_segmentation": False,
            "direct_vehicle_control": False  # Explicitly false: vision perception only
        }

        # Metrics
        self.last_inference_time_ms = 0.0
        self.last_fps = 0.0

        # Attempt automatic loading
        self.initialize_model()

    def get_available_models(self) -> List[Dict[str, Any]]:
        """Scans the repository for available trained weights and ONNX models."""
        model_candidates = [
            {
                "id": "yolov8n",
                "name": "YOLOv8n (Object Detection - 80 Classes)",
                "path": "yolov8n.pt",
                "type": "detection",
                "desc": "Standard Ultralytics COCO model for fast real-time 2D bounding box detection."
            },
            {
                "id": "yolov8n-seg",
                "name": "YOLOv8n-Seg (Instance & Road Segmentation)",
                "path": "yolov8n-seg.pt",
                "type": "segmentation",
                "desc": "Pixel-level instance segmentation for vehicles, pedestrians, and road obstacles."
            },
            {
                "id": "idd-best",
                "name": "IDD Fine-Tuned Road Segmentation (best.pt)",
                "path": "perception/models/runs_idd/idd_road_seg/weights/best.pt",
                "type": "segmentation",
                "desc": "Fine-tuned model trained on the Indian Driving Dataset (IDD) for local road structures."
            },
            {
                "id": "perception-yolov8n",
                "name": "Perception YOLOv8n (Pretrained)",
                "path": "perception/models/yolov8n.pt",
                "type": "detection",
                "desc": "Direct weights located in perception/models directory."
            }
        ]

        available = []
        for cand in model_candidates:
            p = get_resolved_path(cand["path"])
            if p.exists():
                is_active = (self.model_path is not None and self.model_path.resolve() == p.resolve())
                available.append({
                    "id": cand["id"],
                    "name": cand["name"],
                    "path": str(p),
                    "relative_path": cand["path"],
                    "type": cand["type"],
                    "description": cand["desc"],
                    "size_mb": round(p.stat().st_size / (1024 * 1024), 2),
                    "is_active": is_active
                })
        return available

    def switch_model(self, model_identifier: str) -> Dict[str, Any]:
        """Switches active perception model at runtime without restarting server."""
        available = self.get_available_models()
        target_path = None

        for item in available:
            if item["id"] == model_identifier or item["relative_path"] == model_identifier or item["path"] == model_identifier:
                target_path = Path(item["path"])
                break

        if not target_path:
            # Check if direct file path exists
            direct = get_resolved_path(model_identifier)
            if direct.exists():
                target_path = direct

        if not target_path or not target_path.exists():
            return {
                "success": False,
                "error": f"Model '{model_identifier}' not found in workspace."
            }

        try:
            print(f"🔄 [ModelAdapter] Switching active model to: {target_path}")
            new_model = YOLO(str(target_path))
            self.model = new_model
            self.model_path = target_path
            self.classes = getattr(new_model, "names", {})
            self.task_type = getattr(new_model, "task", "detection")

            self.capabilities["object_detection"] = True
            self.capabilities["drivable_segmentation"] = ("seg" in str(target_path).lower() or self.task_type == "segment")
            self.is_loaded = True
            self.error_message = None

            print(f"✅ [ModelAdapter] Successfully loaded: {target_path.name} ({self.task_type})")
            return {
                "success": True,
                "model_name": target_path.name,
                "task_type": self.task_type,
                "classes_count": len(self.classes),
                "is_segmentation": self.capabilities["drivable_segmentation"]
            }
        except Exception as e:
            err = f"Failed to switch model: {str(e)}"
            print(f"❌ [ModelAdapter] {err}")
            return {"success": False, "error": err}

    def initialize_model(self) -> bool:
        """Inspects and loads existing model candidates without retraining."""
        if not ULTRALYTICS_AVAILABLE:
            self.error_message = "Ultralytics package is not installed."
            print(f"❌ [ModelAdapter] {self.error_message}")
            return False

        model_cfg = self.config.get("model", {})
        candidates = [
            get_resolved_path(model_cfg.get("primary_model_path", "yolov8n.pt")),
            get_resolved_path("yolov8n-seg.pt"),
            get_resolved_path("perception/models/runs_idd/idd_road_seg/weights/best.pt"),
            get_resolved_path(model_cfg.get("fallback_model_path", "perception/models/yolov8n.pt"))
        ]

        selected_path = None
        for candidate in candidates:
            if candidate.exists():
                selected_path = candidate
                break

        if not selected_path:
            self.error_message = "No valid model weights found in specified paths."
            print(f"⚠️ [ModelAdapter] {self.error_message}")
            return False

        try:
            print(f"🔍 [ModelAdapter] Inspecting model file: {selected_path}")
            self.model = YOLO(str(selected_path))
            self.model_path = selected_path
            self.classes = getattr(self.model, "names", {})
            self.task_type = getattr(self.model, "task", "detection")

            self.capabilities["object_detection"] = True
            if "seg" in str(selected_path).lower() or self.task_type == "segment":
                self.capabilities["drivable_segmentation"] = True

            self.is_loaded = True
            self.error_message = None

            print("============================================================")
            print("  🤖 DriveAI Model Validation Report")
            print("============================================================")
            print(f"  • Model File:       {selected_path.name}")
            print(f"  • Task:             {self.task_type.upper()}")
            print(f"  • Classes Count:    {len(self.classes)}")
            print(f"  • Direct Control:   NO (Perception Model Only)")
            print(f"  • Model Status:     LOADED & VALIDATED")
            print("============================================================")
            return True

        except Exception as e:
            self.error_message = f"Failed to inspect/load model: {str(e)}"
            self.is_loaded = False
            print(f"❌ [ModelAdapter] Error: {self.error_message}")
            return False

    def predict(self, frame: Any, conf_threshold: Optional[float] = None) -> Dict[str, Any]:
        """
        Runs inference on a single frame.
        Returns real bounding boxes, segmentation masks (if available), confidences, classes, and latency.
        """
        if not self.is_loaded or self.model is None:
            return {
                "success": False,
                "error": self.error_message or "Model not loaded",
                "detections": [],
                "latency_ms": 0.0,
                "fps": 0.0
            }

        conf = conf_threshold or self.config.get("model", {}).get("confidence_threshold", 0.35)
        start_time = time.perf_counter()

        detections: List[Dict[str, Any]] = []
        h, w, _ = frame.shape

        try:
            results = self.model.predict(
                source=frame,
                conf=conf,
                verbose=False,
                device=self.config.get("model", {}).get("device", "cpu")
            )

            for r in results:
                # 1. Bounding Boxes
                if r.boxes is not None and len(r.boxes) > 0:
                    boxes_list = r.boxes
                    masks_xy = r.masks.xy if (hasattr(r, "masks") and r.masks is not None) else None

                    for idx, box in enumerate(boxes_list):
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        cls_id = int(box.cls[0].item())
                        score = float(box.conf[0].item())
                        class_name = self.classes.get(cls_id, f"Class_{cls_id}")

                        # Estimate distance using pinhole geometry
                        box_h = max(10, y2 - y1)
                        real_height = 1.70 if ("person" in class_name or "pedestrian" in class_name) else 1.50
                        est_dist_m = round((real_height * 550.0) / box_h, 1)

                        # Check if obstacle is directly in vehicle path
                        center_x = (x1 + x2) / 2.0
                        in_vehicle_path = (w * 0.30 <= center_x <= w * 0.70)

                        det_item = {
                            "class": class_name,
                            "class_id": cls_id,
                            "confidence": round(score, 3),
                            "box": [x1, y1, x2, y2],
                            "distance_m": est_dist_m,
                            "in_path": in_vehicle_path
                        }

                        # If polygon masks are available from segmentation model
                        if masks_xy is not None and idx < len(masks_xy):
                            poly = masks_xy[idx]
                            if len(poly) > 2:
                                # Downsample poly points to keep payload responsive
                                step = max(1, len(poly) // 25)
                                downsampled = [[int(pt[0]), int(pt[1])] for pt in poly[::step]]
                                det_item["polygon"] = downsampled

                        detections.append(det_item)

            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            self.last_inference_time_ms = round(elapsed_ms, 1)
            self.last_fps = round(1000.0 / max(1.0, elapsed_ms), 1)

            return {
                "success": True,
                "detections": detections,
                "latency_ms": self.last_inference_time_ms,
                "fps": self.last_fps,
                "model_name": self.model_path.name if self.model_path else "YOLOv8",
                "task": self.task_type
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "detections": [],
                "latency_ms": 0.0,
                "fps": 0.0
            }

    def render_hud_annotations(self, frame: Any, detections: List[Dict[str, Any]]) -> Any:
        """
        Renders sleek, professional automotive HUD overlays on top of camera frames.
        Supports translucent polygon masks, glowing bounding boxes, and distance tags.
        """
        if not CV2_AVAILABLE or frame is None:
            return frame
        annotated = frame.copy()
        overlay = frame.copy()
        has_polys = False

        # First pass: Draw translucent segmentation masks
        for det in detections:
            poly = det.get("polygon")
            if poly and len(poly) > 2:
                has_polys = True
                pts = np.array(poly, dtype=np.int32)
                cls_name = det.get("class", "").lower()
                if "road" in cls_name or "drivable" in cls_name or "lane" in cls_name:
                    color = (255, 180, 0)  # Cyan/Blue tint for road
                elif "car" in cls_name or "truck" in cls_name or "bus" in cls_name:
                    color = (0, 230, 100)  # Green tint for vehicles
                else:
                    color = (0, 140, 255)  # Amber tint for pedestrians/others
                cv2.fillPoly(overlay, [pts], color)

        if has_polys:
            cv2.addWeighted(overlay, 0.35, annotated, 0.65, 0, annotated)

        # Second pass: Draw bounding boxes and high-contrast HUD labels
        for det in detections:
            box = det.get("box", [0, 0, 0, 0])
            cls_name = det.get("class", "Target").upper()
            conf = det.get("confidence", 0.0)
            dist_m = det.get("distance_m", 0.0)
            in_path = det.get("in_path", False)

            is_hazard = (in_path and dist_m < 8.0)
            box_color = (0, 50, 255) if is_hazard else (0, 240, 120)  # Red/Coral vs Bright Green
            txt_bg_color = (0, 30, 180) if is_hazard else (15, 25, 35)

            # Box outline with corner accents
            x1, y1, x2, y2 = box[0], box[1], box[2], box[3]
            cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 2)

            # Pill Label
            label = f"{cls_name} {int(conf * 100)}% | {dist_m}m"
            (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
            pill_y1 = max(0, y1 - th - 8)
            pill_y2 = y1
            cv2.rectangle(annotated, (x1, pill_y1), (x1 + tw + 10, pill_y2), txt_bg_color, -1)
            cv2.rectangle(annotated, (x1, pill_y1), (x1 + tw + 10, pill_y2), box_color, 1)
            cv2.putText(annotated, label, (x1 + 5, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

        return annotated

    def get_status(self) -> Dict[str, Any]:
        """Returns the current model status and capabilities."""
        return {
            "loaded": self.is_loaded,
            "model_path": str(self.model_path) if self.model_path else None,
            "model_name": self.model_path.name if self.model_path else "None",
            "classes_count": len(self.classes),
            "classes": self.classes,
            "task_type": self.task_type,
            "capabilities": self.capabilities,
            "last_latency_ms": self.last_inference_time_ms,
            "last_fps": self.last_fps,
            "error": self.error_message,
            "available_models": self.get_available_models()
        }
