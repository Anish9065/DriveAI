"""
frenet_planner.py
DriveAI Spatiotemporal Frenet Trajectory Optimization Engine
============================================================
Pure Python analytical solver (Zero external library dependency).
Implements:
  1. Jerk-optimal Quintic Polynomial Lateral Trajectories.
  2. Quartic Polynomial Longitudinal Velocity Targeting Profiles.
  3. Road Edge Constraint Verification & Dynamic Obstacle Collision Avoidance.
  4. Multi-objective Cost Minimization across Candidate Trajectory Bundles.
"""

import math
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
from .vehicle_models import VehicleParameters


def solve_3x3(A: List[List[float]], B: List[float]) -> List[float]:
    """Analytical 3x3 linear system solver via Cramer's rule."""
    det = (
        A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
        - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
        + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    )
    if abs(det) < 1e-9:
        return [0.0, 0.0, 0.0]
    inv_det = 1.0 / det

    x = (
        B[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
        - A[0][1] * (B[1] * A[2][2] - A[1][2] * B[2])
        + A[0][2] * (B[1] * A[2][1] - A[1][1] * B[2])
    ) * inv_det

    y = (
        A[0][0] * (B[1] * A[2][2] - A[1][2] * B[2])
        - B[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
        + A[0][2] * (A[1][0] * B[2] - B[1] * A[2][0])
    ) * inv_det

    z = (
        A[0][0] * (A[1][1] * B[2] - B[1] * A[2][1])
        - A[0][1] * (A[1][0] * B[2] - B[1] * A[2][0])
        + B[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    ) * inv_det

    return [x, y, z]


def solve_2x2(A: List[List[float]], B: List[float]) -> List[float]:
    """Analytical 2x2 linear system solver via Cramer's rule."""
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    if abs(det) < 1e-9:
        return [0.0, 0.0]
    return [
        (B[0] * A[1][1] - A[0][1] * B[1]) / det,
        (A[0][0] * B[1] - B[0] * A[1][0]) / det
    ]


class QuinticPolynomial:
    """
    Solves 1D boundary value problem for quintic trajectory:
      p(t) = a0 + a1*t + a2*t^2 + a3*t^3 + a4*t^4 + a5*t^5
    Given:
      p(0) = x0,  p_dot(0) = v0,  p_ddot(0) = a0
      p(T) = xT,  p_dot(T) = vT,  p_ddot(T) = aT
    """

    def __init__(self, x0: float, v0: float, a0: float, xT: float, vT: float, aT: float, T: float):
        self.a0 = x0
        self.a1 = v0
        self.a2 = 0.5 * a0

        T2 = T * T
        T3 = T2 * T
        T4 = T3 * T
        T5 = T4 * T

        A = [
            [T3, T4, T5],
            [3.0 * T2, 4.0 * T3, 5.0 * T4],
            [6.0 * T, 12.0 * T2, 20.0 * T3]
        ]
        B = [
            xT - self.a0 - self.a1 * T - self.a2 * T2,
            vT - self.a1 - 2.0 * self.a2 * T,
            aT - 2.0 * self.a2
        ]

        coeffs = solve_3x3(A, B)
        self.a3 = coeffs[0]
        self.a4 = coeffs[1]
        self.a5 = coeffs[2]

    def calc_point(self, t: float) -> float:
        return self.a0 + self.a1 * t + self.a2 * t**2 + self.a3 * t**3 + self.a4 * t**4 + self.a5 * t**5

    def calc_first_derivative(self, t: float) -> float:
        return self.a1 + 2.0 * self.a2 * t + 3.0 * self.a3 * t**2 + 4.0 * self.a4 * t**3 + 5.0 * self.a5 * t**4

    def calc_second_derivative(self, t: float) -> float:
        return 2.0 * self.a2 + 6.0 * self.a3 * t + 12.0 * self.a4 * t**2 + 20.0 * self.a5 * t**3

    def calc_third_derivative(self, t: float) -> float:
        return 6.0 * self.a3 + 24.0 * self.a4 * t + 60.0 * self.a5 * t**2


class QuarticPolynomial:
    """
    Solves quartic trajectory for longitudinal velocity targeting:
      s(0) = s0, s_dot(0) = v0, s_ddot(0) = a0
      s_dot(T) = vT, s_ddot(T) = aT
    """

    def __init__(self, s0: float, v0: float, a0: float, vT: float, aT: float, T: float):
        self.a0 = s0
        self.a1 = v0
        self.a2 = 0.5 * a0

        T2 = T * T
        T3 = T2 * T

        A = [
            [3.0 * T2, 4.0 * T3],
            [6.0 * T, 12.0 * T2]
        ]
        B = [
            vT - self.a1 - 2.0 * self.a2 * T,
            aT - 2.0 * self.a2
        ]

        coeffs = solve_2x2(A, B)
        self.a3 = coeffs[0]
        self.a4 = coeffs[1]

    def calc_point(self, t: float) -> float:
        return self.a0 + self.a1 * t + self.a2 * t**2 + self.a3 * t**3 + self.a4 * t**4

    def calc_first_derivative(self, t: float) -> float:
        return self.a1 + 2.0 * self.a2 * t + 3.0 * self.a3 * t**2 + 4.0 * self.a4 * t**3

    def calc_second_derivative(self, t: float) -> float:
        return 2.0 * self.a2 + 6.0 * self.a3 * t + 12.0 * self.a4 * t**2

    def calc_third_derivative(self, t: float) -> float:
        return 6.0 * self.a3 + 24.0 * self.a4 * t


@dataclass
class FrenetTrajectory:
    t: List[float] = None
    d: List[float] = None
    d_d: List[float] = None
    d_dd: List[float] = None
    d_ddd: List[float] = None
    s: List[float] = None
    s_d: List[float] = None
    s_dd: List[float] = None
    s_ddd: List[float] = None
    x: List[float] = None
    y: List[float] = None
    yaw: List[float] = None
    cost: float = 0.0
    is_valid: bool = True
    reason: str = "Valid"


class FrenetOptimalPlanner:
    """
    Generates bundles of lateral and longitudinal polynomial trajectories in the Frenet frame,
    evaluates multi-objective cost functions, and selects the optimal collision-free path.
    """

    def __init__(self, params: VehicleParameters = VehicleParameters()):
        self.params = params

        # Cost function weights
        self.K_JERK_LAT = 0.1
        self.K_JERK_LON = 0.1
        self.K_TIME     = 0.1
        self.K_DIFF_D   = 1.0
        self.K_DIFF_V   = 1.5
        self.K_COLL     = 1000.0

        # Safety & Road constraints (Indian road standard)
        self.ROAD_HALF_WIDTH = 3.6     # Standard lane width
        self.MAX_LAT_ACCEL   = 2.5     # Max comfort lateral acceleration (m/s^2)
        self.MIN_HORIZON_T   = 2.0     # Planning horizon (s)
        self.MAX_HORIZON_T   = 4.0
        self.DT_T            = 0.5

    def plan(
        self,
        s0: float, s_d0: float, s_dd0: float,
        d0: float, d_d0: float, d_dd0: float,
        target_speed: float,
        obstacles: List[Dict[str, float]],
        dt: float = 0.1
    ) -> Tuple[Optional[FrenetTrajectory], List[FrenetTrajectory]]:
        all_trajectories: List[FrenetTrajectory] = []

        candidate_d = [-2.5, -1.8, 0.0, 1.8, 2.5]
        candidate_v = [target_speed, target_speed * 0.7, 0.0]

        Ti = self.MIN_HORIZON_T
        while Ti <= self.MAX_HORIZON_T + 1e-4:
            for di in candidate_d:
                lat_poly = QuinticPolynomial(d0, d_d0, d_dd0, di, 0.0, 0.0, Ti)

                for vi in candidate_v:
                    lon_poly = QuarticPolynomial(s0, s_d0, s_dd0, vi, 0.0, Ti)

                    traj = FrenetTrajectory()
                    traj.t = []
                    t_val = 0.0
                    while t_val <= Ti + 1e-4:
                        traj.t.append(t_val)
                        t_val += dt

                    # Evaluate lateral states
                    traj.d = [lat_poly.calc_point(t) for t in traj.t]
                    traj.d_d = [lat_poly.calc_first_derivative(t) for t in traj.t]
                    traj.d_dd = [lat_poly.calc_second_derivative(t) for t in traj.t]
                    traj.d_ddd = [lat_poly.calc_third_derivative(t) for t in traj.t]

                    # Evaluate longitudinal states
                    traj.s = [lon_poly.calc_point(t) for t in traj.t]
                    traj.s_d = [lon_poly.calc_first_derivative(t) for t in traj.t]
                    traj.s_dd = [lon_poly.calc_second_derivative(t) for t in traj.t]
                    traj.s_ddd = [lon_poly.calc_third_derivative(t) for t in traj.t]

                    # Calculate Jerk Integrals
                    j_lat = sum(jd**2 for jd in traj.d_ddd) * dt
                    j_lon = sum(js**2 for js in traj.s_ddd) * dt

                    # Cost Function
                    cost = (
                        self.K_JERK_LAT * j_lat +
                        self.K_JERK_LON * j_lon +
                        self.K_TIME * Ti +
                        self.K_DIFF_D * (di**2) +
                        self.K_DIFF_V * ((vi - target_speed)**2)
                    )

                    # Dynamic & Road Boundary Constraints Check
                    if any(abs(d_val) > self.ROAD_HALF_WIDTH for d_val in traj.d):
                        traj.is_valid = False
                        traj.reason = "Crosses Road Boundary"
                    elif any(abs(dd_val) > self.MAX_LAT_ACCEL for dd_val in traj.d_dd):
                        traj.is_valid = False
                        traj.reason = "Exceeds Lateral Accel Limit"

                    # Obstacle Collision Checking
                    if traj.is_valid and obstacles:
                        for obs in obstacles:
                            obs_s = obs.get("s", 0.0)
                            obs_d = obs.get("d", 0.0)
                            obs_r = obs.get("radius", 1.2)
                            safety_dist = self.params.safety_radius + obs_r

                            # 1. Direct collision check along sampled spatiotemporal points
                            for s_pt, d_pt in zip(traj.s, traj.d):
                                dist = math.hypot(s_pt - obs_s, d_pt - obs_d)
                                if dist < safety_dist:
                                    traj.is_valid = False
                                    traj.reason = f"Collision Risk with {obs.get('name', 'Obstacle')}"
                                    cost += self.K_COLL
                                    break

                            # 2. Forward Corridor Projection: If candidate trajectory ends before obstacle
                            # but stays in the blocked lane at cruising speed, penalize future impending collision
                            if traj.is_valid:
                                terminal_s = traj.s[-1]
                                terminal_d = traj.d[-1]
                                terminal_v = traj.s_d[-1]
                                if terminal_s < obs_s and (obs_s - terminal_s) < 30.0 and terminal_v > 1.0:
                                    if abs(terminal_d - obs_d) < safety_dist:
                                        traj.is_valid = False
                                        traj.reason = f"Projected Collision with {obs.get('name', 'Obstacle')}"
                                        cost += self.K_COLL

                            if not traj.is_valid:
                                break

                    # Convert to Cartesian space
                    traj.x = list(traj.d)
                    traj.y = list(traj.s)
                    traj.yaw = [math.atan2(dd, max(0.1, sd)) for dd, sd in zip(traj.d_d, traj.s_d)]
                    traj.cost = cost

                    all_trajectories.append(traj)

            Ti += self.DT_T

        valid_trajectories = [t for t in all_trajectories if t.is_valid]
        if not valid_trajectories:
            best = min(all_trajectories, key=lambda t: t.cost) if all_trajectories else None
            return (best, all_trajectories)

        best_traj = min(valid_trajectories, key=lambda t: t.cost)
        return (best_traj, all_trajectories)
