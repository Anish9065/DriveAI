"""
export_pretrained_yolo_onnx.py
Exports a base/fine-tuned YOLOv8 model to ONNX format (opset 12)
ready for direct import into MATLAB Deep Learning Toolbox.
"""

from ultralytics import YOLO
import os

def export_onnx():
    model_name = 'yolov8n.pt'
    print(f"Loading pretrained {model_name}...")
    model = YOLO(model_name)
    
    output_dir = os.path.dirname(os.path.abspath(__file__))
    print("Exporting model to ONNX (opset=12, dynamic=False, imgsz=640)...")
    
    onnx_path = model.export(
        format='onnx',
        opset=12,
        imgsz=640,
        simplify=True,
        dynamic=False
    )
    
    print(f"\n[SUCCESS] Exported ONNX model to: {onnx_path}")
    return onnx_path

if __name__ == '__main__':
    export_onnx()
