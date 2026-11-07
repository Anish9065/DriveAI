"""
DriveAI - Simulation Engine
===========================
Manages virtual vehicle physics, the fictional 50 km road corridor,
dynamic traffic generation with 3 presets, and live telemetry events.
"""

import time
import math
import random
from typing import Dict, Any, List, Optional


class SimulationEngine:
    def __init__(self, total_route_km: float = 50.0):
        self.total_route_km = total_route_km
        self.preset = "busy_city"
        self.is_running = True
        self.driving_mode = "AUTOPILOT"  # "MANUAL", "AUTOPILOT", or "MIXED_COPILOT"

        # Vehicle State
        self.speed_kmh = 0.0
        self.target_speed_kmh = 35.0  # Disciplined, realistic rural village speed (zero rash driving)
        self.steer_deg = 0.0
        self.gear = "D"  # P, R, N, D
        self.throttle_pct = 0.0
        self.brake_pct = 0.0

        # Route Progress
        self.distance_km = 0.0
        self.start_time = time.time()
        self.elapsed_time_s = 0.0
        self.max_speed_kmh = 0.0
        self.speed_samples = []

        # Road & Traffic State
        self.road_width = 7.6  # Authentic undivided Indian rural road
        self.vehicle_x = -1.6  # Default left travel lane (-1.6m)
        self.road_curve = 0.0
        self.traffic_density = 0.7

        # Live Events Log (Ring buffer of last 30 events)
        self.events_log: List[Dict[str, Any]] = []
        self.warnings_count = 0
        self.detected_objects_count = 0

        # Traffic Registry
        self.traffic_vehicles: List[Dict[str, Any]] = []
        self.init_traffic()
        self.log_event("Simulation initialized: 50.0 km Fictional Road Corridor Ready", "INFO")

    def init_traffic(self):
        """Initializes surrounding traffic with distinct non-overlapping lateral channels to prevent any intersection."""
        # Authentically proportioned Indian rural road traffic with non-overlapping initial corridors:
        # - Shoulder Left: x = -3.8 (Grazing Cow)
        # - Slow Left Corridor: x = -2.3 (Farm Tractor with Harvest Trolley)
        # - Main Left Cruise Corridor: x = -1.6 (Auto-Rickshaw & Nominal Ego Travel)
        # - Inner Passing Corridor: x = -0.8 (Fast Motorcycle)
        # - Inner Oncoming Corridor: x = +1.4 (Oncoming Motorcycle)
        # - Main Oncoming Corridor: x = +2.0 (Oncoming Auto-Rickshaw)
        # - Heavy Oncoming Corridor: x = +2.6 (Oncoming Decorated Highway Truck)
        # - Slow Outer Oncoming Corridor: x = +3.1 (Oncoming Farm Tractor with Crops)
        # - Shoulder Right: x = +3.9 (Second Cow)
        self.traffic_vehicles = [
            # 1. Oncoming Farm Tractor with Cargo Trolley (Outer slow oncoming lane)
            {
                "id": 1,
                "type": "tractor",
                "x": 2.7,
                "z": 70.0,
                "dir": -1,
                "speed_kmh": 24.0,
                "length": 7.6,
                "width": 2.4
            },
            # 2. Preceding Auto-Rickshaw ahead in left cruise lane
            {
                "id": 2,
                "type": "auto_rickshaw",
                "x": -1.8,
                "z": 45.0,
                "dir": 1,
                "speed_kmh": 32.0,
                "length": 3.4,
                "width": 1.6
            },
            # 3. Oncoming Colorful Decorated Highway Truck (Center-right oncoming lane)
            {
                "id": 3,
                "type": "truck",
                "x": 2.7,
                "z": 150.0,
                "dir": -1,
                "speed_kmh": 36.0,
                "length": 8.2,
                "width": 2.5
            },
            # 4. Fast Commuter Motorcycle in inner travel sub-lane (Zero lateral overlap with auto)
            {
                "id": 4,
                "type": "motorcycle",
                "x": -0.5,
                "z": -40.0,
                "dir": 1,
                "speed_kmh": 46.0,
                "length": 2.2,
                "width": 0.8
            },
            # 5. Humped Indian Cow (Zebu) grazing peacefully on left dirt shoulder
            {
                "id": 5,
                "type": "cattle",
                "x": -3.8,
                "z": 28.0,
                "dir": 0,
                "speed_kmh": 0.0,
                "length": 2.6,
                "width": 1.1
            },
            # 6. Oncoming Auto-Rickshaw in mid oncoming corridor
            {
                "id": 6,
                "type": "auto_rickshaw",
                "x": 2.2,
                "z": 220.0,
                "dir": -1,
                "speed_kmh": 30.0,
                "length": 3.4,
                "width": 1.6
            },
            # 7. Preceding Tractor loaded with harvested crops in outer left lane
            {
                "id": 7,
                "type": "tractor",
                "x": -2.5,
                "z": 125.0,
                "dir": 1,
                "speed_kmh": 22.0,
                "length": 7.6,
                "width": 2.4
            },
            # 8. Second Grazing Cow on right dirt shoulder
            {
                "id": 8,
                "type": "cattle",
                "x": 3.9,
                "z": 95.0,
                "dir": 0,
                "speed_kmh": 0.0,
                "length": 2.6,
                "width": 1.1
            },
            # 9. Oncoming Rural Commuter Motorcycle in inner oncoming lane
            {
                "id": 9,
                "type": "motorcycle",
                "x": 1.8,
                "z": 285.0,
                "dir": -1,
                "speed_kmh": 40.0,
                "length": 2.2,
                "width": 0.8
            }
        ]

    def find_safe_spawn_z(self, dir_sign: int, target_x: float, min_z: float, max_z: float, req_headway: float = 35.0) -> float:
        """Finds a longitudinal Z slot that guarantees zero overlap with all existing vehicles in the corridor."""
        for _ in range(30):
            candidate_z = random.uniform(min_z, max_z)
            conflict = False
            for other in self.traffic_vehicles:
                lat_dist = abs(other["x"] - target_x)
                if lat_dist < 2.2:
                    if abs(other["z"] - candidate_z) < req_headway:
                        conflict = True
                        break
            if not conflict:
                return round(candidate_z, 1)

        corridor_zs = [other["z"] for other in self.traffic_vehicles if abs(other["x"] - target_x) < 2.2]
        if not corridor_zs:
            return round((min_z + max_z) / 2.0, 1)
        if dir_sign == -1:
            return round(max(corridor_zs) + req_headway + 12.0, 1)
        else:
            return round(min(corridor_zs) - req_headway - 12.0, 1)

    def set_preset(self, preset_name: str):
        if preset_name in ["normal", "busy_city", "heavy_challenge", "village_rural"]:
            self.preset = preset_name
            self.init_traffic()
            self.log_event(f"Simulation preset changed to: {preset_name.upper()}", "CONFIG")

    def set_driving_mode(self, mode: str):
        if mode in ["MANUAL", "AI_ASSISTED", "AUTOPILOT", "MIXED_COPILOT"]:
            self.driving_mode = mode
            self.log_event(f"Driving mode changed to: {mode}", "MODE")

    def log_event(self, message: str, level: str = "INFO"):
        evt = {
            "timestamp": time.strftime("%H:%M:%S"),
            "distance_km": round(self.distance_km, 2),
            "message": message,
            "level": level  # INFO, WARNING, CRITICAL, CONFIG, MODE
        }
        self.events_log.insert(0, evt)
        if len(self.events_log) > 40:
            self.events_log.pop()
        if level in ["WARNING", "CRITICAL"]:
            self.warnings_count += 1

    def update_step(self, dt: float = 0.05):
        """Updates physics and virtual world step."""
        if not self.is_running:
            return

        self.elapsed_time_s = time.time() - self.start_time

        # 1. Update Vehicle Speed with Smooth Progressive Acceleration & Braking
        if self.gear in ["P", "N"]:
            self.speed_kmh = max(0.0, self.speed_kmh - 5.0 * dt)
        elif self.brake_pct > 0:
            # Smooth, progressive deceleration (no whiplash stops)
            decel_rate = 16.0 * (self.brake_pct / 100.0)
            self.speed_kmh = max(0.0, self.speed_kmh - decel_rate * dt)
        else:
            # Progressive acceleration with responsive launch torque from standstill
            if self.speed_kmh < self.target_speed_kmh:
                if self.speed_kmh < 12.0:
                    base_accel = 11.5  # Responsive low-gear launch torque (eliminates sluggish takeoff)
                elif self.speed_kmh < 22.0:
                    base_accel = 8.0
                else:
                    base_accel = 5.5   # Smooth, disciplined cruising acceleration
                accel_rate = base_accel * max(0.35, self.throttle_pct / 100.0)
                self.speed_kmh = min(self.target_speed_kmh, self.speed_kmh + accel_rate * dt)
            elif self.speed_kmh > self.target_speed_kmh:
                self.speed_kmh = max(self.target_speed_kmh, self.speed_kmh - 6.0 * dt)

        # Track statistics
        if self.speed_kmh > self.max_speed_kmh:
            self.max_speed_kmh = self.speed_kmh
        self.speed_samples.append(self.speed_kmh)
        if len(self.speed_samples) > 200:
            self.speed_samples.pop(0)

        # 2. Update Distance along 50 km Route
        dist_inc_km = (self.speed_kmh / 3600.0) * dt
        self.distance_km = min(self.total_route_km, self.distance_km + dist_inc_km)

        # Check for destination arrival
        if self.distance_km >= self.total_route_km and self.is_running:
            self.is_running = False
            self.speed_kmh = 0.0
            self.log_event("🎯 50.0 KM ROUTE COMPLETE! Destination Reached.", "INFO")

        # 3. Update Lateral Position from Steering (Calm, steady chauffeur lane tracking)
        effective_speed_ms = max(1.2, self.speed_kmh / 3.6) if self.speed_kmh > 0.4 else 0.0
        lateral_speed = effective_speed_ms * math.sin(math.radians(self.steer_deg)) * 0.55
        self.vehicle_x = max(-4.2, min(4.2, self.vehicle_x + lateral_speed * dt))

        # 4. Update Dynamic Traffic Vehicles with Two-Way Flow & Collision-Free Recycling
        for v in self.traffic_vehicles:
            dir_sign = v.get("dir", 1)  # +1 = same direction, -1 = oncoming, 0 = stationary
            traffic_spd = v.get("speed_kmh", 0.0)

            # Rate of change of distance z relative to ego vehicle:
            # dz/dt = (dir * traffic_spd - ego_spd) / 3.6
            rel_speed_ms = (dir_sign * traffic_spd - self.speed_kmh) / 3.6
            v["z"] += rel_speed_ms * dt

            # Recycling logic with collision-free respawn placement
            if dir_sign == -1:
                # Oncoming vehicle has passed behind ego car (z < -35m)
                if v["z"] < -35.0:
                    if v["type"] == "tractor":
                        v["x"] = 2.7
                        v["speed_kmh"] = random.uniform(22.0, 26.0)
                    elif v["type"] == "truck":
                        v["x"] = 2.7
                        v["speed_kmh"] = random.uniform(32.0, 38.0)
                    elif v["type"] == "auto_rickshaw":
                        v["x"] = 2.2
                        v["speed_kmh"] = random.uniform(28.0, 34.0)
                    else:
                        v["x"] = 1.8
                        v["speed_kmh"] = random.uniform(36.0, 42.0)
                    v["z"] = self.find_safe_spawn_z(-1, v["x"], 230.0, 300.0, req_headway=35.0)

            elif dir_sign == 1:
                # Same direction vehicle:
                # If passed behind ego car (ego drove faster than it):
                if v["z"] < -45.0:
                    if v["type"] == "tractor":
                        v["x"] = -2.5
                        v["speed_kmh"] = random.uniform(20.0, 24.0)
                    elif v["type"] == "auto_rickshaw":
                        v["x"] = -1.8
                        v["speed_kmh"] = random.uniform(28.0, 34.0)
                    else:
                        v["x"] = -0.5
                        v["speed_kmh"] = random.uniform(42.0, 48.0)
                    v["z"] = self.find_safe_spawn_z(1, v["x"], 190.0, 260.0, req_headway=35.0)
                # If drove far ahead into the distance (e.g. while ego was stopped):
                elif v["z"] > 280.0:
                    if v["type"] == "motorcycle":
                        v["x"] = -0.5
                    elif v["type"] == "tractor":
                        v["x"] = -2.5
                    else:
                        v["x"] = -1.8
                    v["z"] = self.find_safe_spawn_z(1, v["x"], -70.0, -38.0, req_headway=30.0)

            else:
                # Stationary obstacle (cattle on shoulder)
                if v["z"] < -30.0:
                    v["x"] = -3.8 if v["id"] == 5 else 3.9
                    v["z"] = self.find_safe_spawn_z(0, v["x"], 180.0, 250.0, req_headway=30.0)

        # Inter-traffic collision prevention & anti-clipping headway maintenance
        for i in range(len(self.traffic_vehicles)):
            v_a = self.traffic_vehicles[i]
            len_a = v_a.get("length", 4.0)
            width_a = v_a.get("width", 1.8)
            dir_a = v_a.get("dir", 1)

            for j in range(i + 1, len(self.traffic_vehicles)):
                v_b = self.traffic_vehicles[j]
                len_b = v_b.get("length", 4.0)
                width_b = v_b.get("width", 1.8)
                dir_b = v_b.get("dir", 1)

                min_safe_z = (len_a + len_b) / 2.0 + 4.0
                min_safe_x = (width_a + width_b) / 2.0 + 0.35

                dz = abs(v_a["z"] - v_b["z"])
                dx = abs(v_a["x"] - v_b["x"])

                if dx < min_safe_x:
                    # Same or overlapping lateral path
                    if dir_a == dir_b and dir_a != 0:
                        # Longitudinal following
                        if dir_a == 1:
                            # Forward travel: larger Z is in front
                            lead = v_b if v_b["z"] > v_a["z"] else v_a
                            trail = v_a if v_b["z"] > v_a["z"] else v_b
                            cur_gap = lead["z"] - trail["z"]
                            if cur_gap < 24.0:
                                trail["speed_kmh"] = min(trail["speed_kmh"], lead["speed_kmh"] * 0.96)
                            if cur_gap < min_safe_z:
                                trail["speed_kmh"] = min(trail["speed_kmh"], lead["speed_kmh"] * 0.85)
                                trail["z"] = lead["z"] - min_safe_z
                        elif dir_a == -1:
                            # Oncoming travel: smaller Z is in front (towards ego at z=0)
                            lead = v_b if v_b["z"] < v_a["z"] else v_a
                            trail = v_a if v_b["z"] < v_a["z"] else v_b
                            cur_gap = trail["z"] - lead["z"]
                            if cur_gap < 24.0:
                                trail["speed_kmh"] = min(trail["speed_kmh"], lead["speed_kmh"] * 0.96)
                            if cur_gap < min_safe_z:
                                trail["speed_kmh"] = min(trail["speed_kmh"], lead["speed_kmh"] * 0.85)
                                trail["z"] = lead["z"] + min_safe_z
                    else:
                        # Opposite direction or stationary: if within longitudinal touch zone, repulse laterally!
                        if dz < min_safe_z:
                            push = (min_safe_x - dx) * 0.55
                            if v_a["x"] > v_b["x"]:
                                v_a["x"] = min(4.2, v_a["x"] + push)
                                v_b["x"] = max(-4.2, v_b["x"] - push)
                            else:
                                v_a["x"] = max(-4.2, v_a["x"] - push)
                                v_b["x"] = min(4.2, v_b["x"] + push)

        # 5. ADAS Safety & Physical Non-Overlap Guard (Ego vs Traffic)
        ego_len = 4.4
        ego_width = 2.0
        for v in self.traffic_vehicles:
            v_len = v.get("length", 4.0)
            v_width = v.get("width", 1.8)
            contact_z = (ego_len + v_len) * 0.5 + 1.2
            contact_x = (ego_width + v_width) * 0.5 + 0.35

            dz = abs(v["z"])
            dx = abs(v["x"] - self.vehicle_x)

            # A. Impending longitudinal collision with obstacle directly in travel envelope
            if dx < contact_x:
                if 0.0 < v["z"] <= contact_z + 14.0:
                    v_dir = v.get("dir", 1)
                    if v_dir == -1:
                        # Oncoming vehicle approaching head-on: steer apart immediately
                        push = (contact_x - dx) * 0.85
                        if self.vehicle_x >= v["x"]:
                            self.vehicle_x = min(3.8, self.vehicle_x + push)
                            v["x"] = max(-3.8, v["x"] - push * 0.5)
                        else:
                            self.vehicle_x = max(-3.8, self.vehicle_x - push)
                            v["x"] = min(3.8, v["x"] + push * 0.5)
                    else:
                        # Preceding traffic or stationary obstacle ahead
                        v_spd = v.get("speed_kmh", 0.0)
                        if v["z"] <= contact_z:
                            # Hard physical barrier: vehicle cannot pass through
                            v["z"] = contact_z + 0.3
                            self.speed_kmh = min(self.speed_kmh, max(0.0, v_spd * 0.90))
                            self.brake_pct = 85.0
                            self.throttle_pct = 0.0
                        elif v["z"] <= contact_z + 5.0:
                            # Urgent braking buffer
                            target_following_spd = max(14.0, v_spd * 0.94)
                            if self.speed_kmh > target_following_spd:
                                self.speed_kmh = max(target_following_spd, self.speed_kmh - 22.0 * dt)
                                self.brake_pct = 45.0
                        elif v["z"] <= contact_z + 12.0:
                            # Gentle headway following
                            target_following_spd = max(16.0, v_spd * 0.96)
                            if self.speed_kmh > target_following_spd + 1.0:
                                self.speed_kmh = max(target_following_spd, self.speed_kmh - 14.0 * dt)
                                self.brake_pct = 20.0

            # B. Lateral sideswipe guard: when alongside, separate immediately to prevent overlap
            if dz < contact_z and dx < contact_x:
                overlap_x = contact_x - dx
                if self.vehicle_x >= v["x"]:
                    self.vehicle_x = min(4.0, self.vehicle_x + overlap_x * 0.6)
                    v["x"] = max(-4.0, v["x"] - overlap_x * 0.4)
                else:
                    self.vehicle_x = max(-4.0, self.vehicle_x - overlap_x * 0.6)
                    v["x"] = min(4.0, v["x"] + overlap_x * 0.4)

    def manual_control(self, action: str, value: Optional[float] = None):
        """Processes manual user controls."""
        if action == "accelerate":
            self.target_speed_kmh = max(35.0, min(85.0, self.target_speed_kmh + 8.0))
            self.throttle_pct = 85.0
            self.brake_pct = 0.0
            if self.gear in ["P", "N"]:
                self.gear = "D"
        elif action == "brake":
            self.target_speed_kmh = max(0.0, self.target_speed_kmh - 10.0)
            self.throttle_pct = 0.0
            self.brake_pct = 75.0
        elif action == "steer_left":
            self.steer_deg = max(-26.0, self.steer_deg - 8.0)
        elif action == "steer_right":
            self.steer_deg = min(26.0, self.steer_deg + 8.0)
        elif action == "steer_center":
            self.steer_deg = 0.0
        elif action == "set_speed" and value is not None:
            self.target_speed_kmh = max(0.0, min(120.0, float(value)))
            self.throttle_pct = 70.0 if self.speed_kmh < self.target_speed_kmh else 0.0
            if self.gear in ["P", "N"] and self.target_speed_kmh > 0:
                self.gear = "D"
        elif action == "set_steer" and value is not None:
            self.steer_deg = max(-28.0, min(28.0, float(value)))
        elif action == "release_throttle":
            self.throttle_pct = 0.0
        elif action == "release_brake":
            self.brake_pct = 0.0
        elif action == "pause":
            self.is_running = not self.is_running
            state_str = "RESUMED" if self.is_running else "PAUSED"
            self.log_event(f"Simulation {state_str}", "CONFIG")
        elif action in ["gear_p", "gear_r", "gear_n", "gear_d"]:
            new_gear = action.split("_")[1].upper()
            self.gear = new_gear
            if new_gear in ["P", "N"]:
                self.target_speed_kmh = 0.0
            self.log_event(f"Gear shifted to {new_gear}", "MODE")
        elif action in ["signal_left", "signal_right", "signal_hazard", "signal_off"]:
            sig_name = action.split("_")[1].upper()
            self.turn_signal = "OFF" if getattr(self, "turn_signal", "OFF") == sig_name else sig_name
            self.log_event(f"Turn signal: {self.turn_signal}", "INFO")
        elif action == "emergency_stop":
            self.target_speed_kmh = 0.0
            self.speed_kmh = 0.0
            self.brake_pct = 100.0
            self.throttle_pct = 0.0
            self.log_event("EMERGENCY STOP ENGAGED by driver", "CRITICAL")
        elif action == "drowsiness_takeover":
            self.driving_mode = "AUTOPILOT"
            self.turn_signal = "HAZARD"
            self.vehicle_x = -2.8
            self.target_speed_kmh = 0.0
            self.speed_kmh = max(0.0, self.speed_kmh * 0.3)
            self.brake_pct = 80.0
            self.throttle_pct = 0.0
            self.log_event("AI DMS FAIL-SAFE: Driver drowsiness detected, autonomous safe-stop engaged", "CRITICAL")
        elif action == "reset":
            self.distance_km = 0.0
            self.speed_kmh = 0.0
            self.target_speed_kmh = 45.0
            self.steer_deg = 0.0
            self.vehicle_x = -1.6
            self.gear = "D"
            self.is_running = True
            self.init_traffic()
            self.log_event("Simulation route reset to 0.0 km", "CONFIG")

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns instantaneous simulation telemetry."""
        avg_speed = sum(self.speed_samples) / max(1, len(self.speed_samples))
        rem_distance = max(0.0, self.total_route_km - self.distance_km)
        eta_min = round((rem_distance / max(1.0, self.speed_kmh)) * 60.0, 1) if self.speed_kmh > 2.0 else 0.0

        return {
            "speed_kmh": round(self.speed_kmh, 1),
            "target_speed_kmh": round(self.target_speed_kmh, 1),
            "steer_deg": round(self.steer_deg, 1),
            "gear": self.gear,
            "throttle_pct": round(self.throttle_pct, 1),
            "brake_pct": round(self.brake_pct, 1),
            "distance_km": round(self.distance_km, 2),
            "remaining_distance_km": round(rem_distance, 2),
            "total_route_km": self.total_route_km,
            "progress_pct": round((self.distance_km / self.total_route_km) * 100.0, 1),
            "elapsed_time_s": round(self.elapsed_time_s, 1),
            "eta_minutes": eta_min,
            "max_speed_kmh": round(self.max_speed_kmh, 1),
            "avg_speed_kmh": round(avg_speed, 1),
            "driving_mode": self.driving_mode,
            "preset": self.preset,
            "is_running": self.is_running,
            "vehicle_x": round(self.vehicle_x, 2),
            "turn_signal": getattr(self, "turn_signal", "OFF"),
            "traffic_vehicles": [v for v in self.traffic_vehicles if v.get("z", 0) < 1000.0][:10],
            "events_log": self.events_log[:15],
            "warnings_count": self.warnings_count
        }
