/**
 * DriveAI - Hybrid Database & Telemetry Controller (MongoDB + SQLite Auto-Fallback)
 * Manages persistent demonstration records, database status pills, and rich JSON telemetry inspection.
 */

class SessionHistoryManager {
  constructor() {
    this.tbody = document.getElementById('tbody-sessions');
    this.btnRefresh = document.getElementById('btn-refresh-history');
    this.btnSaveNow = document.getElementById('btn-save-session-now');
    this.badgeEngine = document.getElementById('badge-db-engine');

    // Telemetry Inspector Modal
    this.modal = document.getElementById('modal-telemetry-detail');
    this.modalJson = document.getElementById('modal-telemetry-json');
    this.modalSessionId = document.getElementById('modal-session-id');
    this.btnCloseModal = document.getElementById('btn-close-telemetry-modal');

    this.sessionsCache = [];
    this.init();
  }

  init() {
    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', () => {
        this.fetchDatabaseStatus();
        this.fetchSessions();
      });
    }
    if (this.btnSaveNow) {
      this.btnSaveNow.addEventListener('click', () => this.saveCurrentSession());
    }

    if (this.btnCloseModal && this.modal) {
      this.btnCloseModal.addEventListener('click', () => {
        this.modal.style.display = 'none';
      });
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.modal.style.display = 'none';
      });
    }

    this.fetchDatabaseStatus();
    this.fetchSessions();
  }

  async fetchDatabaseStatus() {
    try {
      const res = await fetch('/api/database/status');
      const status = await res.json();
      if (this.badgeEngine) {
        if (status.mongodb_connected) {
          this.badgeEngine.textContent = '🍃 MongoDB Active (Cloud/Cluster)';
          this.badgeEngine.style.background = 'rgba(34, 197, 94, 0.15)';
          this.badgeEngine.style.color = '#4ade80';
          this.badgeEngine.style.borderColor = 'rgba(74, 222, 128, 0.4)';
        } else {
          this.badgeEngine.textContent = '⚡ SQLite Active (Local Auto-Fallback)';
          this.badgeEngine.style.background = 'rgba(56, 189, 248, 0.15)';
          this.badgeEngine.style.color = '#38bdf8';
          this.badgeEngine.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        }
      }
      if (this.btnSaveNow) {
        if (status.mongodb_connected) {
          this.btnSaveNow.innerHTML = '🍃 Save Session (MongoDB)';
          this.btnSaveNow.title = 'Save full rich document & telemetry to MongoDB Atlas/Cluster';
        } else {
          this.btnSaveNow.innerHTML = '💾 Save Session (SQLite)';
          this.btnSaveNow.title = 'Save telemetry to embedded SQLite (Connect MongoDB Atlas in config.json to enable NoSQL)';
        }
      }
    } catch (e) {
      console.warn('Could not fetch DB status:', e);
    }
  }

  async fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      this.sessionsCache = data.sessions || [];
      this.renderTable(this.sessionsCache);
    } catch (e) {
      console.warn('Error fetching sessions:', e);
    }
  }

  renderTable(sessions) {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';

    if (sessions.length === 0) {
      this.tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:15px; color:#64748b;">No saved demonstration sessions yet. Click "Save Session" to record your run.</td></tr>';
      return;
    }

    sessions.forEach(s => {
      const tr = document.createElement('tr');
      const statusClass = s.status === 'Completed' ? 'text-green' : (s.status.includes('Emergency') ? 'text-amber' : '');
      const dateStr = s.created_at ? s.created_at.replace('T', ' ').substring(0, 19) : '--';
      const distance = typeof s.distance_km === 'number' ? s.distance_km.toFixed(2) : s.distance_km;
      const maxSpeed = typeof s.max_speed_kmh === 'number' ? s.max_speed_kmh.toFixed(1) : s.max_speed_kmh;
      const avgSpeed = typeof s.avg_speed_kmh === 'number' ? s.avg_speed_kmh.toFixed(1) : s.avg_speed_kmh;
      const latency = typeof s.avg_latency_ms === 'number' ? s.avg_latency_ms.toFixed(1) : s.avg_latency_ms;

      tr.innerHTML = `
        <td><strong style="font-family: monospace; color: #38bdf8;">${s.session_id}</strong></td>
        <td><span class="badge-info">${s.mode}</span></td>
        <td>${s.preset}</td>
        <td>${distance} km</td>
        <td>${maxSpeed} km/h</td>
        <td>${avgSpeed} km/h</td>
        <td>${s.warnings_count ?? 0}</td>
        <td>${latency} ms</td>
        <td class="${statusClass}"><strong>${s.status}</strong></td>
        <td style="font-size: 11px; color: #94a3b8;">${dateStr}</td>
        <td>
          <button class="btn-inspect-session btn-secondary-sm" data-id="${s.session_id}" style="font-size: 11px; padding: 3px 8px; cursor: pointer;">
            🔍 JSON
          </button>
        </td>
      `;
      this.tbody.appendChild(tr);
    });

    // Attach click listeners to inspect buttons
    this.tbody.querySelectorAll('.btn-inspect-session').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.currentTarget.getAttribute('data-id');
        this.inspectSession(sid);
      });
    });
  }

  async inspectSession(sessionId) {
    if (!this.modal || !this.modalJson) return;

    this.modalSessionId.textContent = sessionId;
    this.modalJson.textContent = 'Loading rich telemetry document...';
    this.modal.style.display = 'flex';

    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      const sessionDoc = data.session || this.sessionsCache.find(s => s.session_id === sessionId);
      this.modalJson.textContent = JSON.stringify(sessionDoc, null, 2);
    } catch (e) {
      const fallback = this.sessionsCache.find(s => s.session_id === sessionId);
      this.modalJson.textContent = JSON.stringify(fallback || { error: String(e) }, null, 2);
    }
  }

  async saveCurrentSession() {
    try {
      const mode = window.driveAIDashboard ? window.driveAIDashboard.drivingMode : 'MANUAL';
      const res = await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode, status: 'Completed' })
      });
      const data = await res.json();
      if (data.success) {
        const engineLabel = data.mongodb_active ? 'MongoDB Atlas (Rich Document)' : 'SQLite (Local DB)';
        alert(`✅ Session ${data.session.session_id} saved successfully!\nEngine: ${engineLabel}`);
        this.fetchDatabaseStatus();
        this.fetchSessions();
      }
    } catch (e) {
      alert(`❌ Error saving session: ${e}`);
    }
  }
}

window.sessionHistory = new SessionHistoryManager();
