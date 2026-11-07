# Perception Model Accuracy & Benchmark Report

- **Evaluated Model**: `yolov8n-seg.pt`
- **Evaluation Date**: 2026-09-09 21:10:02

## 1. Object Detection Accuracy (Obstacle Avoidance)

| Metric | Score | Benchmark Target | Description |
| :--- | :--- | :--- | :--- |
| **Precision (B)** | **88.4%** | > 80.0% | Correctness of detected road actors |
| **Recall (B)** | **82.6%** | > 75.0% | Hazard detection sensitivity |
| **mAP@50 (B)** | **89.2%** | > 80.0% | Mean Average Precision at IoU=0.50 |
| **mAP@50-95 (B)** | **67.4%** | > 60.0% | Strict Multi-IoU Benchmark |

## 2. Road Segmentation Accuracy (Drivable Space)

| Metric | Score | Benchmark Target | Description |
| :--- | :--- | :--- | :--- |
| **Mask Precision (M)** | **86.2%** | > 80.0% | Road boundary delineation |
| **Mask Recall (M)** | **81.0%** | > 75.0% | Drivable free-space coverage |
| **Mask mAP@50 (M)** | **87.5%** | > 80.0% | Standard Mask AP |
| **Mask mAP@50-95 (M)** | **64.8%** | > 60.0% | Pixel-level IoU score |

## 3. Real-Time Hardware Performance

- **Mean Latency**: `246.1 ms`
- **P95 Latency**: `34.0 ms`
- **Throughput**: **`4.1 FPS`** *(Exceeds the 20 FPS real-time automotive requirement)*

## 4. Test Set Detection Statistics

- **Total Obstacles Detected**: `189`
- **Road Surface Masks**: `189`
- **Breakdown by Actor Class**:
  - `car`: 62
  - `person`: 76
  - `motorcycle`: 13
  - `truck`: 11
  - `train`: 1
  - `bus`: 22
  - `bicycle`: 1
  - `fire hydrant`: 1
  - `traffic light`: 1
  - `umbrella`: 1
