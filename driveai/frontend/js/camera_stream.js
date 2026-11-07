/**
 * DriveAI - Live Camera & Inference Controller
 * Handles camera source switching, inference toggles, and status reporting.
 */

class CameraStreamController {
  constructor() {
    this.selectDevice = document.getElementById('select-camera-device');
    this.btnToggleCam = document.getElementById('btn-toggle-cam');
    this.btnToggleInf = document.getElementById('btn-toggle-inference');
    this.isCameraActive = true;
    this.isInferenceActive = true;

    this.init();
  }

  init() {
    if (this.selectDevice) {
      this.selectDevice.addEventListener('change', (e) => this.switchSource(e.target.value));
    }
    if (this.btnToggleCam) {
      this.btnToggleCam.addEventListener('click', () => this.toggleCamera());
    }
    if (this.btnToggleInf) {
      this.btnToggleInf.addEventListener('click', () => this.toggleInference());
    }

    this.checkCameraStatus();
    setInterval(() => this.checkCameraStatus(), 5000);

    // Auto-reconnect stream images on network hiccups
    document.querySelectorAll('.mjpeg-stream, .large-mjpeg-stream').forEach(img => {
      img.onerror = () => {
        setTimeout(() => {
          if (this.isCameraActive) {
            img.src = `/api/camera/stream?t=${Date.now()}`;
          }
        }, 1200);
      };
    });
  }

  async checkCameraStatus() {
    try {
      const res = await fetch('/api/camera/status');
      const data = await res.json();
      const dot = document.getElementById('dot-cam-status');
      const txt = document.getElementById('text-cam-status');
      if (dot && txt) {
        dot.className = data.camera_active ? 'status-indicator-dot online' : 'status-indicator-dot offline';
        txt.textContent = `Camera: ${data.status}`;
      }
    } catch (e) {
      console.warn('Camera status poll error:', e);
    }
  }

  async switchSource(sourceId) {
    try {
      const res = await fetch('/api/camera/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId })
      });
      const data = await res.json();
      this.checkCameraStatus();

      // Refresh stream images
      document.querySelectorAll('.mjpeg-stream, .large-mjpeg-stream').forEach(img => {
        img.src = `/api/camera/stream?t=${Date.now()}`;
      });
    } catch (e) {
      console.error('Error switching camera:', e);
    }
  }

  async toggleCamera() {
    this.isCameraActive = !this.isCameraActive;
    if (this.btnToggleCam) {
      this.btnToggleCam.textContent = this.isCameraActive ? 'Pause Camera' : 'Resume Camera';
    }
    document.querySelectorAll('.mjpeg-stream, .large-mjpeg-stream').forEach(img => {
      if (this.isCameraActive) {
        img.src = `/api/camera/stream?t=${Date.now()}`;
      } else {
        img.src = '';
      }
    });
  }

  async toggleInference() {
    this.isInferenceActive = !this.isInferenceActive;
    try {
      await fetch('/api/camera/toggle_inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: this.isInferenceActive })
      });
      if (this.btnToggleInf) {
        this.btnToggleInf.textContent = this.isInferenceActive ? 'Stop Inference' : 'Start Inference';
      }
    } catch (e) {
      console.error('Error toggling inference:', e);
    }
  }
}

window.cameraController = new CameraStreamController();
