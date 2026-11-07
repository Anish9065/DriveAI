/**
 * DriveAI - Master Dashboard & Telemetry Controller
 * Manages multi-view simulation migration, keyboard driving, audio synthesis,
 * dynamic model switching, and real-time Frenet optimal trajectory visualizer.
 */

class DriveAIDashboard {
  constructor() {
    this.drivingMode = 'AUTOPILOT';
    this.sim3D = null;
    this.telemetryInterval = null;
    this.currentView = 'dashboard-view';

    this.initElements();
    this.initNavigation();
    this.initControls();
    this.initKeyboard();
    this.loadAvailableModels();
    this.fetchModelStatus();
    this.startTelemetrySync();
  }

  initElements() {
    // Topbar & HUD
    this.topbarDist = document.getElementById('topbar-dist-val');
    this.topbarSpeed = document.getElementById('topbar-speed-val');
    this.routeBarFill = document.getElementById('route-bar-fill');
    this.hudDistRem = document.getElementById('hud-dist-rem');
    this.hudEtaVal = document.getElementById('hud-eta-val');

    // Cockpit Dials
    this.cpSpeed = document.getElementById('cp-speed-val');
    this.cpSteer = document.getElementById('cp-steer-val');
    this.cpTargetSpeed = document.getElementById('cp-target-speed');
    this.cpGear = document.getElementById('cp-gear-val');

    // Feeds & Logs
    this.tbodyDetections = document.getElementById('tbody-detections');
    this.eventsContainer = document.getElementById('events-log-container');

    // Mode labels
    this.activeModeLabel = document.getElementById('label-active-mode');
    this.activeModeIndicator = document.getElementById('indicator-active-mode');

    // Audio & Model Dropdowns
    this.btnAudio = document.getElementById('btn-topbar-audio');
    this.audioIcon = document.getElementById('audio-icon');
    this.audioText = document.getElementById('audio-status-text');
    this.modelSelect = document.getElementById('select-active-model');

    // Frenet Elements
    this.frenetCanvas = document.getElementById('frenet-canvas');
    this.frenetCtx = this.frenetCanvas ? this.frenetCanvas.getContext('2d') : null;
    this.frenetChips = document.getElementById('frenet-chips-container');
    this.frenetSelectedOffset = document.getElementById('frenet-selected-offset');

    // Initialize 3D Simulation
    this.sim3D = new RoadSimulation3D('sim3d-viewport');
  }

  initNavigation() {
    // Sidebar View Switching
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const viewId = btn.dataset.view;
        this.currentView = viewId;

        document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add('active');

        // Dynamic Simulation Viewport Migration
        this.reparentSimulationForView(viewId);

        // Automatic mode sync if clicking direct mode links
        if (viewId === 'manual-view') {
          this.setMode('MANUAL');
        } else if (viewId === 'ai-demo-view') {
          this.setMode('AUTOPILOT');
        } else if (viewId === 'config-view') {
          this.loadConfigView();
        }
      });
    });

    // Environment Lighting Pills (Day / Sunset / Night / Monsoon)
    document.querySelectorAll('.btn-env').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-env').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.env;
        if (this.sim3D) this.sim3D.setEnvironment(theme);
      });
    });

    // Sensor Mode Pills (3D Realistic vs. LiDAR Point Cloud)
    document.querySelectorAll('.btn-sensor-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-sensor-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.sensor;
        if (this.sim3D) this.sim3D.setSensorMode(mode);
      });
    });

    // Camera Angle Buttons
    document.querySelectorAll('.btn-angle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-angle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.sim3D) this.sim3D.setCameraView(btn.dataset.cam);
      });
    });

    // Live 3-Mode Driving Switcher
    document.querySelectorAll('.mode-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });

    // Preset Traffic Density Pills
    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setPreset(btn.dataset.preset);
      });
    });
  }

  reparentSimulationForView(viewId) {
    if (!this.sim3D) return;

    let targetHostId = 'sim3d-viewport';
    if (viewId === 'manual-view') {
      targetHostId = 'manual-sim-host';
    } else if (viewId === 'ai-demo-view') {
      targetHostId = 'ai-sim-host';
    } else if (viewId === 'road-sim-view') {
      targetHostId = 'road-sim-host';
    }

    const host = document.getElementById(targetHostId);
    if (host) {
      this.sim3D.reparent(host);
    }
  }

  initControls() {
    // Topbar Emergency Stop
    const btnEstop = document.getElementById('btn-topbar-estop');
    if (btnEstop) {
      btnEstop.addEventListener('click', () => this.sendControl('emergency_stop'));
    }

    // Audio Synthesizer Button
    if (this.btnAudio) {
      this.btnAudio.addEventListener('click', () => {
        if (window.driveAISound) {
          const isUnmuted = window.driveAISound.toggleMute();
          this.btnAudio.classList.toggle('active', isUnmuted);
          if (this.audioIcon) this.audioIcon.textContent = isUnmuted ? '🔊' : '🔇';
          if (this.audioText) this.audioText.textContent = isUnmuted ? 'Audio: ON (EV Motor Active)' : 'Audio: OFF';
        }
      });
    }

    // Model Selector Change
    if (this.modelSelect) {
      this.modelSelect.addEventListener('change', (e) => {
        this.switchModel(e.target.value);
      });
    }

    // Drive Pad Buttons
    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => this.sendControl(action));
    };

    bindBtn('btn-drive-accel', 'accelerate');
    bindBtn('btn-drive-brake', 'brake');
    bindBtn('btn-drive-left', 'steer_left');
    bindBtn('btn-drive-right', 'steer_right');
    bindBtn('btn-drive-center', 'steer_center');

    // Turn Signals (Left, Hazard, Right)
    document.querySelectorAll('.btn-signal').forEach(btn => {
      btn.addEventListener('click', () => {
        const sigAction = btn.dataset.signal;
        this.sendControl(sigAction);
      });
    });

    // Manual View Slider Controls
    const sliderSpeed = document.getElementById('slider-manual-speed');
    const sliderSpeedVal = document.getElementById('slider-speed-indicator');
    if (sliderSpeed && sliderSpeedVal) {
      sliderSpeed.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        sliderSpeedVal.textContent = `${val} km/h`;
        this.sendControl('set_speed', val);
      });
    }

    const sliderSteer = document.getElementById('slider-manual-steer');
    const sliderSteerVal = document.getElementById('slider-steer-indicator');
    if (sliderSteer && sliderSteerVal) {
      sliderSteer.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        sliderSteerVal.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}°`;
        this.sendControl('set_steer', val);
      });
    }

    // Gear buttons
    document.querySelectorAll('.btn-gear').forEach(b => {
      b.addEventListener('click', () => {
        const gear = b.dataset.gear.toLowerCase();
        document.querySelectorAll('.btn-gear').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        this.sendControl(`gear_${gear}`);
      });
    });

    // Reset & Pause
    const btnManualReset = document.getElementById('btn-manual-reset');
    if (btnManualReset) btnManualReset.addEventListener('click', () => this.sendControl('reset'));

    const btnManualPause = document.getElementById('btn-manual-pause');
    if (btnManualPause) btnManualPause.addEventListener('click', () => this.sendControl('pause'));

    // Save Session is handled by SessionHistoryManager (Hybrid MongoDB + SQLite) in history.js
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') {
        this.sendControl('accelerate');
      } else if (k === 's' || e.key === 'ArrowDown') {
        this.sendControl('brake');
      } else if (k === 'a' || e.key === 'ArrowLeft') {
        this.sendControl('steer_left');
      } else if (k === 'd' || e.key === 'ArrowRight') {
        this.sendControl('steer_right');
      } else if (k === 'q') {
        this.sendControl('signal_left');
      } else if (k === 'e') {
        this.sendControl('signal_right');
      } else if (k === 'h') {
        this.sendControl('signal_hazard');
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.sendControl('emergency_stop');
      } else if (e.key === 'Escape') {
        this.sendControl('pause');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') {
        this.sendControl('release_throttle');
      } else if (k === 's' || e.key === 'ArrowDown') {
        this.sendControl('release_brake');
      } else if (k === 'a' || k === 'd' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.sendControl('steer_center');
      }
    });
  }

  async sendControl(action, value = null) {
    try {
      await fetch('/api/simulation/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value })
      });
    } catch (e) {
      console.warn('Control send error:', e);
    }
  }

  async setMode(mode) {
    this.drivingMode = mode;
    try {
      await fetch('/api/simulation/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      // Synchronize all mode pills
      document.querySelectorAll('.mode-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      if (this.activeModeLabel) {
        if (mode === 'MANUAL') {
          this.activeModeLabel.textContent = 'MANUAL DRIVING MODE (FULL HUMAN CONTROL)';
        } else if (mode === 'AUTOPILOT' || mode === 'AI_ASSISTED') {
          this.activeModeLabel.textContent = 'AUTOPILOT MODE (100% FRENET AUTONOMOUS CRUISE)';
        } else if (mode === 'MIXED_COPILOT') {
          this.activeModeLabel.textContent = 'MIXED COPILOT MODE (HUMAN + ADAS SAFETY ASSIST)';
        }
      }
    } catch (e) {
      console.error('Mode switch error:', e);
    }
  }

  async setPreset(preset) {
    try {
      await fetch('/api/simulation/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });
    } catch (e) {
      console.error('Preset error:', e);
    }
  }

  async loadAvailableModels() {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (this.modelSelect && data.models) {
        this.modelSelect.innerHTML = '';
        data.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = `${m.name} (${m.size_mb} MB)`;
          if (m.is_active) opt.selected = true;
          this.modelSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Error loading models:', e);
    }
  }

  async switchModel(modelId) {
    try {
      const res = await fetch('/api/model/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId })
      });
      const data = await res.json();
      if (data.success) {
        this.fetchModelStatus();
      } else {
        alert(`Failed to switch model: ${data.error}`);
      }
    } catch (e) {
      console.error('Model switch error:', e);
    }
  }

  startTelemetrySync() {
    this.telemetryInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/simulation/telemetry');
        const t = await res.json();
        this.updateUI(t);
      } catch (e) {
        // Backend connecting
      }
    }, 50); // 20 Hz sync
  }

  updateUI(t) {
    // 1. Topbar
    if (this.topbarSpeed) this.topbarSpeed.textContent = `${t.speed_kmh.toFixed(1)} KM/H`;
    if (this.topbarDist) this.topbarDist.textContent = `${t.distance_km.toFixed(1)} / ${t.total_route_km.toFixed(1)} KM`;

    // 2. HUD & Progress
    if (this.routeBarFill) this.routeBarFill.style.width = `${t.progress_pct}%`;
    if (this.hudDistRem) this.hudDistRem.textContent = `${t.remaining_distance_km.toFixed(1)} km`;
    if (this.hudEtaVal) this.hudEtaVal.textContent = t.eta_minutes > 0 ? `${t.eta_minutes.toFixed(0)} min` : '--';

    // 3. Cockpit stats
    if (this.cpSpeed) this.cpSpeed.textContent = t.speed_kmh.toFixed(1);
    if (this.cpSteer) this.cpSteer.textContent = `${t.steer_deg > 0 ? '+' : ''}${t.steer_deg.toFixed(1)}°`;
    if (this.cpTargetSpeed) this.cpTargetSpeed.textContent = t.target_speed_kmh.toFixed(0);
    if (this.cpGear) this.cpGear.textContent = t.gear;

    // 4. Update 3D Simulation
    if (this.sim3D) {
      this.sim3D.updateFromTelemetry(t);
    }

    // 5. Update Web Audio Synthesizer, ADAS Radar & DMS Suite
    if (window.driveAISound) {
      window.driveAISound.updateTelemetry(t);
    }
    if (window.roadHazardRadar) {
      window.roadHazardRadar.updateTelemetry(t);
    }
    if (window.adasDmsManager) {
      window.adasDmsManager.updateTelemetry(t);
    }

    // 6. Turn Signal Buttons Active State
    const currentSig = t.turn_signal || 'OFF';
    document.querySelectorAll('.btn-signal').forEach(btn => {
      const isTarget = (
        (currentSig === 'LEFT' && btn.id === 'btn-signal-left') ||
        (currentSig === 'RIGHT' && btn.id === 'btn-signal-right') ||
        (currentSig === 'HAZARD' && btn.id === 'btn-signal-hazard')
      );
      btn.classList.toggle('active', isTarget);
    });

    // 7. Update Detections Table with Live Road Perception Targets
    if (this.tbodyDetections && t.camera_detections) {
      this.tbodyDetections.innerHTML = '';
      t.camera_detections.slice(0, 6).forEach(d => {
        const tr = document.createElement('tr');
        const distVal = typeof d.distance_m === 'number' ? d.distance_m : parseFloat(d.distance_m || 0);
        const colorClass = distVal < 8.0 ? 'text-amber' : (distVal < 18.0 ? 'text-cyan' : 'text-green');

        let statusBadge = '<span style="color: #94a3b8;">Clear</span>';
        const st = (d.status || (d.in_path ? 'IN PATH' : 'Clear')).toUpperCase();
        if (st === 'IN PATH') {
          statusBadge = '<span class="badge-nav badge-manual" style="background:#ef4444; color:#fff; font-weight:700;">IN PATH</span>';
        } else if (st === 'ONCOMING') {
          statusBadge = '<span class="badge-nav" style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); font-weight:600;">ONCOMING</span>';
        } else if (st === 'SHOULDER') {
          statusBadge = '<span class="badge-nav" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); font-weight:600;">SHOULDER</span>';
        }

        tr.innerHTML = `
          <td><strong>${d.class}</strong></td>
          <td>${Math.round((d.confidence || 0.95) * 100)}%</td>
          <td class="${colorClass}" style="font-family: var(--font-mono); font-weight: 600;">${distVal.toFixed(1)} m</td>
          <td>${statusBadge}</td>
        `;
        this.tbodyDetections.appendChild(tr);
      });
    }

    // 8. Update Events Log
    if (this.eventsContainer && t.events_log) {
      this.eventsContainer.innerHTML = '';
      t.events_log.slice(0, 6).forEach(evt => {
        const div = document.createElement('div');
        div.className = `log-entry log-level-${evt.level}`;
        div.innerHTML = `<span class="log-time">[${evt.timestamp}]</span> <span>${evt.message}</span>`;
        this.eventsContainer.appendChild(div);
      });
    }

    // 9. Frenet Trajectory & Decision Visualizer
    const frenet = t.frenet_planner || {};
    this.drawFrenetVisualizer(frenet, t);

    // AI Explainer Card
    const reasonP = document.getElementById('ai-decision-reason');
    if (reasonP && frenet.decision_reason) reasonP.textContent = frenet.decision_reason;

    const ttcVal = document.getElementById('ai-ttc-val');
    if (ttcVal) {
      if (frenet.ttc_seconds !== null && frenet.ttc_seconds !== undefined) {
        ttcVal.textContent = `${frenet.ttc_seconds}s`;
        ttcVal.className = frenet.ttc_seconds < 2.5 ? 'text-amber' : 'text-green';
      } else {
        ttcVal.textContent = 'SAFE (> 5s)';
        ttcVal.className = 'text-green';
      }
    }

    const obsVal = document.getElementById('ai-obs-val');
    if (obsVal) obsVal.textContent = frenet.closest_obstacle || 'None';

    const aebVal = document.getElementById('ai-aeb-val');
    if (aebVal) {
      aebVal.textContent = frenet.aeb_triggered ? 'ENGAGED 🚨' : 'STANDBY';
      aebVal.className = frenet.aeb_triggered ? 'text-amber' : 'text-cyan';
    }

    // 10. Analytics
    const latHuge = document.getElementById('stat-latency-huge');
    if (latHuge && t.model_latency_ms) latHuge.textContent = `${t.model_latency_ms} ms`;
    const maxSpd = document.getElementById('stat-max-speed');
    if (maxSpd) maxSpd.textContent = `${t.max_speed_kmh} km/h`;
    const warnHuge = document.getElementById('stat-warnings-huge');
    if (warnHuge) warnHuge.textContent = `${t.warnings_count}`;
  }

  drawFrenetVisualizer(frenet, telemetry) {
    if (!this.frenetCanvas || !this.frenetCtx) return;

    const ctx = this.frenetCtx;
    const w = this.frenetCanvas.width;
    const h = this.frenetCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background Grid
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    // Road Coordinate Frame (Longitudinal S from left to right, Lateral D from top to bottom)
    // S range: 0m to 60m (X: 40 to w - 20)
    // D range: -5.0m to +5.0m (Y: 20 to h - 20)
    const midY = h / 2;
    const dScale = (h - 36) / 10.0; // pixels per lateral meter
    const toY = (d) => midY + (d * dScale);
    const toX = (s) => 40 + (s / 60.0) * (w - 60);

    // 1. Draw Undivided Rural Road (Width 7.6m, Left Travel Lane: -1.6m, Bypass: -0.3m, Oncoming: +1.8m)
    // Dark asphalt roadway fill between shoulders (-3.8m to +3.8m)
    ctx.fillStyle = '#1c202a';
    ctx.fillRect(toX(0), toY(-3.8), toX(60) - toX(0), toY(3.8) - toY(-3.8));

    // Left dirt shoulder edge (-3.8m)
    ctx.strokeStyle = '#a16207'; // Earthy ochre border
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(-3.8));
    ctx.lineTo(toX(60), toY(-3.8));
    ctx.stroke();

    // Soft bypass guidance dash line (-0.3m)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(-0.3));
    ctx.lineTo(toX(60), toY(-0.3));
    ctx.stroke();
    ctx.setLineDash([]);

    // Right dirt shoulder edge (+3.8m)
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(3.8));
    ctx.lineTo(toX(60), toY(3.8));
    ctx.stroke();

    // Lane Corridor labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.font = '8px monospace';
    ctx.fillText('Travel: -1.6m', 4, toY(-1.6) + 3);
    ctx.fillText('Bypass: -0.3m', 4, toY(-0.3) + 3);
    ctx.fillText('Oncoming: +1.8m', 4, toY(1.8) + 3);

    // 2. Draw Forward Traffic Obstacles in Frenet Frame
    const traffic = telemetry.traffic_vehicles || [];
    traffic.forEach(v => {
      if (v.z > 0 && v.z < 60) {
        const ox = toX(v.z);
        const oy = toY(v.x);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.fillRect(ox - 6, oy - 7, 12, 14);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(ox - 6, oy - 7, 12, 14);

        // Distance label
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.fillText(`${v.z.toFixed(0)}m`, ox - 8, oy - 9);
      }
    });

    // 3. Draw Frenet Candidate Splines
    const candidates = frenet.frenet_candidates || [];
    const egoX = telemetry.vehicle_x || 0.0;
    const startX = toX(0);
    const startY = toY(egoX);

    candidates.forEach(cand => {
      const endX = toX(45);
      const endY = toY(cand.d);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      // Quintic polynomial trajectory curve simulation via Bezier
      const cp1X = startX + (endX - startX) * 0.45;
      const cp2X = startX + (endX - startX) * 0.75;
      ctx.bezierCurveTo(cp1X, startY, cp2X, endY, endX, endY);

      if (cand.selected) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3.0;
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = cand.j_collision > 50 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    });

    // 4. Draw Ego Vehicle Marker
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(startX - 8, startY - 8, 16, 16);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(startX - 8, startY - 8, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.fillText('EGO', startX - 9, startY + 22);

    // Update Frenet Candidate Chips in UI
    if (this.frenetChips && candidates.length > 0) {
      this.frenetChips.innerHTML = '';
      candidates.forEach(c => {
        const chip = document.createElement('div');
        chip.className = `frenet-chip ${c.selected ? 'selected' : ''} ${c.j_collision > 50 ? 'hazard' : ''}`;
        chip.innerHTML = `<span>d=${c.d > 0 ? '+' : ''}${c.d.toFixed(1)}m</span> <strong>J=${c.cost.toFixed(1)}</strong>`;
        this.frenetChips.appendChild(chip);
      });
    }

    if (this.frenetSelectedOffset && frenet.optimal_offset_m !== undefined) {
      this.frenetSelectedOffset.textContent = `Optimal Path: d = ${frenet.optimal_offset_m > 0 ? '+' : ''}${frenet.optimal_offset_m.toFixed(1)}m`;
    }
  }

  async fetchModelStatus() {
    try {
      const res = await fetch('/api/model/status');
      const m = await res.json();
      const dot = document.getElementById('dot-model-status');
      const txt = document.getElementById('text-model-status');
      if (dot && txt) {
        if (m.loaded) {
          dot.className = 'status-indicator-dot online';
          txt.textContent = `Model: ${m.model_name} (${m.classes_count} Cls)`;
        } else {
          dot.className = 'status-indicator-dot offline';
          txt.textContent = `Model: ${m.error || 'Not Loaded'}`;
        }
      }
    } catch (e) {
      console.warn('Model status error:', e);
    }
  }

  async loadConfigView() {
    const configPre = document.getElementById('config-json-view');
    try {
      const res = await fetch('/api/model/status');
      const data = await res.json();
      if (configPre) configPre.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      if (configPre) configPre.textContent = 'Error loading configuration.';
    }
  }
}

// Auto-instantiate dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.driveAIDashboard = new DriveAIDashboard();
});
