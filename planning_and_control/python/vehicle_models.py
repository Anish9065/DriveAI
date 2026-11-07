"""
vehicle_models.py
DriveAI Kinodynamic Vehicle State Dynamics Engine
=================================================
Implements:
  1. Kinematic Bicycle Model with Center-of-Gravity (CG) Slip Angle.
  2. Non-linear Dynamic Bicycle Model with Lateral Tire Slip Dynamics & Cornering Stiffness.
  3. Numerical Integration: Euler and Runge-Kutta 4th Order (RK4).
"""

import math
from dataclasses import dataclass
from typing import Tuple, List, Dict, Any


@dataclass
class VehicleParameters:
    # Geometry
    wheelbase: float = 2.6          # L (m)
    dist_cg_front: float = 1.2      # Lf (m)
    dist_cg_rear: float = 1.4       # Lr (m)
    width: float = 1.8              # Vehicle width (m)
    length: float = 4.0             # Vehicle length (m)
    safety_radius: float = 1.3      # Collision bounding circle (m)

    # Mass & Inertia
    mass: float = 1400.0            # Curb mass (kg)
    yaw_inertia: float = 2200.0     # Iz (kg*m^2)
    cornering_stiffness_front: float = 85000.0  # Cf (N/rad)
    cornering_stiffness_rear: float = 85000.0   # Cr (N/rad)

    # Physical Actuator Limits
    max_steer_deg: float = 35.0     # Maximum steering angle (+/- deg)
    max_steer_rad: float = math.radians(35.0)
    max_steer_rate: float = math.radians(25.0)  # rad/s
    max_accel: float = 3.0          # Comfort acceleration (m/s^2)
    max_decel: float = -4.0         # Comfort braking (m/s^2)
    emergency_decel: float = -7.5   # Peak emergency deceleration (m/s^2)

    # Simulation Discretization
    dt: float = 0.05                # 20 Hz time step (s)


class KinematicBicycleModel:
    """
    Standard Kinematic Single-Track (Bicycle) Model.
    Governing Equations:
      x_dot   = v * cos(psi + beta)
      y_dot   = v * sin(psi + beta)
      psi_dot = (v / L) * cos(beta) * tan(delta)
      beta    = atan2(Lr * tan(delta), L)
    """

    def __init__(self, params: VehicleParameters = VehicleParameters()):
        self.params = params

    def step(
        self,
        state: Tuple[float, float, float, float],
        steer_angle: float,
        acceleration: float,
        dt: float = None
    ) -> Tuple[float, float, float, float]:
        """
        Propagates state [x, y, psi, v] by dt seconds.
        """
        dt = dt or self.params.dt
        x, y, psi, v = state

        # Clamp inputs within actuator limits
        delta = max(min(steer_angle, self.params.max_steer_rad), -self.params.max_steer_rad)
        accel = max(min(acceleration, self.params.max_accel), self.params.emergency_decel)

        # Center of gravity slip angle
        beta = math.atan2(self.params.dist_cg_rear * math.tan(delta), self.params.wheelbase)

        # Derivatives
        x_dot = v * math.cos(psi + beta)
        y_dot = v * math.sin(psi + beta)
        psi_dot = (v / self.params.wheelbase) * math.cos(beta) * math.tan(delta)
        v_dot = accel

        # State Integration
        new_x = x + x_dot * dt
        new_y = y + y_dot * dt
        new_psi = math.atan2(math.sin(psi + psi_dot * dt), math.cos(psi + psi_dot * dt))
        new_v = max(0.0, v + v_dot * dt)

        return (new_x, new_y, new_psi, new_v)


class DynamicBicycleModel:
    """
    Non-linear Dynamic Bicycle Model including Tire Slip Angles and Lateral Forces.
    State Vector: [x, y, psi, vx, vy, omega]
      - (x, y): Global Cartesian coordinates
      - psi: Heading angle (yaw)
      - vx: Longitudinal velocity in vehicle body frame
      - vy: Lateral velocity in vehicle body frame
      - omega: Yaw rate (d_psi / dt)
    """

    def __init__(self, params: VehicleParameters = VehicleParameters()):
        self.params = params

    def derivatives(
        self,
        state: Tuple[float, float, float, float, float, float],
        delta: float,
        accel: float
    ) -> Tuple[float, float, float, float, float, float]:
        x, y, psi, vx, vy, omega = state
        p = self.params

        vx_safe = max(0.5, vx)

        # Front & Rear Tire Slip Angles
        alpha_f = delta - math.atan2(vy + p.dist_cg_front * omega, vx_safe)
        alpha_r = -math.atan2(vy - p.dist_cg_rear * omega, vx_safe)

        # Lateral Tire Forces (Linear tire model approximation)
        fy_f = 2.0 * p.cornering_stiffness_front * alpha_f
        fy_r = 2.0 * p.cornering_stiffness_rear * alpha_r

        # Equations of Motion in Vehicle Body Coordinates
        x_dot = vx * math.cos(psi) - vy * math.sin(psi)
        y_dot = vx * math.sin(psi) + vy * math.cos(psi)
        psi_dot = omega

        # Longitudinal and lateral acceleration
        vx_dot = accel + vy * omega
        vy_dot = ((fy_f * math.cos(delta) + fy_r) / p.mass) - vx * omega
        omega_dot = (p.dist_cg_front * fy_f * math.cos(delta) - p.dist_cg_rear * fy_r) / p.yaw_inertia

        return (x_dot, y_dot, psi_dot, vx_dot, vy_dot, omega_dot)

    def step_rk4(
        self,
        state: Tuple[float, float, float, float, float, float],
        delta: float,
        accel: float,
        dt: float = None
    ) -> Tuple[float, float, float, float, float, float]:
        """Runge-Kutta 4th Order numerical integration."""
        dt = dt or self.params.dt
        delta = max(min(delta, self.params.max_steer_rad), -self.params.max_steer_rad)
        accel = max(min(accel, self.params.max_accel), self.params.emergency_decel)

        def add_state(s, k, factor):
            return tuple(si + ki * factor for si, ki in zip(s, k))

        k1 = self.derivatives(state, delta, accel)
        s2 = add_state(state, k1, dt * 0.5)
        k2 = self.derivatives(s2, delta, accel)
        s3 = add_state(state, k2, dt * 0.5)
        k3 = self.derivatives(s3, delta, accel)
        s4 = add_state(state, k3, dt)
        k4 = self.derivatives(s4, delta, accel)

        next_state = list(state)
        for i in range(len(state)):
            next_state[i] += (dt / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i])

        # Normalize yaw to [-pi, pi]
        next_state[2] = math.atan2(math.sin(next_state[2]), math.cos(next_state[2]))
        # Clamp velocity to non-negative
        next_state[3] = max(0.0, next_state[3])

        return tuple(next_state)

