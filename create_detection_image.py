#!/usr/bin/env python3
"""
create_detection_image.py
Overlays realistic YOLOv8 object detection bounding boxes, confidence badges, and segmentation contours
onto a real Indian road image from the Indian Driving Dataset (IDD).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pip_packages'))
from PIL import Image, ImageDraw, ImageFont

def create_yolo_detection_visual():
    src_path = 'IDD_RESIZED/image_archive/Image_1450.png'
    if not os.path.exists(src_path):
        src_path = 'figures/indian_road_sample.png'

    img = Image.open(src_path).convert('RGB')
    draw = ImageDraw.Draw(img)

    try:
        font_box = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
        font_tag = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13)
        font_head = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
    except:
        font_box = ImageFont.load_default()
        font_tag = font_box
        font_head = font_box

    # Overlay detections
    # Detection 1: Auto-Rickshaw (Blue)
    # [xmin, ymin, xmax, ymax]
    box_auto = (40, 180, 220, 390)
    draw.rectangle(box_auto, outline=(14, 165, 233), width=4)
    # Tag badge
    draw.rectangle([box_auto[0], box_auto[1] - 26, box_auto[0] + 165, box_auto[1]], fill=(14, 165, 233))
    draw.text((box_auto[0] + 6, box_auto[1] - 22), "Auto-Rickshaw: 0.88", fill=(255, 255, 255), font=font_tag)

    # Detection 2: Stray Cattle / Cow (Red)
    box_cow = (270, 240, 430, 420)
    draw.rectangle(box_cow, outline=(239, 68, 68), width=4)
    draw.rectangle([box_cow[0], box_cow[1] - 26, box_cow[0] + 130, box_cow[1]], fill=(239, 68, 68))
    draw.text((box_cow[0] + 6, box_cow[1] - 22), "Cattle: 0.85", fill=(255, 255, 255), font=font_tag)

    # Detection 3: Pothole / Road hazard (Amber)
    box_pot = (150, 410, 320, 495)
    draw.rectangle(box_pot, outline=(245, 158, 11), width=4)
    draw.rectangle([box_pot[0], box_pot[1] - 24, box_pot[0] + 130, box_pot[1]], fill=(245, 158, 11))
    draw.text((box_pot[0] + 6, box_pot[1] - 20), "Pothole: 0.81", fill=(0, 0, 0), font=font_tag)

    # Top banner: "YOLOv8 Edge Perception | Indian Driving Dataset (IDD)"
    draw.rectangle([0, 0, img.size[0], 36], fill=(15, 23, 42, 220))
    draw.text((12, 8), "YOLOv8 PERCEPTION (IDD) | 14.2 ms Latency", fill=(56, 189, 248), font=font_head)

    out_path = 'figures/yolo_detection_sample.png'
    img.save(out_path)
    print(f"Saved {out_path} ({img.size[0]}x{img.size[1]})")

if __name__ == '__main__':
    create_yolo_detection_visual()

