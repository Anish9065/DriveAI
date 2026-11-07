"""
controllers.py
DriveAI Autonomous Vehicle Module: Tracking & Safety Control
============================================================
Implements:
  1. Non-linear Stanley Lateral Steering Controller (Front-axle feedback law).
  2. Pure Pursuit Geometric Lateral Controller (Lookahead arc law) for comparative benchmarking.
  3. Cascaded Longitudinal Velocity PID Controller.
  4. Time-to-Collision (TTC) & Berkeley Safe Stopping Distance AEB Interlock.
"""

import math
from typing import Tuple, List, Dict, Any, Optional
from .vehicle_models import VehicleParameters


class StanleyLateralController:
    """
    Stanley Steering Control Law (Stanford University DARPA Grand Challenge).
    Governing Equation:
      delta(t) = k_yaw * theta_e(t) + arctan( (k * e_fa(t)) / (v(t) + k_soft) )
    where:
      - theta_e: Heading error relative to path tangent at closest waypoint.
      - e_fa: Lateral cross-track error measured from FRONT AXLE to path.
      - k: Cross-track gain.
      - k_soft: Softening velocity to eliminate low-speed numerical singularity.
    """

    def __init__(
        self,
        k: float = 0.75,
        k_soft: float = 1.0,
        k_yaw: float = 1.2,
        params: VehicleParameters = VehicleParameters()
    ):
        self.k = k
        self.k_soft = k_soft
        self.k_yaw = k_yaw
        self.params = params

    def compute_steering(
        self,
        ego_pose: Tuple[float, float, float, float],
        path_x: List[float],
        path_y: List[float],
        path_yaw: List[float]
    ) -> Tuple[float, float, float]:
        """
        Returns (steer_angle_rad, cross_track_error_m, yaw_error_rad).
        """
        x, y, yaw, v = ego_pose

        # 1. Compute front axle position
        fx = x + self.params.dist_cg_front * math.cos(yaw)
        fy = y + self.params.dist_cg_front * math.sin(yaw)

        # 2. Find closest trajectory point to front axle
        min_idx = 0
        min_dist_sq = float("inf")
        for i in range(len(path_x)):
            d_sq = (path_x[i] - fx) ** 2 + (path_y[i] - fy) ** 2
            if d_sq < min_dist_sq:
                min_dist_sq = d_sq
                min_idx = i

        target_x = path_x[min_idx]
        target_y = path_y[min_idx]
        target_yaw = path_yaw[min_idx]

        # 3. Heading error
        yaw_err = math.atan2(math.sin(target_yaw - yaw), math.cos(target_yaw - yaw))

        # 4. Front-axle cross-track error (projection along path normal)
        # Vector from target path point to front axle
        dx = fx - target_x
        dy = fy - target_y
        # Normal vector pointing 90 deg left of target yaw
        nx = -math.sin(target_yaw)
        ny = math.cos(target_yaw)
        # Signed lateral displacement (+ if vehicle is to the left of path, - if to the right)
        cross_track_err = dx * nx + dy * ny

        # 5. Stanley Steering Control Law:
        # If vehicle is to the right of path (cross_track_err < 0), steer angle must be POSITIVE (steer left towards path).
        # delta = k_yaw * yaw_err + arctan( -k * cross_track_err / (v + k_soft) )
        steer_crosstrack = math.atan2(-self.k * cross_track_err, v + self.k_soft)
        raw_steer = self.k_yaw * yaw_err + steer_crosstrack

        # 6. Actuator saturation
        steer_cmd = max(min(raw_steer, self.params.max_steer_rad), -self.params.max_steer_rad)

        return (steer_cmd, cross_track_err, yaw_err)


class PurePursuitController:
    """
    Geometric Pure Pursuit Lateral Controller (for comparative benchmark).
    Governing Equation:
      delta = arctan( (2 * L * sin(alpha)) / l_d )
    """

    def __init__(
        self,
        k_lookahead: float = 0.4,
        lookahead_min: float = 3.0,
        params: VehicleParameters = VehicleParameters()
    ):
        self.k_lookahead = k_lookahead
        self.lookahead_min = lookahead_min
        self.params = params

    def compute_steering(
        self,
        ego_pose: Tuple[float, float, float, float],
        path_x: List[float],
        path_y: List[float]
    ) -> Tuple[float, float]:
        x, y, yaw, v = ego_pose
        l_d = max(self.lookahead_min, self.k_lookahead * v)

        # Rear axle position
        rx = x - self.params.dist_cg_rear * math.cos(yaw)
        ry = y - self.params.dist_cg_rear * math.sin(yaw)

        # Search for lookahead target point
        target_idx = len(path_x) - 1
        for i in range(len(path_x)):
            d = math.hypot(path_x[i] - rx, path_y[i] - ry)
            if d >= l_d:
                target_idx = i
                break

        tx = path_x[target_idx]
        ty = path_y[target_idx]

        # Angle alpha between vehicle heading and lookahead vector
        alpha = math.atan2(ty - ry, tx - rx) - yaw
        alpha = math.atan2(math.sin(alpha), math.cos(alpha))

        # Pure Pursuit steering angle
        raw_steer = math.atan2(2.0 * self.params.wheelbase * math.sin(alpha), l_d)
        steer_cmd = max(min(raw_steer, self.params.max_steer_rad), -self.params.max_steer_rad)

        cross_track_approx = math.sin(alpha) * math.hypot(tx - rx, ty - ry)
        return (steer_cmd, cross_track_approx)


class LongitudinalController:
    """
    Cascaded Speed PID Controller with Integrated Anti-Windup & Time-To-Collision (TTC) AEB.
    """

    def __init__(
        self,
        kp: float = 0.85,
        ki: float = 0.15,
        kd: float = 0.05,
        params: VehicleParameters = VehicleParameters()
    ):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.params = params
        self.integral_error = 0.0
        self.prev_error = 0.0

    def compute_control(
        self,
        current_speed: float,
        target_speed: float,
        dt: float = None,
        closest_obstacle_dist: float = float("inf"),
        obstacle_rel_speed: float = 0.0
    ) -> Tuple[float, bool, str]:
        """
        Returns (acceleration_cmd, aeb_active, decision_reason).
        """
        dt = dt or self.params.dt

        # 1. Autonomous Emergency Braking (AEB) Logic
        # Time-to-Collision = distance / relative approach speed
        approach_speed = max(0.5, current_speed - obstacle_rel_speed)
        ttc = closest_obstacle_dist / approach_speed if closest_obstacle_dist < float("inf") else float("inf")

        if closest_obstacle_dist < 6.0 or ttc < 1.1:
            self.integral_error = 0.0  # Reset integrator
            return (self.params.emergency_decel, True, f"🚨 CRITICAL AEB: TTC={ttc:.1f}s, Dist={closest_obstacle_dist:.1f}m")

        if closest_obstacle_dist < 15.0 or ttc < 2.2:
            return (self.params.max_decel, True, f"⚠️ PRE-CRASH BRAKING: TTC={ttc:.1f}s, Dist={closest_obstacle_dist:.1f}m")

        # 2. Longitudinal PID Tracking
        error = target_speed - current_speed
        self.integral_error += error * dt
        # Anti-windup clamping
        self.integral_error = max(min(self.integral_error, 5.0), -5.0)

        derivative = (error - self.prev_error) / max(1e-4, dt)
        self.prev_error = error

        raw_accel = self.kp * error + self.ki * self.integral_error + self.kd * derivative
        accel_cmd = max(min(raw_accel, self.params.max_accel), self.params.max_decel)

        return (accel_cmd, False, "🟢 NOMINAL: Velocity tracking active")

