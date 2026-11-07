"""
prepare_idd_yolo.py
Script to parse India Driving Dataset (IDD) XML/JSON annotations and convert them
into YOLO standard format (images/ & labels/ with normalized bounding boxes: <class_id> <x_center> <y_center> <width> <height>).
"""

import os
import json
import glob
import xml.etree.ElementTree as ET
from pathlib import Path
import random
import shutil

# Target 9 Indian road classes
CLASS_MAPPING = {
    'car': 0,
    'bus': 1,
    'truck': 2,
    'auto_rickshaw': 3,
    'autorickshaw': 3,
    'auto': 3,
    'two_wheeler': 4,
    'motorcycle': 4,
    'rider': 4,
    'bicycle': 5,
    'pedestrian': 6,
    'person': 6,
    'pushcart': 7,
    'hand cart': 7,
    'cart': 7,
    'cattle': 8,
    'animal': 8,
    'cow': 8
}

YOLO_CLASSES = [
    'car', 'bus', 'truck', 'auto_rickshaw', 'two_wheeler',
    'bicycle', 'pedestrian', 'pushcart', 'cattle'
]

def create_yolo_yaml(output_dir: str):
    yaml_content = f"""# Indian Road Traffic Perception Dataset
path: {os.path.abspath(output_dir)}
train: images/train
val: images/val

names:
"""
    for idx, name in enumerate(YOLO_CLASSES):
        yaml_content += f"  {idx}: {name}\n"

    yaml_path = os.path.join(output_dir, 'idd_india.yaml')
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
    print(f"[OK] Generated YOLO data config: {yaml_path}")

def parse_voc_xml(xml_path: str):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    size_elem = root.find('size')
    img_w = float(size_elem.find('width').text)
    img_h = float(size_elem.find('height').text)
    
    boxes = []
    for obj in root.findall('object'):
        name = obj.find('name').text.lower().strip()
        if name in CLASS_MAPPING:
            cls_id = CLASS_MAPPING[name]
            bnd = obj.find('bndbox')
            xmin = float(bnd.find('xmin').text)
            ymin = float(bnd.find('ymin').text)
            xmax = float(bnd.find('xmax').text)
            ymax = float(bnd.find('ymax').text)
            
            # Normalize to YOLO format
            x_center = ((xmin + xmax) / 2.0) / img_w
            y_center = ((ymin + ymax) / 2.0) / img_h
            box_w = (xmax - xmin) / img_w
            box_h = (ymax - ymin) / img_h
            
            boxes.append((cls_id, x_center, y_center, box_w, box_h))
            
    return boxes

def main():
    print("IDD to YOLO Converter Initialized.")
    print(f"Target classes ({len(YOLO_CLASSES)}): {', '.join(YOLO_CLASSES)}")
    
if __name__ == '__main__':
    main()
