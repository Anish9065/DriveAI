# MathWorks RoadRunner + best.onnx Integration Guide

This guide explains how to connect your fine-tuned **`best.onnx`** road perception model to **MathWorks RoadRunner** & **RoadRunner Scenario** for 3D simulation.

---

## 🏗️ Architecture: How RoadRunner Connects to `best.onnx`

```
┌──────────────────────────────────────────┐
│         MathWorks RoadRunner 3D          │
│   (Indian Road Scene + 3D Actors)        │
└────────────────────┬─────────────────────┘
                     │  3D Synthetic Camera Stream (RGB)
                     ▼
┌──────────────────────────────────────────┐
│      MATLAB / Simulink Bridge Engine     │
│   ┌──────────────────────────────────┐   │
│   │         best.onnx                │   │
│   │  (Road Segmentation & Actors)    │   │
│   └─────────────────┬────────────────┘   │
│                     │  Drivable Corridor + Obstacle Bounding Boxes
│                     ▼                    │
│   ┌──────────────────────────────────┐   │
│   │   Frenet Planner & Stanley / AEB │   │
│   │        Vehicle Control           │   │
│   └─────────────────┬────────────────┘   │
└─────────────────────┼────────────────────┘
                      │  Steering Angle \delta(t) & Throttle/Brake a(t)
                      ▼
┌──────────────────────────────────────────┐
│    RoadRunner Scenario Ego Vehicle       │
│  (Vehicle Moves Autonomously in 3D Scene)│
└──────────────────────────────────────────┘
```

---

## 🚀 3 Simple Steps to Connect `best.onnx` to RoadRunner

### Step 1: Open RoadRunner and Load Your Scene
1. Launch **MathWorks RoadRunner** or **RoadRunner Scenario**.
2. Create or open your Indian road scenario (`.rrscene` or `.rrscenario`).
3. Add a **Camera Sensor** to the Ego vehicle in RoadRunner:
   - Go to **Vehicle Sensors** -> Add **RGB Camera Sensor**.
   - Set resolution: `640 x 480` or `640 x 640`.

---

### Step 2: Run the RoadRunner + ONNX Bridge Script in MATLAB
In your MATLAB Command Window:
```matlab
cd('c:\Users\narut\OneDrive\Desktop\sih\roadrunner_integration')
connect_roadrunner_onnx
```

**What Happens:**
1. Loads [`best.onnx`](file:///c:/Users/narut/OneDrive/Desktop/sih/perception/models/runs_idd/idd_road_seg/weights/best.onnx) into the high-speed ONNX runtime.
2. Captures camera frames from the RoadRunner synthetic vehicle sensor.
3. Renders the real-time **drivable road polygon** and **obstacle bounding boxes**.
4. Calculates the vehicle steering angle ($\pm 25^\circ$) and emergency braking commands.

---

### Step 3: Simulink Co-Simulation Block Setup (Optional)
If you are using the **RoadRunner Scenario Block** in Simulink:
1. Open your Simulink model: `autonomous_vehicle_control_system.slx`.
2. Insert the **RoadRunner Scenario Reader** block from the *Automated Driving Toolbox*.
3. Connect the camera output signal `CameraImage` -> **MATLAB Function (best.onnx)** block.
4. Route the output `SteeringAngle` and `Throttle` back into the **RoadRunner Scenario Writer** block.
5. Click **Run** in Simulink — the car will drive itself inside RoadRunner!
