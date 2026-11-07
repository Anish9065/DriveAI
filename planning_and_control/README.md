# Module #2: Trajectory Planning & Simulink Vehicle Control Subsystem

This subsystem implements the complete planning, obstacle evasion, and vehicle control pipeline for the **Smart India Hackathon (SIH)** problem on **Adaptive Path Planning for Autonomous Driving in Unstructured Indian Road Conditions**.

---

## 📁 Architecture Overview

```
planning_and_control/
├── config/
│   └── vehicle_params.m                 # Physical parameters (Tata Nexon EV / Sedan)
├── planner/
│   └── frenet_optimal_trajectory.m      # Jerk-optimal Frenet frame trajectory planner
├── control/
│   ├── stanley_lateral_controller.m     # Stanley steering law with cross-track compensation
│   └── longitudinal_aeb_controller.m    # Cascaded PID velocity tracking & AEB Emergency Stop
├── simulation/
│   ├── vehicle_dynamic_bicycle_model.m  # Nonlinear bicycle vehicle dynamics propagator
│   └── run_integrated_simulation.m      # End-to-end BEV animation and telemetry dashboard
└── simulink/
    ├── load_simulink_workspace.m        # Simulink Bus definitions & workspace variables
    └── build_simulink_model.m           # Programmatic builder for .slx control model
```

---

## 🚀 How to Run

### 1. Python Simulation & Verification Engine (Platform-Independent, No MATLAB Required)
Run the automated comparative benchmark suite:
```bash
python3 benchmark_suite.py
```
Or import directly into research notebooks:
```python
from planning_and_control.python import (
    VehicleParameters,
    KinematicBicycleModel,
    DynamicBicycleModel,
    StanleyLateralController,
    FrenetOptimalPlanner
)
```

### 2. MATLAB / Simulink Simulation Environment
From the repository root in MATLAB:
```matlab
% Navigate to simulation folder
cd planning_and_control/simulation
run_integrated_simulation

% Load parameters & Simulink bus interfaces
cd ../simulink
load_simulink_workspace
build_simulink_model
```
