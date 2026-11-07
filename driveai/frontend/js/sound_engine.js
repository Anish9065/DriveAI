/**
 * DriveAI - Web Audio Synthesizer Engine
 * Pure synthesized automotive audio using Web Audio API (Zero external audio file dependencies).
 * Features:
 *   - EV Electric Motor Whine: Speed & throttle-dependent dual-oscillator pitch modulation
 *   - Regenerative Braking Hum: Resonant low-pass filter decel hum
 *   - ADAS Safety Alert Chime: Harmonic dual-tone emergency alert
 *   - Turn Signal Relay Click: Realistic blinker clicker
 *   - Master Mute / Unmute control with user gesture unlocking
 */

class DriveAISoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = true; // Start muted by default to satisfy browser autoplay policies
    this.isUnlocked = false;

    // EV Motor Oscillators & Gains
    this.motorOsc1 = null;
    this.motorOsc2 = null;
    this.motorFilter = null;
    this.motorGain = null;

    // Brake Hum
    this.brakeOsc = null;
    this.brakeGain = null;

    // Chime cooldown
    this.lastChimeTime = 0;

    // Blinker state
    this.lastBlinkerClick = 0;

    this.initAudio();
  }

  initAudio() {
    // Unlock on first interaction
    const unlock = () => {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.setupSynthesizers();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  setupSynthesizers() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Motor Main Oscillator (Triangle)
    this.motorOsc1 = this.ctx.createOscillator();
    this.motorOsc1.type = 'triangle';
    this.motorOsc1.frequency.setValueAtTime(60, now);

    // 2. Motor Harmonic Sub Oscillator (Sawtooth with lowpass filter)
    this.motorOsc2 = this.ctx.createOscillator();
    this.motorOsc2.type = 'sawtooth';
    this.motorOsc2.frequency.setValueAtTime(120, now);

    this.motorFilter = this.ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.setValueAtTime(800, now);
    this.motorFilter.Q.setValueAtTime(3.0, now);

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.setValueAtTime(0.0, now);

    this.motorOsc1.connect(this.motorFilter);
    this.motorOsc2.connect(this.motorFilter);
    this.motorFilter.connect(this.motorGain);
    this.motorGain.connect(this.masterGain);

    this.motorOsc1.start();
    this.motorOsc2.start();

    // 3. Regenerative Braking Synth
    this.brakeOsc = this.ctx.createOscillator();
    this.brakeOsc.type = 'sine';
    this.brakeOsc.frequency.setValueAtTime(90, now);

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.setValueAtTime(0.0, now);

    this.brakeOsc.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);
    this.brakeOsc.start();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0.0 : 0.75;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return !this.isMuted;
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0.0 : 0.75;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  updateTelemetry(telemetry) {
    if (!this.ctx || this.isMuted || !this.motorGain) return;

    const speed = Math.max(0, telemetry.speed_kmh || 0);
    const throttle = (telemetry.throttle_pct || 0) / 100.0;
    const brake = (telemetry.brake_pct || 0) / 100.0;
    const now = this.ctx.currentTime;

    // EV Motor pitch equation: 50Hz idle + speed factor + throttle boost
    const baseFreq = 50 + (speed * 11.2) + (throttle * 35.0);
    const harmonicFreq = baseFreq * 2.0;

    this.motorOsc1.frequency.setTargetAtTime(Math.min(1800, baseFreq), now, 0.08);
    this.motorOsc2.frequency.setTargetAtTime(Math.min(3600, harmonicFreq), now, 0.08);

    // Motor volume increases with speed and throttle
    const motorVol = speed > 0.5 ? Math.min(0.35, 0.04 + (speed / 130.0) * 0.22 + (throttle * 0.12)) : 0.0;
    this.motorGain.gain.setTargetAtTime(motorVol, now, 0.08);

    // Brake Hum
    if (this.brakeGain) {
      const brakeVol = (brake > 0.05 && speed > 5.0) ? Math.min(0.25, brake * 0.25) : 0.0;
      this.brakeGain.gain.setTargetAtTime(brakeVol, now, 0.06);
    }

    // Check for ADAS Safety Chime
    const frenet = telemetry.frenet_planner || {};
    const ttc = frenet.ttc_seconds;
    const isAeb = frenet.aeb_triggered || telemetry.brake_pct > 80;

    if (isAeb || (ttc !== null && ttc !== undefined && ttc > 0 && ttc < 2.5)) {
      this.playAdasChime();
    }

    // Turn signal relay sound
    const turnSig = telemetry.turn_signal;
    if (turnSig && turnSig !== 'OFF') {
      const curMs = performance.now();
      if (curMs - this.lastBlinkerClick > 450) {
        this.playRelayClick();
        this.lastBlinkerClick = curMs;
      }
    }
  }

  playAdasChime() {
    if (!this.ctx || this.isMuted) return;
    const now = performance.now();
    if (now - this.lastChimeTime < 1800) return; // Prevent spam
    this.lastChimeTime = now;

    try {
      const t = this.ctx.currentTime;
      // Tone 1: 880 Hz (A5)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, t);
      gain1.gain.setValueAtTime(0.0, t);
      gain1.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // Tone 2: 1320 Hz (E6 - pleasant fifth harmonic)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, t + 0.09);
      gain2.gain.setValueAtTime(0.0, t + 0.09);
      gain2.gain.linearRampToValueAtTime(0.32, t + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t + 0.09);
      osc2.stop(t + 0.36);
    } catch (e) {
      // AudioContext safe catch
    }
  }

  playRelayClick() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.035);
    } catch (e) {}
  }
}

// Global Sound Engine Instance
window.driveAISound = new DriveAISoundEngine();
