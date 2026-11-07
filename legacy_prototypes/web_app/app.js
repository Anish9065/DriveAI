/**
 * ===================================================================
 * NAV-BHARAT AV DIGITAL TWIN & SIMULATION ENGINE (app.js)
 * Implements:
 *   - Werling Frenet Frame Optimal Trajectory Generation (Quintic)
 *   - Stanley Lateral Steering Controller & Cascaded Longitudinal AEB
 *   - 60 FPS HTML5 Canvas BEV & Forward Perception AI Overlays
 *   - Interactive Indian Obstacle Spawner & Multi-Sensor Fusion
 * ===================================================================
 */

// ---------------- Vehicle & Simulation Parameters ----------------
const PARAMS = {
  dt: 0.05,                  // Simulation timestep (20 Hz physics, 60 FPS interpolated)
  wheelbase: 2.70,           // L (m) - Tata Nexon EV
  lf: 1.20,                  // Front axle distance (m)
  lr: 1.50,                  // Rear axle distance (m)
  width: 1.80,               // Vehicle width (m)
  length: 4.00,              // Vehicle length (m)
  maxSteerDeg: 25.0,         // Max front wheel steer (+/- deg)
  maxSteerRad: 25.0 * Math.PI / 180.0,
  targetSpeed: 8.33,         // Target velocity ~ 30 km/h (m/s)
  maxAccel: 2.0,             // Max acceleration (m/s^2)
  maxBrake: -6.0,            // Max emergency braking (m/s^2)
  stanleyK: 0.85,            // Cross-track gain
  stanleySoft: 1.0,          // Softening velocity
  stanleyKYaw: 1.2,          // Heading gain
  roadHalfWidth: 3.5,        // Total road corridor = 7.0m
  safetyMargin: 0.35,        // Safe distance from road curb
};

// ---------------- Reference Road Geometry (120m Corridor) ----------------
const ROAD_LENGTH = 120;
const ROAD_POINTS = [];
for (let s = 0; s <= ROAD_LENGTH; s += 0.5) {
  // Realistic Indian undulating terrain curvature
  const x = s;
  const y = 2.2 * Math.sin(s / 18.0) + 0.8 * Math.sin(s / 35.0);
  ROAD_POINTS.push({ s, x, y });
}

// Compute tangents & headings
for (let i = 0; i < ROAD_POINTS.length; i++) {
  const next = ROAD_POINTS[Math.min(i + 1, ROAD_POINTS.length - 1)];
  const prev = ROAD_POINTS[Math.max(i - 1, 0)];
  ROAD_POINTS[i].yaw = Math.atan2(next.y - prev.y, next.x - prev.x);
  ROAD_POINTS[i].curv = 0;
}

// ---------------- Simulation State ----------------
let isRunning = true;
let simSpeed = 1.0;
let simTime = 0.0;
let currentScenario = 'cattle';
let currentTool = 'cow';

// Ego State: [x, y, yaw, v]
let ego = {
  x: 0.0,
  y: 0.0,
  yaw: ROAD_POINTS[0].yaw,
  v: 0.0,
  steer: 0.0,
  accel: 0.0,
  s: 0.0,
  d: 0.0,
  s_d: 0.0,
  d_d: 0.0,
  cte: 0.0,
  yawErr: 0.0,
  latAccel: 0.0,
  aebActive: false,
  ttc: Infinity
};

// Trajectory Storage
let candidateTrajectories = [];
let optimalTrajectory = null;

// Obstacle Registry
let obstacles = [];

// ---------------- Scenario Definitions ----------------
const SCENARIOS = {
  cattle: [
    { id: 1, name: 'Stray Cattle (Cow)', type: 'cow', x: 42.0, y: -0.6, vx: 0.0, vy: 0.0, radius: 1.3, color: '#f59e0b' },
    { id: 2, name: 'Slow Auto-Rickshaw', type: 'rickshaw', x: 80.0, y: 1.2, vx: 1.8, vy: 0.0, radius: 1.1, color: '#10b981' }
  ],
  rickshaw: [
    { id: 1, name: 'Slow Auto-Rickshaw', type: 'rickshaw', x: 30.0, y: 0.5, vx: 1.6, vy: 0.0, radius: 1.1, color: '#10b981' },
    { id: 2, name: 'Parked Pushcart', type: 'pushcart', x: 65.0, y: -1.8, vx: 0.0, vy: 0.0, radius: 1.0, color: '#eab308' },
    { id: 3, name: 'Two-Wheeler Moped', type: 'bike', x: 92.0, y: 1.4, vx: 2.2, vy: 0.0, radius: 0.9, color: '#38bdf8' }
  ],
  pedestrian: [
    { id: 1, name: 'Jaywalking Pedestrian', type: 'pedestrian', x: 38.0, y: -2.8, vx: 0.0, vy: 0.65, radius: 0.85, color: '#ec4899' },
    { id: 2, name: 'Stray Dog', type: 'cow', x: 75.0, y: 0.4, vx: 0.2, vy: 0.0, radius: 0.7, color: '#f97316' }
  ],
  potholes: [
    { id: 1, name: 'Deep Monsoonal Pothole', type: 'pothole', x: 28.0, y: 0.8, vx: 0.0, vy: 0.0, radius: 1.0, color: '#64748b' },
    { id: 2, name: 'Severe Pothole Cluster', type: 'pothole', x: 55.0, y: -1.2, vx: 0.0, vy: 0.0, radius: 1.1, color: '#64748b' },
    { id: 3, name: 'V-Barricade Construction', type: 'barricade', x: 84.0, y: 1.4, vx: 0.0, vy: 0.0, radius: 1.0, color: '#ef4444' }
  ]
};

function loadScenario(name) {
  currentScenario = name;
  obstacles = JSON.parse(JSON.stringify(SCENARIOS[name] || SCENARIOS.cattle));
  resetEgo();
  updateUI();
}

function resetEgo() {
  ego = {
    x: 0.0,
    y: ROAD_POINTS[0].y,
    yaw: ROAD_POINTS[0].yaw,
    v: 0.0,
    steer: 0.0,
    accel: 1.2,
    s: 0.0,
    d: 0.0,
    s_d: 0.0,
    d_d: 0.0,
    cte: 0.0,
    yawErr: 0.0,
    latAccel: 0.0,
    aebActive: false,
    ttc: Infinity
  };
  simTime = 0.0;
  planTrajectory();
}

// ---------------- Frenet Coordinate Converter ----------------
function cartesianToFrenet(x, y) {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < ROAD_POINTS.length; i++) {
    const pt = ROAD_POINTS[i];
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  const ref = ROAD_POINTS[minIdx];
  const dx = x - ref.x;
  const dy = y - ref.y;
  // Cross product to get signed lateral distance d
  const d = -dx * Math.sin(ref.yaw) + dy * Math.cos(ref.yaw);
  return { s: ref.s, d, refIdx: minIdx };
}

function frenetToCartesian(s, d) {
  // Find point along road points
  const idx = Math.min(Math.max(0, Math.floor(s / 0.5)), ROAD_POINTS.length - 1);
  const ref = ROAD_POINTS[idx];
  const x = ref.x - d * Math.sin(ref.yaw);
  const y = ref.y + d * Math.cos(ref.yaw);
  return { x, y, yaw: ref.yaw };
}

// ---------------- Werling Frenet Trajectory Optimizer ----------------
function planTrajectory() {
  const frenet = cartesianToFrenet(ego.x, ego.y);
  ego.s = frenet.s;
  ego.d = frenet.d;
  
  const safeDMax = PARAMS.roadHalfWidth - PARAMS.width / 2.0 - PARAMS.safetyMargin; // +2.25m
  const safeDMin = -safeDMax; // -2.25m

  const targetDs = [];
  for (let d = safeDMin; d <= safeDMax + 0.01; d += 0.45) {
    targetDs.push(d);
  }

  const horizons = [2.5, 3.5, 4.5];
  const candidateSpeeds = [PARAMS.targetSpeed, PARAMS.targetSpeed * 0.5, 0.0];

  candidateTrajectories = [];
  let bestTraj = null;
  let minCost = Infinity;

  // Evaluate candidate quintic polynomial trajectories
  for (const targetD of targetDs) {
    for (const Ti of horizons) {
      for (const targetV of candidateSpeeds) {
        const traj = generateQuinticCandidate(ego.s, ego.v, 0, ego.d, 0, 0, targetD, targetV, Ti);
        const cost = evaluateTrajectoryCost(traj, obstacles, targetD, targetV, Ti);
        traj.cost = cost;
        candidateTrajectories.push(traj);

        if (cost < minCost) {
          minCost = cost;
          bestTraj = traj;
        }
      }
    }
  }

  optimalTrajectory = bestTraj || candidateTrajectories[0];
}

function generateQuinticCandidate(s0, s_d0, s_dd0, d0, d_d0, d_dd0, targetD, targetV, Ti) {
  // Lateral Quintic Polynomial: d(t) = a0 + a1*t + a2*t^2 + a3*t^3 + a4*t^4 + a5*t^5
  const a0 = d0;
  const a1 = d_d0;
  const a2 = 0.5 * d_dd0;

  // Matrix solve for [a3, a4, a5]
  const T = Ti, T2 = T * T, T3 = T2 * T, T4 = T3 * T, T5 = T4 * T;
  const deltaD = targetD - a0 - a1 * T - a2 * T2;
  const deltaV = 0 - a1 - 2 * a2 * T;
  const deltaA = 0 - 2 * a2;

  // Closed-form solution of 3x3 linear system
  const a3 = (10 * deltaD - 4 * deltaV * T + 0.5 * deltaA * T2) / T3;
  const a4 = (-15 * deltaD + 7 * deltaV * T - deltaA * T2) / T4;
  const a5 = (6 * deltaD - 3 * deltaV * T + 0.5 * deltaA * T2) / T5;

  // Longitudinal Quartic Polynomial for velocity tracking
  const b0 = s0;
  const b1 = s_d0;
  const b2 = 0.5 * s_dd0;
  const b3 = (4 * (targetV - b1) - 2 * b2 * T) / (3 * T2);
  const b4 = (-3 * (targetV - b1) + b2 * T) / (4 * T3);

  const points = [];
  const dtSample = 0.15;
  for (let t = 0; t <= Ti; t += dtSample) {
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
    const d_val = a0 + a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5;
    const s_val = b0 + b1 * t + b2 * t2 + b3 * t3 + b4 * t4;
    const pt = frenetToCartesian(s_val, d_val);
    points.push({ x: pt.x, y: pt.y, yaw: pt.yaw, s: s_val, d: d_val, t });
  }

  return { points, Ti, targetD, targetV };
}

function evaluateTrajectoryCost(traj, obstacles, targetD, targetV, Ti) {
  let cost = 0.0;
  // Deviation from road centerline
  cost += 1.2 * Math.abs(targetD);
  // Velocity tracking penalty
  cost += 1.8 * Math.abs(PARAMS.targetSpeed - targetV);
  // Time horizon penalty
  cost += 0.2 * Ti;

  // Collision Checking
  for (const pt of traj.points) {
    // Road edge violation penalty
    if (Math.abs(pt.d) > PARAMS.roadHalfWidth - PARAMS.width / 2.0) {
      cost += 100000.0; // Strictly prohibited outside road edge
    }

    for (const obs of obstacles) {
      // Dynamic obstacle position projection at time t
      const obsX = obs.x + obs.vx * pt.t;
      const obsY = obs.y + obs.vy * pt.t;
      const dist = Math.hypot(pt.x - obsX, pt.y - obsY);
      const safeBuffer = obs.radius + PARAMS.width / 2.0 + 0.4;
      if (dist < safeBuffer) {
        cost += 50000.0 / (dist + 0.01);
      }
    }
  }

  return cost;
}

// ---------------- Stanley Lateral Tracking Controller ----------------
function computeStanleyControl() {
  if (!optimalTrajectory || optimalTrajectory.points.length === 0) return 0.0;

  // 1. Front axle location
  const fx = ego.x + PARAMS.lf * Math.cos(ego.yaw);
  const fy = ego.y + PARAMS.lf * Math.sin(ego.yaw);

  // 2. Find nearest trajectory waypoint
  let minDist = Infinity;
  let nearestPt = optimalTrajectory.points[0];
  for (const pt of optimalTrajectory.points) {
    const d = Math.hypot(pt.x - fx, pt.y - fy);
    if (d < minDist) {
      minDist = d;
      nearestPt = pt;
    }
  }

  // 3. Heading error normalized to [-PI, PI]
  let yawErr = nearestPt.yaw - ego.yaw;
  yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr));

  // 4. Front axle cross-track error
  const vecX = fx - nearestPt.x;
  const vecY = fy - nearestPt.y;
  const normalX = -Math.sin(nearestPt.yaw);
  const normalY = Math.cos(nearestPt.yaw);
  const cte = vecX * normalX + vecY * normalY;

  // 5. Stanley control law
  const steerCrosstrack = Math.atan2(PARAMS.stanleyK * cte, ego.v + PARAMS.stanleySoft);
  const rawSteer = PARAMS.stanleyKYaw * yawErr + steerCrosstrack;

  // 6. Saturate to physical limit (+/- 25 deg)
  const steerCmd = Math.max(-PARAMS.maxSteerRad, Math.min(PARAMS.maxSteerRad, rawSteer));

  ego.cte = cte;
  ego.yawErr = yawErr;
  return steerCmd;
}

// ---------------- Longitudinal AEB Controller ----------------
function computeLongitudinalControl() {
  // Check closest obstacle in vehicle heading cone
  let minTTC = Infinity;
  let closestDist = Infinity;
  let emergencyStopNeeded = false;

  for (const obs of obstacles) {
    const dx = obs.x - ego.x;
    const dy = obs.y - ego.y;
    // Longitudinally ahead
    const longDist = dx * Math.cos(ego.yaw) + dy * Math.sin(ego.yaw);
    const latDist = Math.abs(-dx * Math.sin(ego.yaw) + dy * Math.cos(ego.yaw));

    if (longDist > 0 && latDist < 2.0) {
      if (longDist < closestDist) closestDist = longDist;
      const relSpeed = Math.max(0.1, ego.v - obs.vx);
      const ttc = longDist / relSpeed;
      if (ttc < minTTC) minTTC = ttc;

      // AEB Trigger Conditions
      if (ttc < 1.4 || longDist < 3.8) {
        emergencyStopNeeded = true;
      }
    }
  }

  ego.ttc = minTTC;
  ego.aebActive = emergencyStopNeeded;

  if (emergencyStopNeeded) {
    // Full AEB deceleration
    return PARAMS.maxBrake;
  }

  // Cascaded PID velocity tracking
  const speedError = PARAMS.targetSpeed - ego.v;
  const targetAccel = 1.0 * speedError;
  return Math.max(PARAMS.maxBrake, Math.min(PARAMS.maxAccel, targetAccel));
}

// ---------------- Simulation Step Loop ----------------
function stepSimulation() {
  const dt = PARAMS.dt * simSpeed;
  simTime += dt;

  // Update dynamic obstacles
  for (const obs of obstacles) {
    obs.x += obs.vx * dt;
    obs.y += obs.vy * dt;

    // Pedestrian bounce or reverse if near road boundary
    if (obs.type === 'pedestrian') {
      if (obs.y > 2.8) obs.vy = -Math.abs(obs.vy);
      if (obs.y < -2.8) obs.vy = Math.abs(obs.vy);
    }
    // Auto-rickshaw stop if at end
    if (obs.x > 115) obs.x = 25;
  }

  // Periodic replan at 5 Hz
  if (Math.floor(simTime / 0.2) > Math.floor((simTime - dt) / 0.2)) {
    planTrajectory();
  }

  // Controls
  const steerCmd = computeStanleyControl();
  const accelCmd = computeLongitudinalControl();

  // Dynamic Bicycle Kinematics
  ego.steer = steerCmd;
  ego.accel = accelCmd;
  ego.v = Math.max(0.0, ego.v + accelCmd * dt);

  const beta = Math.atan((PARAMS.lr / PARAMS.wheelbase) * Math.tan(ego.steer));
  ego.x += ego.v * Math.cos(ego.yaw + beta) * dt;
  ego.y += ego.v * Math.sin(ego.yaw + beta) * dt;
  ego.yaw += (ego.v / PARAMS.wheelbase) * Math.sin(ego.steer) * Math.cos(beta) * dt;

  // Calculate lateral acceleration
  ego.latAccel = (ego.v * ego.v) * Math.abs(Math.sin(ego.steer)) / PARAMS.wheelbase;

  // Loop back if finished road corridor
  if (ego.x > 118) {
    resetEgo();
  }
}

// ---------------- UI & Telemetry Sync ----------------
function updateUI() {
  // Speedometer
  const speedKmh = (ego.v * 3.6).toFixed(1);
  document.getElementById('val-speed').textContent = speedKmh;
  const speedArc = document.getElementById('speed-arc');
  const maxArc = 301.6;
  const speedPct = Math.min(1.0, ego.v / (45 / 3.6));
  speedArc.style.strokeDashoffset = maxArc - (maxArc * 0.75 * speedPct);

  // Steering Wheel
  const steerDeg = (ego.steer * 180 / Math.PI).toFixed(1);
  document.getElementById('val-steer').textContent = `${steerDeg > 0 ? '+' : ''}${steerDeg}°`;
  const steeringWheel = document.getElementById('steering-wheel');
  steeringWheel.style.transform = `rotate(${steerDeg * 3.0}deg)`;

  // Pedals
  const throttleFill = document.getElementById('throttle-fill');
  const brakeFill = document.getElementById('brake-fill');
  const throttlePct = document.getElementById('throttle-pct');
  const brakePct = document.getElementById('brake-pct');

  if (ego.accel > 0) {
    const tPct = Math.min(100, Math.round((ego.accel / PARAMS.maxAccel) * 100));
    throttleFill.style.height = `${tPct}%`;
    throttlePct.textContent = `${tPct}%`;
    brakeFill.style.height = '0%';
    brakePct.textContent = '0%';
  } else {
    const bPct = Math.min(100, Math.round((Math.abs(ego.accel) / Math.abs(PARAMS.maxBrake)) * 100));
    brakeFill.style.height = `${bPct}%`;
    brakePct.textContent = `${bPct}%`;
    throttleFill.style.height = '0%';
    throttlePct.textContent = '0%';
  }

  // Telemetry Cells
  document.getElementById('stat-cte').textContent = `${ego.cte >= 0 ? '+' : ''}${ego.cte.toFixed(2)} m`;
  document.getElementById('stat-yaw-err').textContent = `${(ego.yawErr * 180 / Math.PI).toFixed(1)}°`;
  document.getElementById('stat-lat-accel').textContent = `${ego.latAccel.toFixed(2)} m/s²`;
  document.getElementById('stat-frenet').textContent = `s: ${ego.s.toFixed(1)}m | d: ${ego.d.toFixed(2)}m`;
  document.getElementById('hud-road-progress').textContent = `${ego.x.toFixed(1)} / 120 m`;

  // AEB Banner
  const aebBanner = document.getElementById('aeb-alert-banner');
  const aebStatusText = document.getElementById('aeb-status-text');
  const aebSubtext = document.getElementById('aeb-subtext');
  const aebTtcVal = document.getElementById('aeb-ttc-val');

  if (ego.aebActive) {
    aebBanner.className = 'aeb-banner aeb-danger';
    aebStatusText.textContent = 'CRITICAL: EMERGENCY AEB ENGAGED • MAX BRAKING (-6.0 m/s²)';
    aebSubtext.textContent = `Immediate obstacle in vehicle path. Deceleration active to prevent collision.`;
    aebTtcVal.textContent = isFinite(ego.ttc) ? `${ego.ttc.toFixed(1)} s` : '< 1.0 s';
    aebTtcVal.className = 'ttc-val text-red';
  } else if (ego.ttc < 3.0) {
    aebBanner.className = 'aeb-banner aeb-caution';
    aebStatusText.textContent = 'CAUTION: OBSTACLE PROXIMITY BUFFER ACTIVE';
    aebSubtext.textContent = `Autonomous planner executing evasion trajectory within strict road boundaries.`;
    aebTtcVal.textContent = `${ego.ttc.toFixed(1)} s`;
    aebTtcVal.className = 'ttc-val text-amber';
  } else {
    aebBanner.className = 'aeb-banner aeb-safe';
    aebStatusText.textContent = 'AEB STATUS: NOMINAL • SAFE CLEARANCE';
    aebSubtext.textContent = 'Trajectory clearance within safe deceleration buffer (TTC > 3.0s)';
    aebTtcVal.textContent = isFinite(ego.ttc) ? `${ego.ttc.toFixed(1)} s` : '-- s';
    aebTtcVal.className = 'ttc-val text-emerald';
  }

  // Multi-Sensor Fusion Table
  const tableBody = document.getElementById('fusion-table-body');
  tableBody.innerHTML = '';
  obstacles.forEach(obs => {
    const dist = Math.hypot(obs.x - ego.x, obs.y - ego.y).toFixed(1);
    const relSpeed = (ego.v - obs.vx).toFixed(1);
    const isCritical = dist < 8.0 && Math.abs(obs.y - ego.y) < 2.0;
    const isModerate = dist < 18.0;

    let threatClass = 'threat-low';
    let threatText = 'LOW';
    if (isCritical) {
      threatClass = 'threat-high';
      threatText = 'CRITICAL';
    } else if (isModerate) {
      threatClass = 'threat-mod';
      threatText = 'MODERATE';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${obs.id}</td>
      <td><strong>${obs.name}</strong></td>
      <td>${dist}m</td>
      <td>${relSpeed} m/s</td>
      <td><span class="badge badge-accent">Cam+LiD+Rad</span></td>
      <td><span class="${threatClass}">${threatText}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

// ---------------- Canvas Rendering (BEV Digital Twin) ----------------
const bevCanvas = document.getElementById('bev-canvas');
const bevCtx = bevCanvas.getContext('2d');

function resizeCanvas() {
  bevCanvas.width = bevCanvas.parentElement.clientWidth;
  bevCanvas.height = bevCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function renderBEV() {
  const width = bevCanvas.width;
  const height = bevCanvas.height;

  // Background
  bevCtx.fillStyle = '#070b12';
  bevCtx.fillRect(0, 0, width, height);

  // Camera tracking: Center camera slightly ahead of ego vehicle
  const pixelsPerMeter = 14;
  const cameraOffsetX = width * 0.28 - ego.x * pixelsPerMeter;
  const cameraOffsetY = height * 0.50 - ego.y * pixelsPerMeter;

  bevCtx.save();
  bevCtx.translate(cameraOffsetX, cameraOffsetY);

  // 1. Draw Road Surface & Asphalt
  bevCtx.beginPath();
  // Left boundary
  for (let i = 0; i < ROAD_POINTS.length; i++) {
    const pt = ROAD_POINTS[i];
    const lx = (pt.x - PARAMS.roadHalfWidth * Math.sin(pt.yaw)) * pixelsPerMeter;
    const ly = (pt.y + PARAMS.roadHalfWidth * Math.cos(pt.yaw)) * pixelsPerMeter;
    if (i === 0) bevCtx.moveTo(lx, ly);
    else bevCtx.lineTo(lx, ly);
  }
  // Right boundary in reverse
  for (let i = ROAD_POINTS.length - 1; i >= 0; i--) {
    const pt = ROAD_POINTS[i];
    const rx = (pt.x + PARAMS.roadHalfWidth * Math.sin(pt.yaw)) * pixelsPerMeter;
    const ry = (pt.y - PARAMS.roadHalfWidth * Math.cos(pt.yaw)) * pixelsPerMeter;
    bevCtx.lineTo(rx, ry);
  }
  bevCtx.closePath();
  bevCtx.fillStyle = '#171f2f';
  bevCtx.fill();

  // 2. Draw Road Boundary Curbs (Solid Grey/Cyan)
  const drawBoundaries = document.getElementById('toggle-boundaries').checked;
  if (drawBoundaries) {
    bevCtx.strokeStyle = '#64748b';
    bevCtx.lineWidth = 3;
    bevCtx.stroke();
  }

  // 3. Draw Dashed Centerline
  bevCtx.beginPath();
  bevCtx.setLineDash([8, 8]);
  bevCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  bevCtx.lineWidth = 1.5;
  for (let i = 0; i < ROAD_POINTS.length; i++) {
    const pt = ROAD_POINTS[i];
    const cx = pt.x * pixelsPerMeter;
    const cy = pt.y * pixelsPerMeter;
    if (i === 0) bevCtx.moveTo(cx, cy);
    else bevCtx.lineTo(cx, cy);
  }
  bevCtx.stroke();
  bevCtx.setLineDash([]);

  // 4. Draw Sampled Frenet Candidate Trajectories
  const showCandidates = document.getElementById('toggle-candidates').checked;
  if (showCandidates && candidateTrajectories.length > 0) {
    for (const traj of candidateTrajectories) {
      if (traj === optimalTrajectory) continue;
      bevCtx.beginPath();
      bevCtx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
      bevCtx.lineWidth = 1;
      for (let i = 0; i < traj.points.length; i++) {
        const pt = traj.points[i];
        const px = pt.x * pixelsPerMeter;
        const py = pt.y * pixelsPerMeter;
        if (i === 0) bevCtx.moveTo(px, py);
        else bevCtx.lineTo(px, py);
      }
      bevCtx.stroke();
    }
  }

  // 5. Draw Optimal Chosen Trajectory (Glowing Gold)
  if (optimalTrajectory && optimalTrajectory.points.length > 0) {
    bevCtx.beginPath();
    bevCtx.strokeStyle = '#f59e0b';
    bevCtx.lineWidth = 4;
    bevCtx.shadowColor = '#f59e0b';
    bevCtx.shadowBlur = 10;
    for (let i = 0; i < optimalTrajectory.points.length; i++) {
      const pt = optimalTrajectory.points[i];
      const px = pt.x * pixelsPerMeter;
      const py = pt.y * pixelsPerMeter;
      if (i === 0) bevCtx.moveTo(px, py);
      else bevCtx.lineTo(px, py);
    }
    bevCtx.stroke();
    bevCtx.shadowBlur = 0;
  }

  // 6. Draw Indian Road Obstacles
  for (const obs of obstacles) {
    const ox = obs.x * pixelsPerMeter;
    const oy = obs.y * pixelsPerMeter;
    const rad = obs.radius * pixelsPerMeter;

    // Safety Bounding Bubble
    bevCtx.beginPath();
    bevCtx.arc(ox, oy, rad * 1.35, 0, 2 * Math.PI);
    bevCtx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    bevCtx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    bevCtx.lineWidth = 1.5;
    bevCtx.setLineDash([4, 4]);
    bevCtx.fill();
    bevCtx.stroke();
    bevCtx.setLineDash([]);

    // Obstacle Physical Footprint
    bevCtx.save();
    bevCtx.translate(ox, oy);

    if (obs.type === 'cow') {
      // Stray Cow Footprint
      bevCtx.fillStyle = '#b45309';
      bevCtx.beginPath();
      bevCtx.ellipse(0, 0, rad, rad * 0.65, 0, 0, 2 * Math.PI);
      bevCtx.fill();
      bevCtx.fillStyle = '#fef3c7';
      bevCtx.font = '12px sans-serif';
      bevCtx.fillText('🐂', -7, 4);
    } else if (obs.type === 'rickshaw') {
      // Auto-Rickshaw (Yellow & Green)
      bevCtx.fillStyle = '#eab308';
      bevCtx.fillRect(-rad, -rad * 0.7, rad * 2, rad * 1.4);
      bevCtx.fillStyle = '#15803d';
      bevCtx.fillRect(-rad * 0.8, -rad * 0.6, rad * 1.6, rad * 1.2);
      bevCtx.fillStyle = '#ffffff';
      bevCtx.font = '12px sans-serif';
      bevCtx.fillText('🛺', -7, 4);
    } else if (obs.type === 'pedestrian') {
      // Pedestrian
      bevCtx.fillStyle = '#ec4899';
      bevCtx.beginPath();
      bevCtx.arc(0, 0, rad * 0.8, 0, 2 * Math.PI);
      bevCtx.fill();
      bevCtx.font = '12px sans-serif';
      bevCtx.fillText('🚶', -6, 4);
    } else if (obs.type === 'pothole') {
      // Pothole
      bevCtx.fillStyle = '#334155';
      bevCtx.beginPath();
      bevCtx.arc(0, 0, rad, 0, 2 * Math.PI);
      bevCtx.fill();
      bevCtx.strokeStyle = '#ef4444';
      bevCtx.lineWidth = 2;
      bevCtx.stroke();
      bevCtx.font = '11px sans-serif';
      bevCtx.fillText('🕳️', -6, 4);
    } else {
      // Construction Barricade
      bevCtx.fillStyle = '#ef4444';
      bevCtx.fillRect(-rad, -rad * 0.4, rad * 2, rad * 0.8);
      bevCtx.fillStyle = '#ffffff';
      bevCtx.font = '11px sans-serif';
      bevCtx.fillText('🚧', -6, 4);
    }

    // Label tag
    bevCtx.fillStyle = '#f8fafc';
    bevCtx.font = '10px JetBrains Mono';
    bevCtx.fillText(`${obs.name}`, -rad, -rad - 4);

    bevCtx.restore();
  }

  // 7. Sensor Coverage Cones (LiDAR & Radar)
  const showLidar = document.getElementById('toggle-lidar').checked;
  const showRadar = document.getElementById('toggle-radar').checked;
  const egoPx = ego.x * pixelsPerMeter;
  const egoPy = ego.y * pixelsPerMeter;

  if (showLidar) {
    // 360 LiDAR Cloud Ring
    bevCtx.beginPath();
    bevCtx.arc(egoPx, egoPy, 22 * pixelsPerMeter, 0, 2 * Math.PI);
    bevCtx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    bevCtx.lineWidth = 1;
    bevCtx.setLineDash([2, 4]);
    bevCtx.stroke();
    bevCtx.setLineDash([]);
  }

  if (showRadar) {
    // Long Range Front Radar Arc
    bevCtx.beginPath();
    bevCtx.moveTo(egoPx, egoPy);
    bevCtx.arc(egoPx, egoPy, 35 * pixelsPerMeter, ego.yaw - 0.22, ego.yaw + 0.22);
    bevCtx.closePath();
    bevCtx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    bevCtx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    bevCtx.lineWidth = 1;
    bevCtx.fill();
    bevCtx.stroke();
  }

  // 8. Draw Ego Vehicle (Tata Nexon EV Footprint)
  bevCtx.save();
  bevCtx.translate(egoPx, egoPy);
  bevCtx.rotate(ego.yaw);

  const vehLen = PARAMS.length * pixelsPerMeter;
  const vehWid = PARAMS.width * pixelsPerMeter;

  // Headlight beams
  bevCtx.beginPath();
  bevCtx.moveTo(vehLen * 0.5, -vehWid * 0.35);
  bevCtx.lineTo(vehLen * 0.5 + 45, -vehWid * 0.8);
  bevCtx.lineTo(vehLen * 0.5 + 45, vehWid * 0.8);
  bevCtx.lineTo(vehLen * 0.5, vehWid * 0.35);
  bevCtx.closePath();
  bevCtx.fillStyle = 'rgba(255, 255, 200, 0.07)';
  bevCtx.fill();

  // Vehicle Body
  bevCtx.fillStyle = '#2563eb';
  bevCtx.strokeStyle = '#60a5fa';
  bevCtx.lineWidth = 2;
  bevCtx.beginPath();
  bevCtx.roundRect(-vehLen * 0.5, -vehWid * 0.5, vehLen, vehWid, 6);
  bevCtx.fill();
  bevCtx.stroke();

  // Windshield
  bevCtx.fillStyle = '#0f172a';
  bevCtx.fillRect(-vehLen * 0.05, -vehWid * 0.4, vehLen * 0.3, vehWid * 0.8);

  // Front Steerable Wheels (Dynamic Stanley rotation)
  bevCtx.fillStyle = '#020617';
  bevCtx.save();
  bevCtx.translate(PARAMS.lf * pixelsPerMeter, -vehWid * 0.55);
  bevCtx.rotate(ego.steer);
  bevCtx.fillRect(-6, -3, 12, 6);
  bevCtx.restore();

  bevCtx.save();
  bevCtx.translate(PARAMS.lf * pixelsPerMeter, vehWid * 0.55);
  bevCtx.rotate(ego.steer);
  bevCtx.fillRect(-6, -3, 12, 6);
  bevCtx.restore();

  // Rear Wheels
  bevCtx.fillRect(-PARAMS.lr * pixelsPerMeter - 6, -vehWid * 0.55 - 3, 12, 6);
  bevCtx.fillRect(-PARAMS.lr * pixelsPerMeter - 6, vehWid * 0.55 - 3, 12, 6);

  bevCtx.restore();

  bevCtx.restore();
}

// ---------------- Forward Perception Camera Canvas ----------------
const camCanvas = document.getElementById('camera-canvas');
const camCtx = camCanvas.getContext('2d');

function resizeCameraCanvas() {
  camCanvas.width = camCanvas.parentElement.clientWidth;
  camCanvas.height = camCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCameraCanvas);
resizeCameraCanvas();

function renderCameraView() {
  const w = camCanvas.width;
  const h = camCanvas.height;

  // Sky & Ambient
  camCtx.fillStyle = '#0d1525';
  camCtx.fillRect(0, 0, w, h * 0.45);

  // Road Perspective Asphalt
  camCtx.fillStyle = '#1e293b';
  camCtx.beginPath();
  camCtx.moveTo(w * 0.42, h * 0.45);
  camCtx.lineTo(w * 0.58, h * 0.45);
  camCtx.lineTo(w * 0.95, h);
  camCtx.lineTo(w * 0.05, h);
  camCtx.closePath();
  camCtx.fill();

  // Drivable Corridor Polygon Overlay (Cyan Glass)
  camCtx.fillStyle = 'rgba(0, 242, 254, 0.16)';
  camCtx.strokeStyle = 'rgba(0, 242, 254, 0.7)';
  camCtx.lineWidth = 2;
  camCtx.beginPath();
  camCtx.moveTo(w * 0.45, h * 0.45);
  camCtx.lineTo(w * 0.55, h * 0.45);
  camCtx.lineTo(w * 0.82, h);
  camCtx.lineTo(w * 0.18, h);
  camCtx.closePath();
  camCtx.fill();
  camCtx.stroke();

  // Perspective Dashed Lane Line
  camCtx.strokeStyle = '#f8fafc';
  camCtx.lineWidth = 3;
  camCtx.setLineDash([15, 12]);
  camCtx.beginPath();
  camCtx.moveTo(w * 0.50, h * 0.45);
  camCtx.lineTo(w * 0.50, h);
  camCtx.stroke();
  camCtx.setLineDash([]);

  // Render 3D-Projected Bounding Boxes for Obstacles
  for (const obs of obstacles) {
    const longDist = obs.x - ego.x;
    const latDist = obs.y - ego.y;

    if (longDist > 1.5 && longDist < 50.0) {
      // Perspective projection
      const scale = 1.0 / (longDist * 0.15 + 1.0);
      const screenX = w * 0.50 + latDist * 40 * scale;
      const screenY = h * 0.45 + (1.0 - scale) * (h * 0.55);
      const boxW = Math.max(28, 120 * scale);
      const boxH = Math.max(34, 150 * scale);

      // AI Detection Box
      camCtx.strokeStyle = obs.color || '#00f2fe';
      camCtx.lineWidth = 2.5;
      camCtx.strokeRect(screenX - boxW / 2, screenY - boxH, boxW, boxH);

      // Label Chip
      camCtx.fillStyle = obs.color || '#00f2fe';
      camCtx.fillRect(screenX - boxW / 2, screenY - boxH - 18, boxW + 20, 18);
      camCtx.fillStyle = '#050b14';
      camCtx.font = 'bold 11px Outfit, sans-serif';
      const conf = (92 + (obs.id * 3) % 7);
      camCtx.fillText(`${obs.name.split(' ')[0]} ${conf}%`, screenX - boxW / 2 + 4, screenY - boxH - 4);
    }
  }
}

// ---------------- Interactive Obstacle Spawner on BEV ----------------
bevCanvas.addEventListener('click', (e) => {
  const rect = bevCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const pixelsPerMeter = 14;
  const cameraOffsetX = bevCanvas.width * 0.28 - ego.x * pixelsPerMeter;
  const cameraOffsetY = bevCanvas.height * 0.50 - ego.y * pixelsPerMeter;

  const roadX = (clickX - cameraOffsetX) / pixelsPerMeter;
  const roadY = (clickY - cameraOffsetY) / pixelsPerMeter;

  // Create new obstacle at clicked coordinate
  const newId = obstacles.length + 1;
  let newObs = {
    id: newId,
    name: 'Custom Obstacle',
    type: currentTool,
    x: roadX,
    y: roadY,
    vx: 0.0,
    vy: 0.0,
    radius: 1.1,
    color: '#00f2fe'
  };

  if (currentTool === 'cow') {
    newObs.name = 'Stray Cattle';
    newObs.radius = 1.3;
    newObs.color = '#f59e0b';
  } else if (currentTool === 'rickshaw') {
    newObs.name = 'Auto-Rickshaw';
    newObs.vx = 1.5;
    newObs.radius = 1.1;
    newObs.color = '#10b981';
  } else if (currentTool === 'pedestrian') {
    newObs.name = 'Pedestrian';
    newObs.vy = 0.5;
    newObs.radius = 0.85;
    newObs.color = '#ec4899';
  } else if (currentTool === 'pothole') {
    newObs.name = 'Road Pothole';
    newObs.radius = 1.0;
    newObs.color = '#64748b';
  } else {
    newObs.name = 'V-Barricade';
    newObs.radius = 1.0;
    newObs.color = '#ef4444';
  }

  obstacles.push(newObs);
  planTrajectory();
});

// ---------------- Event Listeners & UI Controls ----------------
document.getElementById('btn-play-pause').addEventListener('click', () => {
  isRunning = !isRunning;
  document.getElementById('play-pause-icon').textContent = isRunning ? '⏸' : '▶';
  document.getElementById('play-pause-text').textContent = isRunning ? 'PAUSE' : 'PLAY';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  resetEgo();
});

document.querySelectorAll('.btn-speed').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    simSpeed = parseFloat(btn.dataset.speed);
  });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    resizeCanvas();
    resizeCameraCanvas();
  });
});

document.querySelectorAll('.scenario-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadScenario(btn.dataset.scenario);
  });
});

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

// Webcam Integration (if user selects webcam)
const cameraSelect = document.getElementById('camera-feed-select');
let webcamStream = null;
let webcamVideo = document.createElement('video');
webcamVideo.autoplay = true;
webcamVideo.playsInline = true;

cameraSelect.addEventListener('change', async (e) => {
  if (e.target.value === 'webcam') {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      webcamVideo.srcObject = webcamStream;
    } catch (err) {
      alert('Could not access webcam: ' + err.message);
      cameraSelect.value = 'simulated';
    }
  } else {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
  }
});

// ---------------- Master Animation Loop (60 FPS) ----------------
function mainLoop() {
  if (isRunning) {
    stepSimulation();
  }
  updateUI();
  renderBEV();
  renderCameraView();
  requestAnimationFrame(mainLoop);
}

// Initialize
loadScenario('cattle');
requestAnimationFrame(mainLoop);
