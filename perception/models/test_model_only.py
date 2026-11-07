"""
test_model_only.py
AI/ML #1 - Perception Module
Standalone test script to test the object detection model on images.
Saves annotated images with bounding boxes, labels, and confidence scores to 'test_results/' folder.
"""

import os
import cv2
import urllib.request
from ultralytics import YOLO

def test_model():
    print("===============================================================")
    print("           STANDALONE OBJECT DETECTION MODEL TEST             ")
    print("===============================================================")
    
    # 1. Output directory
    output_dir = os.path.join(os.path.dirname(__file__), 'test_results')
    os.makedirs(output_dir, exist_ok=True)
    
    # 2. Load Model
    model_path = 'yolov8n.pt'
    print(f"1. Loading YOLO model: {model_path}...")
    model = YOLO(model_path)
    print(f"   [OK] Model loaded successfully (Classes: {len(model.names)}).")
    
    # 3. Test Images
    test_images_dir = os.path.join(os.path.dirname(__file__), 'test_images')
    os.makedirs(test_images_dir, exist_ok=True)
    
    sample_urls = {
        'street_bus_crowd.jpg': 'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg',
        'road_traffic_view.jpg': 'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/zidane.jpg'
    }
    
    for filename, url in sample_urls.items():
        local_path = os.path.join(test_images_dir, filename)
        if not os.path.exists(local_path):
            try:
                print(f"   Downloading sample image: {filename}...")
                urllib.request.urlretrieve(url, local_path)
            except Exception as e:
                print(f"   Could not download {filename}: {e}")

    image_files = [os.path.join(test_images_dir, f) for f in os.listdir(test_images_dir) if f.endswith(('.jpg', '.png', '.jpeg'))]
    
    if not image_files:
        print("[ERROR] No test images found in 'test_images' folder.")
        return
        
    print(f"\n2. Running Model Inference on {len(image_files)} test image(s)...")
    
    for img_path in image_files:
        img_name = os.path.basename(img_path)
        print(f"\n---------------------------------------------------------------")
        print(f"Testing Image: {img_name}")
        
        # Run inference
        results = model.predict(img_path, conf=0.25, verbose=False)
        result = results[0]
        
        # Print detected objects
        boxes = result.boxes
        num_dets = len(boxes)
        print(f"--> Total Detections Found: {num_dets}")
        
        for idx, box in enumerate(boxes):
            cls_id = int(box.cls[0].item())
            cls_name = model.names[cls_id]
            conf = float(box.conf[0].item()) * 100
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            print(f"    [{idx+1}] Class: {cls_name:<15} | Confidence: {conf:5.1f}% | Box: [{x1:.0f}, {y1:.0f}, {x2:.0f}, {y2:.0f}]")
            
        # Save visual annotated image
        annotated_img = result.plot()
        out_path = os.path.join(output_dir, f"detected_{img_name}")
        cv2.imwrite(out_path, annotated_img)
        print(f"--> Annotated result saved to: {out_path}")
        
    print(f"\n===============================================================")
    print(f"[SUCCESS] All model tests passed!")
    print(f"You can view the annotated detection images in: {output_dir}")
    print(f"===============================================================")

if __name__ == '__main__':
    test_model()
