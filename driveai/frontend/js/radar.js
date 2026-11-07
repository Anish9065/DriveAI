/**
 * DriveAI - ADAS Active Safety Guard & Indian Road Geo-Hazard Radar
 * Connects to MongoDB Atlas / SQLite via /api/hazards and renders real-time 360° radar.
 */

class RoadHazardRadarManager {
  constructor() {
    this.canvas = document.getElementById('canvas-radar');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.tbody = document.getElementById('tbody-hazards');
    this.btnRefresh = document.getElementById('btn-refresh-hazards');
    this.hazardCountBadge = document.getElementById('kpi-radar-hazard-count');
    this.dbEngineBadge = document.getElementById('radar-db-engine-badge');

    // ADAS live KPI targets
    this.kpiTtc = document.getElementById('kpi-radar-ttc');
    this.kpiClearance = document.getElementById('kpi-radar-clearance');
    this.kpiFcwStatus = document.getElementById('kpi-radar-fcw-status');

    this.hazards = [];
    this.sweepAngle = 0;
    this.lastTelemetry = null;

    this.init();
  }

  init() {
    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', () => this.fetchHazards());
    }

    // Quick hazard logging buttons
    const bindBtn = (id, type, sev, action) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => this.reportHazard(type, sev, action));
    };

    bindBtn('btn-report-pothole', 'pothole', 'HIGH', 'Frenet Lateral Offset (-1.8m)');
    bindBtn('btn-report-cattle', 'cattle', 'CRITICAL', 'Full Deceleration & Lane Shift (+2.2m)');
    bindBtn('btn-report-barricade', 'barricade', 'HIGH', 'Corridor Squeeze Evasion');
    bindBtn('btn-report-speedbump', 'speed_bump', 'MODERATE', 'Kinodynamic Speed Dampening');

    this.fetchHazards();
    this.startRadarLoop();
  }

  async fetchHazards() {
    try {
      const res = await fetch('/api/hazards?limit=50');
      const data = await res.json();
      this.hazards = data.hazards || [];
      this.renderTable(this.hazards);

      if (this.hazardCountBadge) {
        this.hazardCountBadge.textContent = this.hazards.length;
      }

      if (this.dbEngineBadge) {
        if (data.mongodb_active) {
          this.dbEngineBadge.textContent = '🍃 MongoDB GeoJSON 2dsphere Active';
          this.dbEngineBadge.style.color = '#4ade80';
        } else {
          this.dbEngineBadge.textContent = '⚡ SQLite Spatial Offline Fallback';
          this.dbEngineBadge.style.color = '#38bdf8';
        }
      }
    } catch (e) {
      console.warn('Error loading road hazards:', e);
    }
  }

  async reportHazard(type, severity, evasion) {
    try {
      const dash = window.driveAIDashboard;
      const telem = dash && dash.lastTelemetry ? dash.lastTelemetry : {};
      const distKm = telem.distance_km || 0.0;
      const speedKmh = telem.speed_kmh || 35.0;

      // Simulated Bangalore Outer Ring Road / NH44 coordinate along progression
      const lat = 12.9716 + (distKm * 0.0089);
      const lng = 77.5946 + (distKm * 0.0042);

      const payload = {
        hazard_type: type,
        severity: severity,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6)),
        distance_km: parseFloat(distKm.toFixed(2)),
        speed_kmh: parseFloat(speedKmh.toFixed(1)),
        evasion_action: evasion
      };

      const res = await fetch('/api/hazards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        const engine = data.mongodb_active ? 'MongoDB Atlas (2dsphere)' : 'SQLite';
        this.fetchHazards();
        alert(`🚨 Geo-Hazard Recorded!\nType: ${type.toUpperCase()}\nEngine: ${engine}\nGPS: [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
      }
    } catch (e) {
      alert('Error recording hazard: ' + e);
    }
  }

  renderTable(hazards) {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';

    if (!hazards || hazards.length === 0) {
      this.tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:15px; color:#64748b;">No road hazards logged yet. Click any button above to log a real-time hazard.</td></tr>';
      return;
    }

    const typeIcons = {
      pothole: '🕳️ Pothole',
      cattle: '🐄 Cattle',
      barricade: '🚧 Barricade',
      speed_bump: '⚠️ Speed Bump'
    };

    hazards.forEach(h => {
      const tr = document.createElement('tr');
      const iconLabel = typeIcons[h.hazard_type] || h.hazard_type;
      const sevClass = h.severity === 'CRITICAL' ? 'badge-alert' : (h.severity === 'HIGH' ? 'badge-warn' : 'badge-info');
      const timeStr = h.detected_at ? h.detected_at.replace('T', ' ').substring(0, 19) : '--';
      const lat = typeof h.latitude === 'number' ? h.latitude.toFixed(5) : h.latitude;
      const lng = typeof h.longitude === 'number' ? h.longitude.toFixed(5) : h.longitude;

      tr.innerHTML = `
        <td><code style="color: #38bdf8;">${h.hazard_id || '--'}</code></td>
        <td><strong>${iconLabel}</strong></td>
        <td><span class="${sevClass}" style="font-size:10px; padding:2px 6px; border-radius:3px;">${h.severity}</span></td>
        <td><span style="font-family: monospace; font-size:11px; color:#cbd5e1;">${lat}, ${lng}</span></td>
        <td>${h.distance_km !== undefined ? Number(h.distance_km).toFixed(2) + ' km' : '--'}</td>
        <td>${h.speed_kmh !== undefined ? Number(h.speed_kmh).toFixed(1) + ' km/h' : '--'}</td>
        <td><span style="color:#a5b4fc; font-size:11px;">${h.evasion_action || 'Frenet Offset'}</span></td>
        <td style="color:#94a3b8; font-size:11px;">${timeStr}</td>
      `;
      this.tbody.appendChild(tr);
    });
  }

  updateTelemetry(telem) {
    this.lastTelemetry = telem;
    if (!telem) return;

    // 1. Calculate live TTC
    const speedMs = (telem.speed_kmh || 0) / 3.6;
    let closestDist = 45.0;
    if (telem.traffic_vehicles && telem.traffic_vehicles.length > 0) {
      for (const v of telem.traffic_vehicles) {
        if (v.z > 0 && v.z < closestDist) closestDist = v.z;
      }
    }

    const ttc = speedMs > 1.0 ? Math.min(9.9, closestDist / speedMs) : 9.9;

    if (this.kpiTtc) {
      this.kpiTtc.textContent = `${ttc.toFixed(1)} s`;
      if (ttc < 1.5) {
        this.kpiTtc.className = 'kpi-value text-red';
        if (this.kpiFcwStatus) {
          this.kpiFcwStatus.textContent = '🔴 Interlock: AEB CRITICAL BRAKE';
          this.kpiFcwStatus.style.color = '#ef4444';
        }
      } else if (ttc < 3.0) {
        this.kpiTtc.className = 'kpi-value text-amber';
        if (this.kpiFcwStatus) {
          this.kpiFcwStatus.textContent = '🟡 Interlock: FORWARD COLLISION ALERT';
          this.kpiFcwStatus.style.color = '#f59e0b';
        }
      } else {
        this.kpiTtc.className = 'kpi-value text-green';
        if (this.kpiFcwStatus) {
          this.kpiFcwStatus.textContent = '🟢 Interlock Status: NOMINAL SAFE';
          this.kpiFcwStatus.style.color = '#4ade80';
        }
      }
    }

    if (this.kpiClearance) {
      this.kpiClearance.textContent = `${closestDist.toFixed(1)} m`;
    }
  }

  startRadarLoop() {
    const loop = () => {
      this.drawRadar();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  drawRadar() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h - 25; // ego at bottom center
    const maxR = h - 40;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar Background Grid
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);

    // 2. Concentric Range Rings (10m, 25m, 50m)
    const rings = [
      { r: maxR * 0.28, label: '10m' },
      { r: maxR * 0.60, label: '25m' },
      { r: maxR * 1.00, label: '50m' }
    ];

    ctx.lineWidth = 1;
    rings.forEach(ring => {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, Math.PI, 0, false);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText(ring.label, cx + ring.r - 24, cy - 4);
    });

    // 3. Radial Angle Sector Lines (30°, 60°, 90°, 120°, 150°)
    [30, 60, 90, 120, 150].forEach(deg => {
      const rad = deg * (Math.PI / 180);
      const ex = cx + Math.cos(Math.PI - rad) * maxR;
      const ey = cy - Math.sin(Math.PI - rad) * maxR;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });

    // 4. Rotating Green/Cyan Radar Sweep Beam
    this.sweepAngle = (this.sweepAngle + 0.045) % Math.PI;
    const sx = cx + Math.cos(Math.PI - this.sweepAngle) * maxR;
    const sy = cy - Math.sin(Math.PI - this.sweepAngle) * maxR;

    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0, 245, 212, 0.35)');
    grad.addColorStop(1, 'rgba(0, 245, 212, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, Math.PI - this.sweepAngle - 0.25, Math.PI - this.sweepAngle, false);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // 5. Ego Vehicle Marker
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 8, cy + 4);
    ctx.lineTo(cx + 8, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EGO', cx, cy + 16);

    // 6. Draw Live Obstacles from Telemetry
    if (this.lastTelemetry && this.lastTelemetry.traffic_vehicles) {
      this.lastTelemetry.traffic_vehicles.forEach(v => {
        if (v.z <= 0 || v.z > 50) return;
        const normDist = v.z / 50.0;
        const vx = cx + (v.x * 22.0);
        const vy = cy - (normDist * maxR);

        ctx.fillStyle = v.type === 'cattle' ? '#f59e0b' : '#ef4444';
        ctx.beginPath();
        ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(`${(v.type || '').substring(0, 4).toUpperCase()} ${v.z.toFixed(0)}m`, vx, vy - 7);
      });
    }

    // 7. Draw Logged Database Hazards along Route
    if (this.hazards) {
      this.hazards.slice(0, 8).forEach((h, idx) => {
        const offsetZ = 12.0 + (idx * 5.2);
        const norm = (offsetZ % 50.0) / 50.0;
        const hx = cx + ((idx % 2 === 0 ? -1.5 : 1.5) * 16.0);
        const hy = cy - (norm * maxR);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.beginPath();
        ctx.arc(hx, hy, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}

// Auto-instantiate
window.roadHazardRadar = new RoadHazardRadarManager();

