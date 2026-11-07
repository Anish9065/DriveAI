# Autonomous Perception & Fusion Subsystem Interface Specification
**SAE J3016 Automated Driving Systems Standard Data Interface Specification**

This document defines the formal architectural data contract between the **Perception & State Estimation Subsystem**, **Spatiotemporal Trajectory Planner**, and **Vehicle Control Executive** for the Master's Thesis research project.

---

## 1. Coordinate Frame & Units Standard

- **Coordinate System**: **ISO 8855 / SAE J670 Vehicle-Fixed Coordinates (Ego-centric)**
  - $+X$: Forward along the vehicle heading (longitudinal axis)
  - $+Y$: Left side of the vehicle (lateral axis)
  - $+Z$: Upward (vertical axis)
  - Origin $(0, 0, 0)$: Center of the Ego vehicle rear axle on the road surface
- **Units**:
  - Distance / Position: Meters ($\text{m}$)
  - Velocity / Speed: Meters per second ($\text{m/s}$)
  - Angles / Heading: Degrees ($-180^\circ$ to $+180^\circ$, where $0^\circ$ is along $+X$, positive counter-clockwise)
  - Update Frequency: $10\text{ Hz}$ ($\Delta t = 0.1\text{ s}$)

---

## 2. Standard Target Class Enumeration

| ClassID | Class Name | Description | Typical 3D Bounding Box $[L, W, H]$ (m) |
|---|---|---|---|
| **1** | `car` | Passenger cars, sedans, hatchbacks, taxis | $[4.5, 1.8, 1.5]$ |
| **2** | `bus` | Transit & private buses | $[10.5, 2.5, 3.2]$ |
| **3** | `truck` | Medium/heavy duty lorries | $[8.0, 2.4, 3.0]$ |
| **4** | `auto_rickshaw` | Indian 3-wheeler (Tuk-Tuk) | $[2.6, 1.3, 1.7]$ |
| **5** | `two_wheeler` | Motorcycles, scooters, mopeds | $[1.8, 0.7, 1.2]$ |
| **6** | `bicycle` | Bicycles, cycle rickshaws | $[1.6, 0.5, 1.1]$ |
| **7** | `pedestrian` | Pedestrians, children, road workers | $[0.5, 0.5, 1.7]$ |
| **8** | `pushcart` | Hand-pushed vegetable/fruit/goods carts | $[1.8, 1.2, 1.4]$ |
| **9** | `cattle` | Cows, bullocks, stray cattle, stray animals | $[2.2, 0.9, 1.5]$ |

---

## 3. Data Structure Definitions

### MATLAB / Simulink Bus: `TrackedObject_Bus`

```matlab
TrackedObject = struct(...
    'TrackID',         uint32(101), ...          % Unique persistent tracking ID
    'ClassID',         uint8(4), ...             % Class enum (1-9)
    'Class',           "auto_rickshaw", ...      % String name
    'ClassConfidence', single(0.92), ...         % Detection confidence [0.0 - 1.0]
    'Position',        single([15.2, -1.8, 0.0]),% [X, Y, Z] relative to Ego rear axle in meters
    'Velocity',        single([4.5, 0.2, 0.0]),  % [Vx, Vy, Vz] in m/s
    'Speed',           single(4.504), ...        % Absolute speed in m/s
    'Heading',         single(2.54), ...         % Yaw angle in degrees relative to Ego +X
    'BoundingBox3D',   single([2.6, 1.3, 1.7]),  % [Length, Width, Height] in meters
    'Covariance',      single(diag([...])), ...  % 6x6 State covariance matrix
    'IsConfirmed',     true, ...                 % Track status (true after M-of-N confirmation)
    'Age',             uint32(14) ...            % Age of track in sensor frames
);
```

### Top-Level Bus: `TrackedObjectList_Bus`

```matlab
TrackedObjectList = struct(...
    'NumObjects', uint32(5), ...                 % Total number of active confirmed tracks
    'Timestamp',  double(12.4), ...              % Simulation time in seconds
    'Objects',    [TrackedObject1, ...] ...      % Array of TrackedObject (up to max 30)
);
```

---

## 4. How Teammates Use This Immediately

### For AI/ML #2 (Prediction):
Use `perception/interface/generate_mock_tracked_objects.m` to receive sample streams for any of the 5 test scenarios (e.g. `'cattle_crossing_event'`, `'dense_market_area'`).

```matlab
% In your prediction loop:
mockData = generate_mock_tracked_objects('dense_market_area', t);
% Predict future trajectory for each object in mockData.Objects
```

### For Full-Stack #1 (Path Planning & Simulink):
Run `perception/interface/TrackedObjectList_BusDefinition.m` once. The Simulink Bus objects will be loaded in the base workspace, allowing input ports in Simulink models to be typed directly as `TrackedObjectList_Bus`.
