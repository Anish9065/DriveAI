# DriveAI — Intelligent Driving & Road Simulation System

[![Platform](https://img.shields.io/badge/Platform-Python%20%7C%20FastAPI%20%7C%20Three.js-00d2ff.svg)](#)
[![Computer Vision](https://img.shields.io/badge/Perception-YOLOv8%20%2F%20OpenCV-00ffaa.svg)](#)
[![Simulation](https://img.shields.io/badge/Simulation-50km%20Procedural%20Road-ffaa00.svg)](#)
[![Status](https://img.shields.io/badge/System-Production%20Ready-brightgreen.svg)](#)

---

## 1. Executive Summary & Objective

**DriveAI** is a modular, presentation-ready platform designed for real-world autonomous driving demonstrations, intelligent vehicle simulations, and automotive AI research.

The platform bridges real-time computer vision with interactive simulation:
1. **Manual Driving Mode**: Interactive virtual vehicle control featuring simplified longitudinal and lateral kinematics, realistic acceleration, braking, reverse, collision detection, and keyboard/UI controls.
2. **AI-Assisted Driving Demonstration Mode**: Demonstrates how vision detections translate into simulated driving responses (Adaptive Cruise Control and Automatic Emergency Braking) via an explicit rule-based control adapter.
3. **50 km Fictional Busy-Road Driving Simulation**: Procedural multi-lane road environment with 3 traffic density presets (*Normal*, *Busy City*, *Heavy Challenge*), dynamic vehicles (cars, buses, trucks, bikes), road markings, streetlights, and 3 switchable camera perspectives (Chase, Cockpit, Top-down).
4. **Live Camera & Video Stream**: Real-time object detection overlays (bounding boxes, class labels, distances, confidence scores) supporting physical webcams and prerecorded test videos.
5. **Session History & Analytics**: SQLite database logging simulation runs, distance, speeds, detected objects, safety interventions, and inference latency statistics.

---

## 2. Engineering Architecture & Capability Disclosure

```
                                  ┌───────────────────────────┐
                                  │   Webcam / Video File     │
                                  └─────────────┬─────────────┘
                                                │ Frame
                                                ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│ User's Existing Model     │────▶│ Model Adapter             │
│ (YOLOv8 / PyTorch .pt)    │     │ (Validates, Inferences)   │
└───────────────────────────┘     └─────────────┬─────────────┘
                                                │ Detections (bbox, conf, dist)
                                                ▼
                                  ┌───────────────────────────┐
                                  │ Control Adapter           │◀─── [Perception Only Disclaimer]
                                  │ (Rule-based ACC & AEB)    │     (Clear safety disclosure)
                                  └─────────────┬─────────────┘
                                                │ Driving Decision
                                                ▼
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│ Three.js 3D Simulation    │◀────│ Simulation Engine         │────▶│ SQLite Database           │
│ (Chase / Hood / Top-Down) │     │ (50 km Road, Kinematics)  │     │ (sessions.db History)     │
└───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘
```

### Critical Model Capability Disclosure
- **Perception vs. Actuation**: The integrated deep learning model (`yolov8n.pt` or custom weights) is a **perception-only model** performing multi-class object detection. It does not natively output steering torque, throttle position, or brake line pressure.
- **Rule-Based Demonstration**: In AI Driving Mode, vehicle actuation (ACC deceleration and AEB emergency braking) is executed by the **`ControlAdapter`**, which converts detected obstacles into simulated actions. The UI explicitly marks these decisions with the badge:  
  `[SIMULATED AI RULE-BASED ADAPTER]`.
- **Zero Real-Vehicle Control**: This application controls simulated virtual entities only. It never connects to real-world automotive ECUs or CAN buses.

---

## 3. Directory Structure

```
driveai/
├── config.json                     # Central runtime configuration
├── requirements.txt                # Python dependencies
├── README.md                       # Comprehensive documentation
├── backend/
│   ├── app.py                      # FastAPI web server & REST endpoints
│   ├── config.py                   # Configuration parser
│   ├── database.py                 # SQLite session storage (sessions.db)
│   ├── model_adapter.py            # Adapter for existing YOLO/PyTorch model
│   ├── control_adapter.py          # ACC & AEB rule-based driving logic
│   └── simulation_engine.py        # 50 km road kinematics & traffic engine
└── frontend/
    ├── index.html                  # Automotive dark-theme mission dashboard
    ├── css/
    │   └── style.css               # Modern glassmorphic styling
    └── js/
        ├── simulation3d.js         # Three.js 3D road, car mesh & multi-camera
        ├── camera_stream.js        # Webcam/video stream controller
        ├── history.js              # Session logs & SQLite audit table
        └── dashboard.js            # Telemetry sync & keyboard drive handler
run_driveai.py                      # Single-command application launcher
```

---

## 4. Installation & Quick Start

### Step 1: Install Dependencies
Ensure you have Python 3.9+ installed. From the repository root, run:
```bash
pip install -r driveai/requirements.txt
```

### Step 2: Launch Application
Run the unified launcher:
```bash
python3 run_driveai.py
```

The system will start the backend server at `http://127.0.0.1:8000` and automatically open your default browser.

To disable auto-opening the browser:
```bash
python3 run_driveai.py --no-browser --port 8000
```

---

## 5. Integrating Your Existing Model

You can connect your existing trained model without retraining.

### Step 1: Place Your Model File
Copy your `.pt` or `.onnx` weights into the project directory (e.g., `driveai/models/my_custom_model.pt` or root `yolov8n.pt`).

### Step 2: Edit `driveai/config.json`
Open `driveai/config.json` and adjust the `model` block:

```json
{
  "model": {
    "model_path": "path/to/your/model.pt",
    "framework": "ultralytics_yolov8",
    "input_size": [640, 640],
    "confidence_threshold": 0.35,
    "device": "cpu",
    "inference_frequency_hz": 20,
    "supported_classes": ["car", "bus", "truck", "motorcycle", "pedestrian", "person"]
  }
}
```

### Supported Frameworks:
- **`ultralytics_yolov8`**: Loads `.pt` or `.onnx` models natively via `ultralytics.YOLO`.
- **PyTorch Native / TorchScript**: Configure `framework` to `pytorch` and specify input tensor normalization in `driveai/backend/model_adapter.py`.
- **Custom Inference**: If your model outputs a custom tensor format, simply override the `_run_inference()` method inside `driveai/backend/model_adapter.py`.

---

## 6. How to Use the System

### 6.1 Manual Driving Mode
1. Click **Manual Driving** in the navigation sidebar or mode toggle.
2. Use your keyboard to control the vehicle:
   - <kbd>W</kbd> or <kbd>↑</kbd>: Accelerate (Forward gear)
   - <kbd>S</kbd> or <kbd>↓</kbd>: Brake / Reverse
   - <kbd>A</kbd> or <kbd>←</kbd>: Steer Left
   - <kbd>D</kbd> or <kbd>→</kbd>: Steer Right
   - <kbd>Space</kbd>: Emergency Handbrake
   - <kbd>Esc</kbd>: Pause Simulation
3. You can also click the on-screen directional buttons and gear selectors (`P`, `R`, `N`, `D`).

### 6.2 AI-Assisted Driving Demo Mode
1. Click **AI Driving Demo** in the top navigation.
2. Select your target cruising speed (e.g., 60 km/h).
3. The simulation vehicle automatically accelerates and maintains lane alignment.
4. When approaching simulated or camera-detected traffic:
   - **Lead vehicle > 20 m**: Adaptive Cruise Control slows the car down smoothly to match lead vehicle speed.
   - **Lead vehicle < 12 m**: Automatic Emergency Braking (AEB) activates, flashing an alert and stopping the vehicle safely.
   - **Road clear**: Resumes target speed automatically.

### 6.3 50 km Procedural Road Simulation
- **Route Progress**: Tracks real-time completion from `0.0 km` to `50.0 km`.
- **3 Traffic Presets**:
  - `Normal Traffic`: 6 traffic vehicles, gentle speeds.
  - `Busy City Traffic`: 14 traffic vehicles, moderate lane shifts.
  - `Heavy Traffic Challenge`: 24 dense vehicles including trucks and buses with variable braking.
- **3 Camera Views**: Toggle between **Chase View** (behind car), **Cockpit / Hood View** (driver perspective), and **Top-Down Orthographic View**.

### 6.4 Live Camera Stream
- Select **Live Camera** mode.
- Choose **Webcam** (device index 0) or **Prerecorded Video** (`perception/perception_simulation_demo.mp4`).
- Toggle **Run Inference** to view real-time bounding boxes, class labels, and latency metrics.

### 6.5 Session History & Reports
- Every driving run is logged with timestamps, distance travelled, max speed, average speed, detections, and warning count.
- Click **End & Save Session** or use the **Session History** tab to review previous drives stored in `driveai/sessions.db`.

---

## 7. Testing & Verification Checklist

| Test Item | Verification Procedure | Expected Outcome | Status |
|-----------|------------------------|------------------|--------|
| **1. Server Launch** | Run `python3 run_driveai.py` | Starts on `http://127.0.0.1:8000` with banner | Passed |
| **2. Model Validation** | Verify `GET /api/model/status` | Reports `loaded: true`, model path, framework | Passed |
| **3. Manual Controls** | Press W/A/S/D keys | Speedometer increases, steering indicator reacts | Passed |
| **4. 3D Viewport** | Switch Chase / Hood / Top-down | Three.js renders 3D car mesh and traffic smoothly | Passed |
| **5. Traffic Presets** | Select Normal, Busy City, Heavy | Dynamic obstacle count updates on HUD | Passed |
| **6. 50 km Distance** | Drive forward for 30 seconds | Distance travelled increases, remaining decreases | Passed |
| **7. ACC / AEB Action** | Trigger AI Mode near lead car | UI shows `AEB Triggered` warning, vehicle stops | Passed |
| **8. Video Streaming** | View Live Camera tab | MJPEG stream renders with bounding boxes | Passed |
| **9. Database Audit** | Click "End & Save Session" | Row saved to SQLite and rendered in history table | Passed |

---

## 8. College Seminar / Presentation Walkthrough

When presenting this project to an evaluator or audience:

1. **Introduction (1 min)**:
   - State the project title: *DriveAI — Intelligent Driving & Road Simulation System*.
   - Explain the core motivation: Bridging computer vision with interactive simulation for safe autonomous driving validation.
2. **Perception Integration (2 mins)**:
   - Navigate to the **Live Camera** tab.
   - Show the real-time YOLOv8 bounding boxes and latency timer (~15-25 ms on CPU/GPU).
   - *Key Point*: Highlight that the model operates as a validated perception module, and explain the architecture adapter design.
3. **Manual Driving & Vehicle Kinematics (2 mins)**:
   - Switch to **Manual Driving Mode** in Chase or Cockpit view.
   - Demonstrate acceleration, steering limits, gear shifting (D to R), and emergency braking.
4. **Autonomous Demonstration Mode (3 mins)**:
   - Switch to **AI Driving Demo**.
   - Show how the vehicle tracks the 50 km procedural route.
   - Select **Heavy Traffic Challenge** to demonstrate Adaptive Cruise Control slowing down behind traffic and Automatic Emergency Braking (AEB) stopping for stationary obstacles.
5. **Session History & Analytics (1 min)**:
   - Save the session and open the **Session History** table.
   - Show persistent SQLite analytics including total distance, average speed, and safety interventions.
6. **Conclusion**:
   - Summarize the modular architecture: ready for deployment, zero real-vehicle risk, extensible for reinforcement learning or end-to-end steering models.
