"""
convert_idd_resized_to_yolo.py
Converts IDD_RESIZED (image_archive & mask_archive) to standard YOLO format (Segmentation & Bounding Boxes)
Split into Train (85%) and Validation (15%) sets.
"""

import os
import glob
import cv2
import numpy as np
import shutil
from pathlib import Path
from tqdm import tqdm

ROOT_DIR = Path("c:/Users/narut/OneDrive/Desktop/sih")
IMAGE_DIR = ROOT_DIR / "IDD_RESIZED" / "image_archive"
MASK_DIR = ROOT_DIR / "IDD_RESIZED" / "mask_archive"
OUTPUT_DIR = ROOT_DIR / "IDD_YOLO_DATASET"

def mask_to_yolo_polygons(mask, img_w=512, img_h=512, class_id=0):
    """
    Extracts polygon contours from binary mask for YOLOv8 Segmentation.
    class_id 0 = 'drivable_road'
    """
    polygons_lines = []
    
    # Binary thresholding: 1 is road
    binary = (mask == 1).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)
    
    for cnt in contours:
        # Simplify contour
        epsilon = 0.003 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        # Need at least 3 points for a polygon
        if len(approx) < 3:
            continue
            
        # Check area
        area = cv2.contourArea(approx)
        if area < 100:  # Skip tiny noise specs
            continue
            
        points = approx.reshape(-1, 2)
        # Normalize coordinates between 0 and 1
        norm_pts = []
        for pt in points:
            norm_x = min(max(pt[0] / img_w, 0.0), 1.0)
            norm_y = min(max(pt[1] / img_h, 0.0), 1.0)
            norm_pts.extend([f"{norm_x:.6f}", f"{norm_y:.6f}"])
            
        line = f"{class_id} " + " ".join(norm_pts)
        polygons_lines.append(line)
        
    return polygons_lines

def prepare_dataset(max_samples=None, val_ratio=0.15):
    print("===============================================================")
    print("       CONVERTING IDD RESIZED TO YOLO SEGMENTATION/BBOX        ")
    print("===============================================================")
    
    train_img_dir = OUTPUT_DIR / "images" / "train"
    val_img_dir = OUTPUT_DIR / "images" / "val"
    train_lbl_dir = OUTPUT_DIR / "labels" / "train"
    val_lbl_dir = OUTPUT_DIR / "labels" / "val"
    
    for d in [train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)
        
    img_files = sorted(glob.glob(str(IMAGE_DIR / "Image_*.png")))
    total_found = len(img_files)
    print(f"Found {total_found} image files in {IMAGE_DIR}")
    
    if max_samples and max_samples < total_found:
        img_files = img_files[:max_samples]
        print(f"Using subset of {len(img_files)} samples for fast processing.")
        
    # Split train/val
    np.random.seed(42)
    indices = np.random.permutation(len(img_files))
    val_count = int(len(img_files) * val_ratio)
    val_set_indices = set(indices[:val_count])
    
    success_count = 0
    
    for idx, img_path in enumerate(tqdm(img_files, desc="Converting Masks to YOLO")):
        img_p = Path(img_path)
        # Match Mask_X.png
        img_num = img_p.stem.split("_")[-1]
        mask_path = MASK_DIR / f"Mask_{img_num}.png"
        
        if not mask_path.exists():
            continue
            
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        if mask is None:
            continue
            
        h, w = mask.shape
        poly_lines = mask_to_yolo_polygons(mask, img_w=w, img_h=h, class_id=0)
        
        is_val = idx in val_set_indices
        target_img_dir = val_img_dir if is_val else train_img_dir
        target_lbl_dir = val_lbl_dir if is_val else train_lbl_dir
        
        dest_img_path = target_img_dir / f"idd_{img_num}.png"
        dest_lbl_path = target_lbl_dir / f"idd_{img_num}.txt"
        
        # Copy image if not exists
        if not dest_img_path.exists():
            shutil.copy2(img_path, dest_img_path)
            
        # Write labels
        with open(dest_lbl_path, "w") as f:
            if poly_lines:
                f.write("\n".join(poly_lines) + "\n")
                
        success_count += 1
        
    # Create dataset yaml
    yaml_content = f"""# IDD Indian Road Segmentation & Drivable Corridor Dataset
path: {OUTPUT_DIR.as_posix()}
train: images/train
val: images/val

names:
  0: drivable_road
"""
    yaml_path = OUTPUT_DIR / "idd_road.yaml"
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
        
    print(f"\n[SUCCESS] Converted {success_count} samples successfully!")
    print(f"YAML config generated at: {yaml_path}")
    return yaml_path

if __name__ == "__main__":
    prepare_dataset(max_samples=1000)
