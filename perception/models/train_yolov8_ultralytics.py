"""
train_yolov8_ultralytics.py
Fine-tunes YOLOv8 on Indian Driving Dataset (IDD) and exports directly to ONNX format
for MATLAB import and Simulink deployment.

Usage:
    python train_yolov8_ultralytics.py --data ../dataset_pipeline/idd_india.yaml --epochs 30
"""

import argparse
import os

def train_and_export(data_yaml: str, epochs: int, batch_size: int, model_size: str = 'yolov8m.pt'):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] Ultralytics is not installed. Run: pip install ultralytics")
        return

    print("=======================================================")
    print("  YOLOv8 Fine-Tuning for Indian Traffic Scenarios     ")
    print("=======================================================")
    print(f"Base Model: {model_size}")
    print(f"Data Config: {data_yaml}")
    print(f"Epochs: {epochs} | Batch Size: {batch_size}")

    # Load pretrained model
    model = YOLO(model_size)

    # Fine-tune on Indian classes
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=640,
        batch=batch_size,
        device=0 if os.environ.get('CUDA_VISIBLE_DEVICES') != '' else 'cpu',
        optimizer='AdamW',
        lr0=0.001,
        augment=True,
        project='runs_sih_perception',
        name='indian_traffic_yolov8'
    )

    print("\n[OK] Training complete. Exporting to ONNX for MATLAB...")
    # Export with opset 12 (highest compatibility with MATLAB Deep Learning Toolbox)
    onnx_file = model.export(format='onnx', opset=12, simplify=True)
    print(f"[SUCCESS] ONNX model exported to: {onnx_file}")
    print("Use import_onnx_to_matlab.m to load and test this model in MATLAB.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Fine-tune YOLOv8 on IDD for SIH Perception")
    parser.add_argument('--data', type=str, default='../dataset_pipeline/idd_india.yaml', help='Path to dataset yaml')
    parser.add_argument('--epochs', type=int, default=25, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size')
    parser.add_argument('--model', type=str, default='yolov8n.pt', help='Pretrained model variant (yolov8n.pt / yolov8s.pt / yolov8m.pt)')
    
    args = parser.parse_args()
    train_and_export(args.data, args.epochs, args.batch, args.model)
