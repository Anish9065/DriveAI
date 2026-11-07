/**
 * DriveAI - Authentic Indian Village Road 3D Simulation Engine
 * Dynamic Winding Rural Road Visualizer (Three.js)
 * 
 * Features:
 *   - High-amplitude winding rural S-curves, chicanes, and zig-zags
 *   - Real 3D physical road progression (bends travel toward vehicle at true speedometer velocity)
 *   - Procedural scrolling asphalt & dirt shoulder textures (real ground speed rush beneath wheels)
 *   - Dynamic spring-damped chase camera with active yaw rotation and centrifugal Dutch banking tilt
 *   - 3D Sky Dome with real perspective rotation (sun & horizon rotate naturally with car turns)
 *   - Authentic undivided village road (NO center lane stripes or highway dividers)
 *   - Rich rural Indian environment: Roadside Chai Dhaba with benches, Whitewashed Temple Shrine with saffron flag,
 *     Stone Water Well, Bullock Cart, Flowering Gulmohar, Spreading Banyan with aerial roots, Slender Palms,
 *     Mud Huts, Terracotta Brick Houses, Haystacks, Utility Poles with Drooping Wires, and Milestones
 *   - Dynamic suspension: realistic body roll, suspension pitch (brake dive / squat), and road rumble
 *   - Contact ground shadows beneath ALL vehicles (zero floating)
 *   - 60 FPS independent traffic kinematics & wheel spinning
 */

class RoadSimulation3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.cameraView = 'follow'; // 'follow', 'hood', 'topdown'
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.egoVehicle = null;
    this.egoBody = null;
    this.egoWheels = [];
    this.egoFrontWheels = [];
    this.egoBrakeLightBar = null;

    this.skyDome = null;
    this.roadTexture = null;
    this.shoulderTexture = null;
    this.edgeTextures = [];

    this.trafficObjects = new Map(); // id -> THREE.Group
    this.trafficData = [];          // Raw traffic array for 60 FPS dead reckoning
    this.villageProps = [];          // Array of roadside village scenery elements
    this.dustParticles = null;       // Wheel dust particle system

    // Advanced Visual Systems & Interactive State
    this.sensorMode = '3d';
    this.isLidarMode = false;
    this.droneAngle = 0.0;
    this.orbitYaw = 0.0;
    this.orbitPitch = 0.38;
    this.orbitDist = 9.8;
    this.isDragging = false;
    this.previousMouse = { x: 0, y: 0 };
    this.headlights = [];
    this.rainParticles = null;
    this.rainVelocities = null;
    this.lidarRingsGroup = null;
    this.lidarSweep = null;
    this.trajectoryMesh = null;
    this.trajTexture = null;

    this.currentTelemetry = {
      speed_kmh: 0,
      target_speed_kmh: 50,
      steer_deg: 0,
      vehicle_x: -1.6,
      distance_km: 0,
      brake_pct: 0,
      throttle_pct: 0,
      turn_signal: 'OFF',
      driving_mode: 'MANUAL',
      traffic_vehicles: []
    };

    // Smooth Motion & Physics State Variables
    this.distanceTraveled = 0;
    this.wheelRotationAngle = 0;
    this.environmentTheme = 'sunset'; // Default warm golden hour village

    this.camSmoothedPos = new THREE.Vector3(0, 4.0, -8.8);
    this.camSmoothedLook = new THREE.Vector3(0, 1.2, 24.0);
    this.camSmoothedYaw = 0.0;
    this.smoothedLaneX = -1.6;
    this.smoothedSteerDeg = 0.0;
    this.chassisRoll = 0.0;
    this.chassisPitch = 0.0;

    this.init();
  }

  init() {
    if (!this.container) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 450;

    if (typeof THREE === 'undefined') {
      console.warn("⚠️ Three.js not found. Fallback mode.");
      return;
    }

    // 1. Scene Setup
    this.scene = new THREE.Scene();

    // 2. Camera Setup with Natural 52° FOV
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.4, 600);
    this.setCameraView('follow');

    // 3. WebGL Renderer with ACES Tone Mapping & Soft Shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Procedural Scrolling Textures for Road & Shoulder
    this.roadTexture = this.createAsphaltTexture();
    this.shoulderTexture = this.createShoulderTexture();

    // 5. 3D Sky Dome & Horizon Lighting
    this.setupSkyDome();
    this.setupLighting();

    // 6. Build Winding Rural Road & Village Landscape
    this.buildVillageEnvironment();

    // 7. Build High-Fidelity Ego Vehicle with Suspended Body & Contact Shadow
    this.buildRealisticEgoVehicle();

    // 8. Wheel Dust Particle FX
    this.setupDustParticles();

    // 9. Advanced Visual Systems (Tesla Frenet Ribbon, Monsoon Rain, Projector Headlights, LiDAR Scanning, Mouse Orbit)
    this.setupTrajectoryRibbon();
    this.setupMonsoonRain();
    this.setupProjectorHeadlights();
    this.setupLidarElements();
    this.setupMouseInteractions();

    // Apply initial environment theme
    this.setEnvironment(this.environmentTheme);

    // 10. Event Listeners
    window.addEventListener('resize', () => this.onResize());

    // 11. 60 FPS Animation Loop
    this.lastTime = performance.now();
    this.animate();
  }

  /**
   * Continuous High-Amplitude Road Curvature Function
   * Generates authentic, exciting rural Indian zig-zags, S-curves, and chicanes.
   * Parameter s = z + dist ensures curves physically travel toward the vehicle at true road speed.
   */
  getRoadCurve(z, dist) {
    const s = z + (dist || 0);
    // Scenic, natural Indian rural road curves (broad sweeping landscape bends + natural village road meandering)
    const x = Math.sin(s * 0.018) * 6.8
            + Math.sin(s * 0.048) * 2.8;
    const y = Math.sin(s * 0.024) * 0.32; // gentle rural terrain dips and rises
    return { x, y };
  }

  /**
   * Procedural High-Contrast Asphalt Texture
   * Includes aggregate specks, subtle wheel track grooves, and tar patches.
   * Scrolls dynamically with distance traveled to provide vivid ground speed rush.
   */
  createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base slate asphalt
    ctx.fillStyle = '#22262e';
    ctx.fillRect(0, 0, 128, 512);

    // Gravel aggregate specks
    for (let i = 0; i < 900; i++) {
      const gx = Math.random() * 128;
      const gy = Math.random() * 512;
      const gSize = 1.0 + Math.random() * 2.0;
      const shade = Math.floor(25 + Math.random() * 45);
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
      ctx.beginPath();
      ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Worn tire tracks from rural traffic
    ctx.fillStyle = 'rgba(15, 18, 24, 0.42)';
    ctx.fillRect(22, 0, 24, 512); // left wheel track
    ctx.fillRect(82, 0, 24, 512); // right wheel track

    // Subtle tar patches
    for (let p = 0; p < 8; p++) {
      const px = 20 + Math.random() * 88;
      const py = Math.random() * 512;
      ctx.fillStyle = 'rgba(12, 14, 18, 0.55)';
      ctx.beginPath();
      ctx.ellipse(px, py, 6 + Math.random() * 10, 14 + Math.random() * 20, Math.random() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 36);
    return tex;
  }

  /**
   * Procedural Earthen Dirt / Red Gravel Shoulder Texture
   */
  createShoulderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Warm terracotta rural soil
    ctx.fillStyle = '#543822';
    ctx.fillRect(0, 0, 128, 512);

    // Gravel & sand specks
    for (let i = 0; i < 1100; i++) {
      const px = Math.random() * 128;
      const py = Math.random() * 512;
      const pSize = 0.8 + Math.random() * 2.4;
      const r = Math.floor(70 + Math.random() * 45);
      const g = Math.floor(45 + Math.random() * 30);
      const b = Math.floor(25 + Math.random() * 20);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 36);
    return tex;
  }

  /**
   * 3D Sky Dome Setup
   * Using an inverted 3D sphere dome ensures that when the camera rotates through zig-zag curves,
   * the sky, sun, clouds, and horizon realistically rotate in true 3D perspective!
   */
  setupSkyDome() {
    const skyGeo = new THREE.SphereGeometry(380, 32, 16);
    this.skyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false
    });
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyDome);
  }

  createGradientSkyTexture(theme) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (theme === 'day') {
      grad.addColorStop(0.0, '#0284c7'); // Clear sky blue
      grad.addColorStop(0.40, '#38bdf8');
      grad.addColorStop(0.70, '#bae6fd');
      grad.addColorStop(1.0, '#e0f2fe'); // Pale horizon haze
    } else if (theme === 'night') {
      grad.addColorStop(0.0, '#020617'); // Midnight deep blue
      grad.addColorStop(0.45, '#0b1329');
      grad.addColorStop(0.80, '#1e293b');
      grad.addColorStop(1.0, '#2a3b53');
    } else if (theme === 'rain') {
      grad.addColorStop(0.0, '#0f172a'); // Stormy dark slate
      grad.addColorStop(0.40, '#1e293b');
      grad.addColorStop(0.75, '#334155');
      grad.addColorStop(1.0, '#475569');
    } else { // 'sunset' (Village Golden Hour - Default)
      grad.addColorStop(0.0, '#1e1b4b'); // Deep twilight indigo
      grad.addColorStop(0.35, '#312e81'); // Dusky violet
      grad.addColorStop(0.58, '#c2410c'); // Warm sunset vermillion
      grad.addColorStop(0.80, '#ea580c'); // Radiant amber
      grad.addColorStop(1.0, '#fed7aa'); // Luminous golden peach horizon
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Soft ambient occlusion ground contact shadow plane for realistic vehicle grounding.
   */
  createContactShadow(width, length, opacity = 0.8) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: opacity,
      depthWrite: false
    });
    const geo = new THREE.PlaneGeometry(width, length);
    geo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(geo, mat);
    shadow.position.y = 0.03;
    return shadow;
  }

  setupLighting() {
    // Ambient Warm Sky Fill
    this.hemiLight = new THREE.HemisphereLight(0xfb923c, 0x292524, 0.85);
    this.scene.add(this.hemiLight);

    // Directional Sunlight
    this.dirLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    this.dirLight.position.set(45, 26, 60);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 180;
    const d = 42;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // Radiant Horizon Sun / Moon with Soft Outer Halo
    this.sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.CircleGeometry(16, 32),
      new THREE.MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0.98 })
    );
    this.sunGroup.add(sunCore);

    const sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.35 })
    );
    this.sunGroup.add(sunHalo);

    this.sunMesh = this.sunGroup;
    this.sunMesh.position.set(45, 24, 280);
    this.scene.add(this.sunMesh);
  }

  setEnvironment(theme) {
    this.environmentTheme = theme;
    if (!this.scene) return;

    // Do not override if currently in LiDAR mode
    if (this.isLidarMode) return;

    const skyTexture = this.createGradientSkyTexture(theme);
    if (this.skyMat) {
      this.skyMat.map = skyTexture;
      this.skyMat.needsUpdate = true;
    }

    if (theme === 'day') {
      this.scene.fog = new THREE.FogExp2(0xcce7fc, 0.0014);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xfef9c3);
        this.hemiLight.groundColor.setHex(0x52525b);
        this.hemiLight.intensity = 0.95;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xffffff);
        this.dirLight.intensity = 1.45;
        this.dirLight.position.set(35, 60, 40);
      }
      if (this.sunMesh) {
        this.sunMesh.visible = true;
        this.sunMesh.children[0].material.color.setHex(0xffffff);
        this.sunMesh.children[1].material.color.setHex(0xfef08a);
        this.sunMesh.children[1].material.opacity = 0.28;
        this.sunMesh.position.set(35, 55, 240);
        this.sunMesh.scale.set(1.0, 1.0, 1.0);
      }
      if (this.rainParticles) this.rainParticles.visible = false;
      if (this.headlights) this.headlights.forEach(hl => hl.visible = false);
      if (this.roadMesh && this.roadMesh.material) {
        this.roadMesh.material.roughness = 0.92;
        this.roadMesh.material.metalness = 0.08;
      }
    } else if (theme === 'night') {
      this.scene.fog = new THREE.FogExp2(0x0d172e, 0.0028);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x38bdf8);
        this.hemiLight.groundColor.setHex(0x020617);
        this.hemiLight.intensity = 0.45;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0x93c5fd);
        this.dirLight.intensity = 0.60;
        this.dirLight.position.set(25, 45, 20);
      }
      if (this.sunMesh) {
        this.sunMesh.visible = true;
        this.sunMesh.children[0].material.color.setHex(0xf1f5f9);
        this.sunMesh.children[1].material.color.setHex(0x94a3b8);
        this.sunMesh.children[1].material.opacity = 0.25;
        this.sunMesh.position.set(-25, 45, 200);
        this.sunMesh.scale.set(0.7, 0.7, 0.7);
      }
      if (this.rainParticles) this.rainParticles.visible = false;
      if (this.headlights) this.headlights.forEach(hl => hl.visible = true);
      if (this.roadMesh && this.roadMesh.material) {
        this.roadMesh.material.roughness = 0.92;
        this.roadMesh.material.metalness = 0.08;
      }
    } else if (theme === 'rain') {
      this.scene.fog = new THREE.FogExp2(0x1e293b, 0.0030);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x64748b);
        this.hemiLight.groundColor.setHex(0x0f172a);
        this.hemiLight.intensity = 0.58;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0x94a3b8);
        this.dirLight.intensity = 0.72;
        this.dirLight.position.set(20, 45, 25);
      }
      if (this.sunMesh) this.sunMesh.visible = false;
      if (this.rainParticles) this.rainParticles.visible = true;
      if (this.headlights) this.headlights.forEach(hl => hl.visible = true);
      if (this.roadMesh && this.roadMesh.material) {
        this.roadMesh.material.roughness = 0.25;
        this.roadMesh.material.metalness = 0.35;
      }
    } else { // 'sunset' (Village Golden Hour - Default)
      this.scene.fog = new THREE.FogExp2(0xfba743, 0.0016);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xfb923c);
        this.hemiLight.groundColor.setHex(0x292524);
        this.hemiLight.intensity = 0.88;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xffedd5);
        this.dirLight.intensity = 1.38;
        this.dirLight.position.set(45, 24, 60);
      }
      if (this.sunMesh) {
        this.sunMesh.visible = true;
        this.sunMesh.children[0].material.color.setHex(0xffedd5);
        this.sunMesh.children[1].material.color.setHex(0xf97316);
        this.sunMesh.children[1].material.opacity = 0.38;
        this.sunMesh.position.set(45, 24, 280);
        this.sunMesh.scale.set(1.3, 1.3, 1.3);
      }
      if (this.rainParticles) this.rainParticles.visible = false;
      if (this.headlights) this.headlights.forEach(hl => hl.visible = false);
      if (this.roadMesh && this.roadMesh.material) {
        this.roadMesh.material.roughness = 0.92;
        this.roadMesh.material.metalness = 0.08;
      }
    }
  }

  buildVillageEnvironment() {
    this.roadLength = 420;
    this.roadWidth = 7.4; // Authentic narrow 2-way undivided village road

    // A. Winding Road Mesh with Scrolling Asphalt Texture
    this.roadSegmentsZ = 160;
    this.roadSegmentsX = 14;
    this.roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength, this.roadSegmentsX, this.roadSegmentsZ);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.roadGeo.translate(0, 0.02, this.roadLength / 2 - 25);

    const roadCount = this.roadGeo.attributes.position.count;
    this.roadGeo.userData.origX = new Float32Array(roadCount);
    for (let i = 0; i < roadCount; i++) {
      this.roadGeo.userData.origX[i] = this.roadGeo.attributes.position.getX(i);
    }

    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: false
    });
    this.roadMesh = new THREE.Mesh(this.roadGeo, this.roadMat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // B. Road Boundary Weathered Edge Strips (Outer White Markings - NO Center Divider)
    this.edgeGeos = [];
    this.edgeTextures = [];
    const edgeWidth = 0.12;
    [-1, 1].forEach(side => {
      const edgeGeo = new THREE.PlaneGeometry(edgeWidth, this.roadLength, 1, this.roadSegmentsZ);
      edgeGeo.rotateX(-Math.PI / 2);
      edgeGeo.translate(side * (this.roadWidth / 2 - 0.18), 0.025, this.roadLength / 2 - 25);
      const edgeCount = edgeGeo.attributes.position.count;
      edgeGeo.userData.origX = new Float32Array(edgeCount);
      for (let i = 0; i < edgeCount; i++) {
        edgeGeo.userData.origX[i] = edgeGeo.attributes.position.getX(i);
      }

      // Simple white dashed texture for edge strip
      const edgeCanvas = document.createElement('canvas');
      edgeCanvas.width = 16;
      edgeCanvas.height = 128;
      const ectx = edgeCanvas.getContext('2d');
      ectx.fillStyle = 'rgba(240, 240, 245, 0.85)';
      ectx.fillRect(0, 0, 16, 128);
      const edgeTex = new THREE.CanvasTexture(edgeCanvas);
      edgeTex.wrapS = THREE.RepeatWrapping;
      edgeTex.wrapT = THREE.RepeatWrapping;
      edgeTex.repeat.set(1, 36);
      this.edgeTextures.push(edgeTex);

      const edgeMat = new THREE.MeshStandardMaterial({
        map: edgeTex,
        roughness: 0.85,
        transparent: true,
        opacity: 0.80
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.receiveShadow = true;
      this.scene.add(edgeMesh);
      this.edgeGeos.push(edgeGeo);
    });

    // C. Dirt / Red Gravel Shoulders with Scrolling Texture
    const shoulderWidth = 12.0;
    this.shoulderGeo = new THREE.PlaneGeometry(shoulderWidth, this.roadLength, this.roadSegmentsX, this.roadSegmentsZ);
    this.shoulderGeo.rotateX(-Math.PI / 2);
    this.shoulderGeo.translate(0, 0.005, this.roadLength / 2 - 25);

    const shoulderCount = this.shoulderGeo.attributes.position.count;
    this.shoulderGeo.userData.origX = new Float32Array(shoulderCount);
    for (let i = 0; i < shoulderCount; i++) {
      this.shoulderGeo.userData.origX[i] = this.shoulderGeo.attributes.position.getX(i);
    }

    this.shoulderMat = new THREE.MeshStandardMaterial({
      map: this.shoulderTexture,
      roughness: 1.0,
      metalness: 0.0
    });
    this.shoulderMesh = new THREE.Mesh(this.shoulderGeo, this.shoulderMat);
    this.shoulderMesh.receiveShadow = true;
    this.scene.add(this.shoulderMesh);

    // D. Expansive Agricultural Field Landscape (Paddy, sugarcane & rural soil)
    const fieldGeo = new THREE.PlaneGeometry(360, this.roadLength + 100, 24, 60);
    fieldGeo.rotateX(-Math.PI / 2);
    fieldGeo.translate(0, -0.06, this.roadLength / 2 - 25);
    const fieldMat = new THREE.MeshStandardMaterial({
      color: 0x243319,
      roughness: 0.98,
      metalness: 0.0
    });
    this.fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
    this.fieldMesh.receiveShadow = true;
    this.scene.add(this.fieldMesh);

    // E. Build Procedural Village Scenery Props
    this.buildVillageProps();
  }

  /**
   * Builds Rich & Non-Repeating Authentic Indian Village Props along a 420m Corridor:
   * Roadside Chai Tapri / Dhaba with benches, Whitewashed Temple Shrine with saffron flag,
   * Traditional Stone Water Well, Bullock Cart, Flowering Gulmohar, Banyan Tree with roots,
   * Coconut Palms, Mud Huts, Whitewashed Brick Houses, Haystacks, Utility Poles with Drooping Wires
   */
  buildVillageProps() {
    this.villageProps = [];

    // Shared Materials
    const mudWallMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.95 }); // Ochre mud
    const whiteWallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.88 }); // Whitewash brick
    const thatchRoofMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.95 }); // Dried straw
    const tileRoofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }); // Terracotta tile
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x573a1e, roughness: 0.9 });
    const leafGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 });
    const gulmoharMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.85 }); // Fiery crimson flower canopy
    const haystackMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.95 }); // Golden straw
    const concretePoleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Saffron saffron flag
    const tarpBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 }); // Blue Dhaba tarp
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // Distribute diverse props along the 420m road corridor
    for (let z = 0; z < this.roadLength; z += 12) {
      const side = (z % 24 === 0) ? 1 : -1;
      const baseDistX = (this.roadWidth / 2 + 3.8) * side;

      // 1. Roadside Chai Dhaba / Tea Stall every ~84m
      if (z % 84 === 12) {
        const dhaba = new THREE.Group();

        // Wooden Stall Counter
        const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.8), woodMat);
        counter.position.set(0, 0.6, 0);
        counter.castShadow = true;
        dhaba.add(counter);

        // Slanted Blue Tarpaulin Canopy Roof
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 2.8), tarpBlueMat);
        canopy.position.set(0, 2.1, 0.2);
        canopy.rotation.x = 0.15;
        canopy.castShadow = true;
        dhaba.add(canopy);

        // Canopy Support Posts
        [-1.7, 1.7].forEach(px => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), woodMat);
          post.position.set(px, 1.05, 1.2);
          dhaba.add(post);
        });

        // Brass Tea Kettle (Samovar) on Counter
        const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 10), brassMat);
        kettle.position.set(-0.6, 1.42, 0);
        dhaba.add(kettle);

        // Wooden Bench (Charpoy) for tea drinkers
        const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.7), woodMat);
        bench.position.set(0, 0.25, 2.4);
        bench.castShadow = true;
        dhaba.add(bench);

        dhaba.userData = { relX: baseDistX + (side * 2.2), baseZ: z - 20, type: 'dhaba', baseYaw: side > 0 ? -Math.PI / 2 : Math.PI / 2 };
        this.scene.add(dhaba);
        this.villageProps.push(dhaba);
      }

      // 2. Roadside Temple Shrine (*Chhota Mandir*) every ~120m
      else if (z % 120 === 24) {
        const mandir = new THREE.Group();

        // Stepped Stone Platform
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 3.0), stoneMat);
        step1.position.y = 0.18;
        mandir.add(step1);

        const step2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 2.2), whiteWallMat);
        step2.position.y = 0.52;
        mandir.add(step2);

        // Sanctum Dome / Shikhar
        const sanctum = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), whiteWallMat);
        sanctum.position.y = 1.4;
        mandir.add(sanctum);

        const dome = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 8), tileRoofMat);
        dome.position.y = 2.9;
        mandir.add(dome);

        // Saffron Flag fluttering atop dome
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), brassMat);
        mast.position.y = 3.8;
        mandir.add(mast);

        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 3), flagMat);
        flag.rotation.z = Math.PI / 2;
        flag.position.set(0.35, 4.2, 0);
        mandir.add(flag);

        mandir.userData = { relX: baseDistX + (side * 3.5), baseZ: z - 20, type: 'mandir' };
        this.scene.add(mandir);
        this.villageProps.push(mandir);
      }

      // 3. Traditional Village Water Well (*Kuan*) every ~144m
      else if (z % 144 === 48) {
        const well = new THREE.Group();

        // Circular Stone Well Wall
        const wellWall = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 1.4, 1.1, 16, 1, true),
          stoneMat
        );
        wellWall.position.y = 0.55;
        wellWall.castShadow = true;
        well.add(wellWall);

        // Dark Water Interior
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(1.3, 16),
          new THREE.MeshBasicMaterial({ color: 0x0f293b })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.25;
        well.add(water);

        // Wooden Pulley Frame
        [-1.1, 1.1].forEach(px => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), woodMat);
          post.position.set(px, 1.1, 0);
          well.add(post);
        });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), woodMat);
        beam.position.y = 2.15;
        well.add(beam);

        well.userData = { relX: baseDistX + (side * 4.2), baseZ: z - 20, type: 'well' };
        this.scene.add(well);
        this.villageProps.push(well);
      }

      // 4. Village Mud Hut / Whitewashed House every ~48m
      else if (z % 48 === 0) {
        const hut = new THREE.Group();
        const isTile = (z % 96 === 0);

        const wallMat = isTile ? whiteWallMat : mudWallMat;
        const walls = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.5, 5.2), wallMat);
        walls.position.y = 1.25;
        walls.castShadow = true;
        walls.receiveShadow = true;
        hut.add(walls);

        const roofMat = isTile ? tileRoofMat : thatchRoofMat;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 1.9, 4), roofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 3.2;
        roof.castShadow = true;
        hut.add(roof);

        // Veranda
        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.6), woodMat);
        porchRoof.position.set(0, 1.8, (side > 0 ? -2.9 : 2.9));
        hut.add(porchRoof);

        const winMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), winMat);
        windowMesh.position.set(0, 1.4, (side > 0 ? -2.62 : 2.62));
        hut.add(windowMesh);

        hut.userData = { relX: baseDistX + (side * 3.0), baseZ: z - 20, type: 'hut' };
        this.scene.add(hut);
        this.villageProps.push(hut);

        // Conical Haystack beside hut
        const haystack = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.6, 10), haystackMat);
        haystack.position.y = 1.3;
        haystack.castShadow = true;
        haystack.userData = { relX: baseDistX + (side * 7.0), baseZ: z - 16, type: 'haystack' };
        this.scene.add(haystack);
        this.villageProps.push(haystack);
      }

      // 5. Parked Bullock Cart (*Bail Gadi*) on shoulder every ~160m
      else if (z % 160 === 72) {
        const cart = new THREE.Group();

        // Wooden Bed
        const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 2.8), woodMat);
        bed.position.set(0, 0.65, 0);
        cart.add(bed);

        // Two large spoked wagon wheels
        [-0.95, 0.95].forEach(wx => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.12, 14), woodMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.65, 0);
          wheel.castShadow = true;
          cart.add(wheel);
        });

        // Draught Pole tipped forward
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), woodMat);
        pole.rotation.x = 0.35;
        pole.position.set(0, 0.45, 1.4);
        cart.add(pole);

        cart.userData = { relX: baseDistX + (side * 1.8), baseZ: z - 20, type: 'cart' };
        this.scene.add(cart);
        this.villageProps.push(cart);
      }

      // 6. Diverse Indian Trees (Gulmohar, Banyan, Coconut Palm, Neem)
      else if (z % 12 === 0) {
        const tree = new THREE.Group();
        const treeChoice = (z / 12) % 4;

        if (treeChoice === 0) {
          // Flowering Gulmohar Tree (Fiery crimson flower canopy)
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 8), woodMat);
          trunk.position.y = 1.7;
          trunk.castShadow = true;
          tree.add(trunk);

          const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), gulmoharMat);
          canopy.position.set(0, 4.2, 0);
          canopy.scale.set(1.4, 0.75, 1.4); // wide umbrella spread
          canopy.castShadow = true;
          tree.add(canopy);

        } else if (treeChoice === 1) {
          // Spreading Banyan Tree with Hanging Aerial Prop Roots
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 3.2, 8), woodMat);
          trunk.position.y = 1.6;
          trunk.castShadow = true;
          tree.add(trunk);

          // Hanging Aerial Roots
          [-1.2, 1.2].forEach(rx => {
            const root = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 3.0, 6), woodMat);
            root.position.set(rx, 1.5, (Math.random() - 0.5) * 1.5);
            tree.add(root);
          });

          const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 1), darkLeafMat);
          canopy.position.set(0, 4.2, 0);
          canopy.scale.set(1.5, 0.8, 1.5);
          canopy.castShadow = true;
          tree.add(canopy);

        } else if (treeChoice === 2) {
          // Slender Indian Coconut Palm
          const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 8.8, 8);
          const trunk = new THREE.Mesh(trunkGeo, woodMat);
          trunk.position.y = 4.4;
          trunk.rotation.z = side * 0.12;
          trunk.castShadow = true;
          tree.add(trunk);

          for (let f = 0; f < 8; f++) {
            const frondGeo = new THREE.ConeGeometry(0.5, 2.9, 4);
            const frond = new THREE.Mesh(frondGeo, leafGreenMat);
            const angle = (f / 8) * Math.PI * 2;
            frond.rotation.set(0.65 * Math.cos(angle), angle, 0.65 * Math.sin(angle));
            frond.position.set(0.65 * Math.cos(angle), 8.6, 0.65 * Math.sin(angle));
            tree.add(frond);
          }

        } else {
          // Leafy Neem Tree
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 3.2, 8), woodMat);
          trunk.position.y = 1.6;
          trunk.castShadow = true;
          tree.add(trunk);

          const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), leafGreenMat);
          c1.position.set(0, 3.8, 0);
          c1.castShadow = true;
          tree.add(c1);

          const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), darkLeafMat);
          c2.position.set(0.8, 4.8, -0.4);
          tree.add(c2);
        }

        tree.userData = { relX: baseDistX + (side * 1.6), baseZ: z - 20, type: 'tree' };
        this.scene.add(tree);
        this.villageProps.push(tree);
      }

      // 7. Concrete Utility Poles with Drooping Wires every ~36m
      if (z % 36 === 0) {
        const pole = new THREE.Group();
        const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 8), concretePoleMat);
        poleMesh.position.y = 3.6;
        poleMesh.castShadow = true;
        pole.add(poleMesh);

        const crossarm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 }));
        crossarm.position.y = 6.9;
        pole.add(crossarm);

        [-0.65, 0, 0.65].forEach(ix => {
          const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }));
          ins.position.set(ix, 7.02, 0);
          pole.add(ins);
        });

        // Overhead Drooping Wire to next pole
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 36.2, 4), wireMat);
        wire.rotation.x = Math.PI / 2;
        wire.position.set(0, 6.75, 18.0);
        pole.add(wire);

        pole.userData = { relX: this.roadWidth / 2 + 2.4, baseZ: z - 20, type: 'pole' };
        this.scene.add(pole);
        this.villageProps.push(pole);
      }

      // 8. Highway Milestone every ~60m
      if (z % 60 === 0) {
        const milestone = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
        base.position.y = 0.3;
        milestone.add(base);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
        dome.position.y = 0.6;
        milestone.add(dome);

        milestone.userData = { relX: (this.roadWidth / 2 + 0.6) * side, baseZ: z - 20, type: 'milestone' };
        this.scene.add(milestone);
        this.villageProps.push(milestone);
      }

      // 9. Indian Speed Breaker Rumbler & Caution Signpost every ~120m
      if (z % 120 === 60) {
        // A. Speed Bump across the asphalt
        const bumpGroup = new THREE.Group();
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

        const segWidth = 0.9;
        const totalSegs = Math.floor(this.roadWidth / segWidth);
        for (let s = 0; s < totalSegs; s++) {
          const segMat = (s % 2 === 0) ? yellowMat : blackMat;
          const bumpSegment = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, segWidth - 0.04, 12, 1, false, 0, Math.PI),
            segMat
          );
          bumpSegment.rotation.z = Math.PI / 2;
          bumpSegment.position.set(-this.roadWidth / 2 + (s + 0.5) * segWidth, 0.08, 0);
          bumpSegment.scale.set(1.0, 0.25, 1.8);
          bumpGroup.add(bumpSegment);
        }

        bumpGroup.userData = { relX: 0, baseZ: z, type: 'speed_bump' };
        this.scene.add(bumpGroup);
        this.villageProps.push(bumpGroup);

        // B. Roadside Indian Warning Signpost on pole
        const signGroup = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
        const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), poleMat);
        signPole.position.y = 1.3;
        signGroup.add(signPole);

        const signBoardGeo = new THREE.ConeGeometry(0.65, 0.95, 3);
        const signBoardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
        signBoard.rotation.z = Math.PI;
        signBoard.rotation.y = (side === 1 ? -Math.PI / 2 : Math.PI / 2);
        signBoard.position.set(0, 2.6, 0);
        signGroup.add(signBoard);

        const borderGeo = new THREE.ConeGeometry(0.52, 0.78, 3);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
        const innerBoard = new THREE.Mesh(borderGeo, borderMat);
        innerBoard.rotation.z = Math.PI;
        innerBoard.rotation.y = (side === 1 ? -Math.PI / 2 : Math.PI / 2);
        innerBoard.position.set(0, 2.6, 0.02 * side);
        signGroup.add(innerBoard);

        signGroup.userData = { relX: (this.roadWidth / 2 + 1.2) * side, baseZ: z - 32, type: 'signpost' };
        this.scene.add(signGroup);
        this.villageProps.push(signGroup);
      }
    }
  }

  setupDustParticles() {
    const count = 45;
    const dustGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 1.8;
      positions[i * 3 + 1] = 0.15 + Math.random() * 0.4;
      positions[i * 3 + 2] = -2.2 - Math.random() * 8.0;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd4a373,
      size: 0.55,
      transparent: true,
      opacity: 0.40,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustParticles);
  }

  // ============================================================================
  // Advanced Visual System 1: Glowing Frenet AI Trajectory Ribbon
  // ============================================================================
  setupTrajectoryRibbon() {
    const segments = 36;
    this.trajSegments = segments;
    this.trajRibbonWidth = 1.65;

    const vertCount = (segments + 1) * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    for (let i = 0; i < segments; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }

    const trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trajGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    trajGeo.setIndex(indices);

    // Procedural chevron texture on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.fillRect(0, 0, 64, 256);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let y = 20; y < 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(10, y + 22);
      ctx.lineTo(32, y);
      ctx.lineTo(54, y + 22);
      ctx.stroke();
    }

    const trajTex = new THREE.CanvasTexture(canvas);
    trajTex.wrapS = THREE.ClampToEdgeWrapping;
    trajTex.wrapT = THREE.RepeatWrapping;
    trajTex.repeat.set(1, 4);
    this.trajTexture = trajTex;

    const trajMat = new THREE.MeshBasicMaterial({
      map: trajTex,
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.trajectoryMesh = new THREE.Mesh(trajGeo, trajMat);
    this.trajectoryMesh.renderOrder = 15;
    this.scene.add(this.trajectoryMesh);
  }

  updateTrajectoryRibbon(dt) {
    if (!this.trajectoryMesh) return;
    const geo = this.trajectoryMesh.geometry;
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;

    // Scroll texture forward at vehicle speed + chevron pulse
    const speedMs = (this.currentTelemetry.speed_kmh || 0) / 3.6;
    if (this.trajTexture) {
      this.trajTexture.offset.y = (this.trajTexture.offset.y - dt * (1.8 + speedMs * 0.16)) % 1.0;
    }

    // Dynamic color depending on vehicle state (AEB, Evasion, or Cruise)
    const brakePct = this.currentTelemetry.brake_pct || 0;
    const isEvasion = Math.abs(this.smoothedSteerDeg) > 4.5 || (this.currentTelemetry.optimal_offset_m !== undefined && Math.abs(this.currentTelemetry.optimal_offset_m) > 0.8);

    if (brakePct > 45) {
      this.trajectoryMesh.material.color.setHex(0xef4444); // Red AEB warning
      this.trajectoryMesh.material.opacity = 0.92;
    } else if (isEvasion) {
      this.trajectoryMesh.material.color.setHex(0xf59e0b); // Amber Evasion
      this.trajectoryMesh.material.opacity = 0.88;
    } else {
      this.trajectoryMesh.material.color.setHex(this.isLidarMode ? 0x00f5d4 : 0x06b6d4); // Cyan nominal
      this.trajectoryMesh.material.opacity = 0.74;
    }

    const startZ = 1.6;
    const endZ = 42.0;
    const curX = this.smoothedLaneX;
    const targetX = (this.currentTelemetry.optimal_offset_m !== undefined) ? this.currentTelemetry.optimal_offset_m : this.smoothedLaneX;
    const halfW = this.trajRibbonWidth * 0.5;

    for (let i = 0; i <= this.trajSegments; i++) {
      const t = i / this.trajSegments;
      const z = startZ + t * (endZ - startZ);

      // Smooth Hermite/quintic curve from current lane offset to planned target offset
      const smoothT = t * t * (3.0 - 2.0 * t);
      const laneOffset = THREE.MathUtils.lerp(curX, targetX, smoothT);

      // Road curve at this z
      const rc = this.getRoadCurve(z, this.distanceTraveled);
      const centerX = rc.x + laneOffset;
      const centerY = rc.y + 0.055; // hovering slightly above asphalt

      // Trajectory tangent yaw for perpendicular ribbon width
      const lookDelta = 1.5;
      const rcAhead = this.getRoadCurve(z + lookDelta, this.distanceTraveled);
      const nextT = Math.min(1.0, (i + 1) / this.trajSegments);
      const nextSmoothT = nextT * nextT * (3.0 - 2.0 * nextT);
      const nextLaneOffset = THREE.MathUtils.lerp(curX, targetX, nextSmoothT);
      const nextCenterX = rcAhead.x + nextLaneOffset;
      const dyaw = Math.atan2(nextCenterX - centerX, lookDelta);

      const perpX = Math.cos(dyaw) * halfW;
      const perpZ = -Math.sin(dyaw) * halfW;

      // Left vertex
      const idxLeft = i * 2;
      pos.setXYZ(idxLeft, centerX - perpX, centerY, z - perpZ);
      uvs.setXY(idxLeft, 0, t * 4);

      // Right vertex
      const idxRight = i * 2 + 1;
      pos.setXYZ(idxRight, centerX + perpX, centerY, z + perpZ);
      uvs.setXY(idxRight, 1, t * 4);
    }

    pos.needsUpdate = true;
    uvs.needsUpdate = true;
  }

  // ============================================================================
  // Advanced Visual System 2: 3D Holographic Perception Brackets & Distance Tags
  // ============================================================================
  updateTargetBadge(model, v) {
    if (!model) return;
    const distM = Math.hypot(v.x - this.smoothedLaneX, v.z);

    // Only display within 52m detection range
    if (v.z < -6.0 || v.z > 52.0) {
      if (model.userData.hudBadge) model.userData.hudBadge.visible = false;
      return;
    }

    let badge = model.userData.hudBadge;
    if (!badge) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      badge = new THREE.Sprite(mat);
      badge.scale.set(4.2, 1.55, 1.0);
      badge.userData = { canvas: canvas, texture: texture, lastText: '' };
      model.add(badge);
      model.userData.hudBadge = badge;
    }

    badge.visible = true;
    // Position above obstacle roof
    const heightOffset = (v.type === 'truck' ? 3.6 : (v.type === 'tractor' ? 3.0 : 2.2));
    badge.position.set(0, heightOffset, 0);

    // Determine hazard condition
    const inCorridor = Math.abs(v.x - this.smoothedLaneX) < 1.6;
    const isImminent = inCorridor && v.z > 0 && v.z < 26.0;
    const isEvading = isImminent && Math.abs(this.smoothedSteerDeg) > 4.0;

    let statusText = 'CLEAR';
    let statusColor = '#22c55e'; // Green
    let bracketColor = '#38bdf8'; // Blue
    if (isEvading) {
      statusText = 'EVADING';
      statusColor = '#f59e0b';
      bracketColor = '#f59e0b';
    } else if (isImminent) {
      statusText = 'IN PATH';
      statusColor = '#ef4444';
      bracketColor = '#ef4444';
    }

    const labelKey = `${v.type}_${distM.toFixed(0)}_${statusText}`;
    if (badge.userData.lastText === labelKey) return; // cache
    badge.userData.lastText = labelKey;

    const ctx = badge.userData.canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 96);

    // Glowing Cyberpunk Background Plate
    ctx.fillStyle = 'rgba(10, 15, 30, 0.72)';
    ctx.strokeStyle = bracketColor;
    ctx.lineWidth = 2.5;

    // Corner brackets
    const bLen = 16;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(12, 12 + bLen); ctx.lineTo(12, 12); ctx.lineTo(12 + bLen, 12);
    // Top-right
    ctx.moveTo(244 - bLen, 12); ctx.lineTo(244, 12); ctx.lineTo(244, 12 + bLen);
    // Bottom-left
    ctx.moveTo(12, 84 - bLen); ctx.lineTo(12, 84); ctx.lineTo(12 + bLen, 84);
    // Bottom-right
    ctx.moveTo(244 - bLen, 84); ctx.lineTo(244, 84); ctx.lineTo(244, 84 - bLen);
    ctx.stroke();

    // Center fill
    ctx.fillRect(16, 16, 224, 64);

    // Text: Class Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    const cleanName = (v.type || 'TARGET').toUpperCase().replace('_', ' ');
    ctx.fillText(cleanName, 128, 40);

    // Text: Distance + Status
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${distM.toFixed(1)}m`, 85, 66);

    ctx.fillStyle = statusColor;
    ctx.fillText(`[${statusText}]`, 165, 66);

    badge.userData.texture.needsUpdate = true;
  }

  // ============================================================================
  // Advanced Visual System 3: Interactive 360° Mouse Orbit & Camera Controls
  // ============================================================================
  setupMouseInteractions() {
    this.orbitYaw = 0.0;
    this.orbitPitch = 0.38;
    this.orbitDist = 9.8;
    this.isDragging = false;
    this.previousMouse = { x: 0, y: 0 };

    if (!this.renderer || !this.renderer.domElement) return;
    const dom = this.renderer.domElement;
    dom.style.cursor = 'grab';

    dom.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.previousMouse = { x: e.clientX, y: e.clientY };
      dom.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouse.x;
      const dy = e.clientY - this.previousMouse.y;
      this.previousMouse = { x: e.clientX, y: e.clientY };

      this.orbitYaw += dx * 0.007;
      this.orbitPitch = Math.max(0.08, Math.min(1.42, this.orbitPitch + dy * 0.005));

      // Seamlessly switch to orbit mode when user drags
      if (this.cameraView !== 'orbit' && this.cameraView !== 'drone') {
        this.cameraView = 'orbit';
        document.querySelectorAll('.btn-angle').forEach(b => b.classList.remove('active'));
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      dom.style.cursor = 'grab';
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbitDist = Math.max(4.5, Math.min(26.0, this.orbitDist + e.deltaY * 0.015));
      if (this.cameraView !== 'orbit' && this.cameraView !== 'drone') {
        this.cameraView = 'orbit';
        document.querySelectorAll('.btn-angle').forEach(b => b.classList.remove('active'));
      }
    }, { passive: false });
  }

  // ============================================================================
  // Advanced Visual System 4: LiDAR Point-Cloud Sensor Mode
  // ============================================================================
  setupLidarElements() {
    this.isLidarMode = false;

    // A. Concentric LiDAR Range Rings centered on ego car (10m, 20m, 30m)
    this.lidarRingsGroup = new THREE.Group();
    this.lidarRingsGroup.visible = false;

    [10, 20, 30].forEach(r => {
      const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 64);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        transparent: true,
        opacity: 0.40,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.08;
      this.lidarRingsGroup.add(ringMesh);
    });

    // B. Rotating 360° LiDAR Scanner Beam Sweep
    const sweepGeo = new THREE.ConeGeometry(32, 0.02, 32, 1, true, 0, Math.PI * 0.28);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    this.lidarSweep = new THREE.Mesh(sweepGeo, sweepMat);
    this.lidarSweep.position.y = 0.12;
    this.lidarRingsGroup.add(this.lidarSweep);

    this.scene.add(this.lidarRingsGroup);
  }

  setSensorMode(mode) {
    this.sensorMode = mode;
    this.isLidarMode = (mode === 'lidar');

    if (this.isLidarMode) {
      // Dark cybernetic LiDAR scanner aesthetic
      this.scene.background = new THREE.Color(0x030712);
      this.scene.fog = new THREE.FogExp2(0x030712, 0.005);
      if (this.lidarRingsGroup) this.lidarRingsGroup.visible = true;
      if (this.skyDome) this.skyDome.visible = false;
      if (this.sunMesh) this.sunMesh.visible = false;
      if (this.roadMesh && this.roadMesh.material) this.roadMesh.material.wireframe = true;
      if (this.shoulderMesh && this.shoulderMesh.material) this.shoulderMesh.material.wireframe = true;
    } else {
      // Restore standard realistic 3D
      if (this.lidarRingsGroup) this.lidarRingsGroup.visible = false;
      if (this.skyDome) this.skyDome.visible = true;
      if (this.roadMesh && this.roadMesh.material) this.roadMesh.material.wireframe = false;
      if (this.shoulderMesh && this.shoulderMesh.material) this.shoulderMesh.material.wireframe = false;
      this.setEnvironment(this.environmentTheme);
    }
  }

  // ============================================================================
  // Advanced Visual System 5: Dynamic Monsoon Rain & Projector Headlights
  // ============================================================================
  setupMonsoonRain() {
    const rainCount = 1200;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i] = 24.0 + Math.random() * 12.0;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  setupProjectorHeadlights() {
    this.headlights = [];
    if (!this.egoVehicle) return;

    [-0.72, 0.72].forEach(hx => {
      const spot = new THREE.SpotLight(0xfff8ee, 3.2, 55, 0.42, 0.55, 1.2);
      spot.position.set(hx, 0.5, 2.2);
      const target = new THREE.Object3D();
      target.position.set(hx, 0.1, 28.0);
      this.egoVehicle.add(spot);
      this.egoVehicle.add(target);
      spot.target = target;
      spot.visible = false;
      this.headlights.push(spot);
    });
  }

  buildRealisticEgoVehicle() {
    this.egoVehicle = new THREE.Group();

    // 1. Soft Ambient Ground Contact Shadow Plane Under Vehicle
    const contactShadow = this.createContactShadow(2.4, 4.8, 0.82);
    this.egoVehicle.add(contactShadow);

    // 2. Suspended Body Chassis Group (Pitches & Rolls on suspension)
    this.egoBody = new THREE.Group();
    this.egoBody.position.y = 0.25;
    this.egoVehicle.add(this.egoBody);

    const carPaintMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Metallic electric blue
      metalness: 0.35,
      roughness: 0.30
    });

    const cabinGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0a1120,
      metalness: 0.65,
      roughness: 0.12,
      transparent: true,
      opacity: 0.90
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.75,
      metalness: 0.2
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.15
    });

    // Lower Main Sculpted Body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.52, 4.3), carPaintMat);
    lowerBody.position.y = 0.38;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    this.egoBody.add(lowerBody);

    // Aerodynamic Hood Incline
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 1.4), carPaintMat);
    hood.position.set(0, 0.58, 1.25);
    hood.rotation.x = -0.06;
    this.egoBody.add(hood);

    // Front Grille & Chrome Emblem
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.1), trimMat);
    grille.position.set(0, 0.34, 2.15);
    this.egoBody.add(grille);

    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), chromeMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 0.36, 2.21);
    this.egoBody.add(emblem);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.08, 0.4), trimMat);
    splitter.position.set(0, 0.14, 2.08);
    this.egoBody.add(splitter);

    // Cabin Greenhouse Glass
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.60, 2.3), cabinGlassMat);
    cabin.position.set(0, 0.90, -0.2);
    cabin.castShadow = true;
    this.egoBody.add(cabin);

    // Roof Panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.08, 1.6), carPaintMat);
    roof.position.set(0, 1.21, -0.3);
    this.egoBody.add(roof);

    // Side Mirrors
    [-0.98, 0.98].forEach(mx => {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), carPaintMat);
      mirror.position.set(mx, 0.74, 0.55);
      this.egoBody.add(mirror);
    });

    // Projector LED Headlights (Clean bezels, NO intersecting cone meshes)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.72, 0.72].forEach(hx => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), hlMat);
      hl.position.set(hx, 0.48, 2.15);
      this.egoBody.add(hl);
    });

    // Full-Width Rear LED Brake Light Bar
    this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.egoBrakeLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.11, 0.08), this.brakeLightMat);
    this.egoBrakeLightBar.position.set(0, 0.54, -2.15);
    this.egoBody.add(this.egoBrakeLightBar);

    // Dual Chrome Exhausts & Rear Plate
    [-0.58, 0.58].forEach(ex => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.18, -2.18);
      this.egoBody.add(pipe);
    });

    const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    rearPlate.position.set(0, 0.32, -2.16);
    this.egoBody.add(rearPlate);

    // Turn Signals
    this.blinkerMatLeft = new THREE.MeshBasicMaterial({ color: 0x271900 });
    this.blinkerMatRight = new THREE.MeshBasicMaterial({ color: 0x271900 });
    const blf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), this.blinkerMatLeft);
    blf.position.set(-0.95, 0.48, 2.14);
    this.egoBody.add(blf);
    const brf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), this.blinkerMatRight);
    brf.position.set(0.95, 0.48, 2.14);
    this.egoBody.add(brf);

    // 3. 4 Alloy Wheels Attached Directly to this.egoVehicle (Stay Grounded on Road)
    const wheelPositions = [
      { x: -0.98, y: 0.34, z: 1.35, isFront: true },
      { x: 0.98, y: 0.34, z: 1.35, isFront: true },
      { x: -0.98, y: 0.34, z: -1.35, isFront: false },
      { x: 0.98, y: 0.34, z: -1.35, isFront: false }
    ];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.18 });

    this.egoWheels = [];
    this.egoFrontWheels = [];

    wheelPositions.forEach(wp => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wp.x, wp.y, wp.z);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 10), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      this.egoVehicle.add(wheelGroup);
      this.egoWheels.push(tire);
      if (wp.isFront) this.egoFrontWheels.push(wheelGroup);
    });

    this.scene.add(this.egoVehicle);
  }

  createTrafficModel(type) {
    const group = new THREE.Group();
    const wheels = [];

    if (type === 'tractor') {
      // Indian Farm Tractor with Harvest Trailer
      const tractorMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.7, roughness: 0.3 });
      const hoodMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 });
      const woodTrolleyMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
      const cropMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.9 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 });

      group.add(this.createContactShadow(2.4, 3.6, 0.8));
      const trolleyShadow = this.createContactShadow(2.3, 4.2, 0.8);
      trolleyShadow.position.z = -2.4;
      group.add(trolleyShadow);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.4), hoodMat);
      hood.position.set(0, 1.25, 1.8);
      hood.castShadow = true;
      group.add(hood);

      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), pipeMat);
      chimney.position.set(0.55, 2.1, 2.3);
      group.add(chimney);

      // Translucent Smoke Puff
      const puffGeo = new THREE.SphereGeometry(0.20, 8, 8);
      const puffMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 });
      const smokePuff = new THREE.Mesh(puffGeo, puffMat);
      smokePuff.position.set(0.55, 2.8, 2.3);
      group.add(smokePuff);
      group.userData.smokePuff = smokePuff;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
      seat.position.set(0, 1.35, 0.6);
      group.add(seat);

      [-0.95, 0.95].forEach(rx => {
        const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 16), tireMat);
        rw.rotation.z = Math.PI / 2;
        rw.position.set(rx, 0.72, 0.5);
        rw.castShadow = true;
        group.add(rw);
        wheels.push(rw);
      });

      [-0.72, 0.72].forEach(fx => {
        const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 12), tireMat);
        fw.rotation.z = Math.PI / 2;
        fw.position.set(fx, 0.42, 2.5);
        fw.castShadow = true;
        group.add(fw);
        wheels.push(fw);
      });

      const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 3.8), woodTrolleyMat);
      trolley.position.set(0, 1.25, -2.4);
      trolley.castShadow = true;
      group.add(trolley);

      const crop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 3.5), cropMat);
      crop.position.set(0, 1.7, -2.4);
      group.add(crop);

      [-1.15, 1.15].forEach(tx => {
        const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.32, 12), tireMat);
        tw.rotation.z = Math.PI / 2;
        tw.position.set(tx, 0.48, -2.6);
        tw.castShadow = true;
        group.add(tw);
        wheels.push(tw);
      });

    } else if (type === 'auto_rickshaw') {
      group.add(this.createContactShadow(1.8, 3.0, 0.78));

      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 2.6), greenMat);
      lower.position.y = 0.55;
      lower.castShadow = true;
      group.add(lower);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, 2.2), yellowMat);
      canopy.position.set(0, 1.3, -0.2);
      canopy.castShadow = true;
      group.add(canopy);

      const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), tireMat);
      fw.rotation.z = Math.PI / 2;
      fw.position.set(0, 0.28, 1.1);
      group.add(fw);
      wheels.push(fw);

      [-0.78, 0.78].forEach(rx => {
        const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), tireMat);
        rw.rotation.z = Math.PI / 2;
        rw.position.set(rx, 0.28, -0.8);
        group.add(rw);
        wheels.push(rw);
      });

    } else if (type === 'cattle') {
      group.add(this.createContactShadow(1.4, 2.6, 0.72));

      const cowMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.95 });
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 2.2), cowMat);
      body.position.y = 1.1;
      body.castShadow = true;
      group.add(body);

      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), cowMat);
      hump.position.set(0, 1.7, 0.5);
      group.add(hump);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 0.75), cowMat);
      head.position.set(0, 1.35, 1.25);
      group.add(head);

      [-0.28, 0.28].forEach(hx => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornMat);
        horn.rotation.x = -Math.PI / 4;
        horn.rotation.z = (hx > 0 ? -0.2 : 0.2);
        horn.position.set(hx, 0.4, 0.05);
        head.add(horn);
      });
      group.userData.head = head;

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.75, 6), cowMat);
      tail.position.set(0, 0.85, -1.15);
      tail.rotation.x = -0.3;
      group.add(tail);
      group.userData.tail = tail;

      [-0.38, 0.38].forEach(lx => {
        [-0.7, 0.7].forEach(lz => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), cowMat);
          leg.position.set(lx, 0.38, lz);
          group.add(leg);
        });
      });

    } else if (type === 'truck') {
      group.add(this.createContactShadow(2.6, 8.4, 0.82));

      const cabMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.6 });
      const cargoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b });

      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 2.2), cabMat);
      cab.position.set(0, 1.45, 2.8);
      cab.castShadow = true;
      group.add(cab);

      const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 5.8), cargoMat);
      cargo.position.set(0, 1.6, -1.0);
      cargo.castShadow = true;
      group.add(cargo);

      [-1.15, 1.15].forEach(wx => {
        [2.6, 0.5, -2.8, -3.8].forEach(wz => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 12), tireMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.44, wz);
          group.add(w);
          wheels.push(w);
        });
      });

    } else {
      // Motorcycle
      group.add(this.createContactShadow(1.0, 2.4, 0.72));

      const metalMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 });
      const riderMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 1.8), metalMat);
      frame.position.y = 0.6;
      group.add(frame);

      const rider = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.45), riderMat);
      rider.position.set(0, 1.1, -0.1);
      group.add(rider);

      [0.8, -0.8].forEach(wz => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12), tireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.35, wz);
        group.add(w);
        wheels.push(w);
      });
    }

    // 3D Soft Holographic Radar Target Ring
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.05;
    group.add(halo);

    group.userData = Object.assign(group.userData || {}, { wheels, type });
    this.scene.add(group);
    return group;
  }

  updateFromTelemetry(telemetry) {
    this.currentTelemetry = telemetry;

    if (this.egoBrakeLightBar && this.brakeLightMat) {
      const isBraking = (telemetry.brake_pct > 0 || telemetry.speed_kmh === 0);
      this.brakeLightMat.color.setHex(isBraking ? 0xff0033 : 0x440011);
    }

    const sig = telemetry.turn_signal || 'OFF';
    const isBlinkOn = (Math.floor(performance.now() / 320) % 2 === 0);
    const activeAmber = 0xf59e0b;
    const dimAmber = 0x271900;

    if (this.blinkerMatLeft) {
      const leftActive = (sig === 'LEFT' || sig === 'HAZARD') && isBlinkOn;
      this.blinkerMatLeft.color.setHex(leftActive ? activeAmber : dimAmber);
    }
    if (this.blinkerMatRight) {
      const rightActive = (sig === 'RIGHT' || sig === 'HAZARD') && isBlinkOn;
      this.blinkerMatRight.color.setHex(rightActive ? activeAmber : dimAmber);
    }

    this.updateTrafficVehicles(telemetry.traffic_vehicles || []);
  }

  updateTrafficVehicles(trafficData) {
    if (!trafficData) return;

    const activeIds = new Set();
    const map = new Map();
    (this.trafficData || []).forEach(v => map.set(v.id, v));

    this.trafficData = trafficData.map(backendV => {
      activeIds.add(backendV.id);
      let v = map.get(backendV.id);
      if (!v) {
        v = { ...backendV };
      } else {
        if (Math.abs(v.z - backendV.z) > 12.0) {
          v.z = backendV.z;
        } else {
          v.z = v.z * 0.25 + backendV.z * 0.75;
        }
        v.x = backendV.x;
        v.speed_kmh = backendV.speed_kmh;
        v.dir = (backendV.dir !== undefined) ? backendV.dir : 1;
        v.type = backendV.type;
      }

      let model = this.trafficObjects.get(v.id);
      if (!model) {
        model = this.createTrafficModel(v.type);
        this.trafficObjects.set(v.id, model);
      }
      model.visible = true;
      return v;
    });

    for (const [id, obj] of this.trafficObjects.entries()) {
      if (!activeIds.has(id)) {
        obj.visible = false;
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000.0);
    this.lastTime = now;

    const speedKmh = this.currentTelemetry.speed_kmh || 0;
    const speedMs = speedKmh / 3.6;

    // Advance road progress distance
    this.distanceTraveled += speedMs * dt;

    // A. Advanced Visual: Update Frenet AI Trajectory Ribbon
    this.updateTrajectoryRibbon(dt);

    // B. Advanced Visual: Update Monsoon Rain Streak Physics
    if (this.rainParticles && this.rainParticles.visible && this.rainVelocities) {
      const rPos = this.rainParticles.geometry.attributes.position;
      const count = rPos.count;
      for (let i = 0; i < count; i++) {
        let ry = rPos.getY(i) - this.rainVelocities[i] * dt;
        let rz = rPos.getZ(i) - speedMs * dt * 0.75;
        if (ry < 0) {
          ry = 22.0 + Math.random() * 6.0;
        }
        if (rz < -35) {
          rz = 45.0 + Math.random() * 12.0;
        }
        rPos.setY(i, ry);
        rPos.setZ(i, rz);
      }
      rPos.needsUpdate = true;
    }

    // C. Advanced Visual: Update Rotating LiDAR Scanner Beam & Concentric Range Rings
    if (this.lidarRingsGroup && this.lidarRingsGroup.visible) {
      if (this.lidarSweep) {
        this.lidarSweep.rotation.z += 6.5 * dt;
      }
      if (this.egoVehicle) {
        this.lidarRingsGroup.position.x = this.egoVehicle.position.x;
        this.lidarRingsGroup.position.y = this.egoVehicle.position.y;
        this.lidarRingsGroup.position.z = this.egoVehicle.position.z;
      }
    }

    // 0. SCROLL PROCEDURAL TEXTURES (PROVIDES REAL GROUND SPEED RUSH BENEATH WHEELS)
    const scrollRate = 0.16;
    if (this.roadTexture) {
      this.roadTexture.offset.y = -(this.distanceTraveled * scrollRate) % 1.0;
    }
    if (this.shoulderTexture) {
      this.shoulderTexture.offset.y = -(this.distanceTraveled * scrollRate) % 1.0;
    }
    if (this.edgeTextures) {
      this.edgeTextures.forEach(et => {
        et.offset.y = -(this.distanceTraveled * scrollRate) % 1.0;
      });
    }

    // Keep Sky Dome centered around camera
    if (this.skyDome && this.camera) {
      this.skyDome.position.copy(this.camera.position);
    }

    // Rotate Wheels based on velocity
    this.wheelRotationAngle += (speedMs / 0.35) * dt;
    this.egoWheels.forEach(w => {
      w.rotation.x = this.wheelRotationAngle;
    });

    // 1. CONTINUOUS EXPONENTIAL SMOOTHING OF LATERAL LANE & STEERING ANGLE
    const targetLaneX = (this.currentTelemetry.vehicle_x !== undefined) ? this.currentTelemetry.vehicle_x : -1.6;
    this.smoothedLaneX = THREE.MathUtils.lerp(this.smoothedLaneX, targetLaneX, 1.0 - Math.exp(-9.0 * dt));

    const targetSteerDeg = this.currentTelemetry.steer_deg || 0;
    this.smoothedSteerDeg = THREE.MathUtils.lerp(this.smoothedSteerDeg, targetSteerDeg, 1.0 - Math.exp(-12.0 * dt));

    // 2. COMPUTE ROAD CURVE AT EGO VEHICLE & TANGENT HEADING YAW
    const roadCurveAtEgo = this.getRoadCurve(0, this.distanceTraveled);
    const lookDelta = 3.2;
    const cAhead = this.getRoadCurve(lookDelta, this.distanceTraveled);
    const roadTangentYaw = Math.atan2(cAhead.x - roadCurveAtEgo.x, lookDelta);

    // Total Car Heading Yaw: aligns with road curvature + autonomous steering offset
    const egoTotalYaw = roadTangentYaw + (this.smoothedSteerDeg * Math.PI / 180) * 0.45;

    // 3. VEHICLE SUSPENSION DYNAMICS: CALM & SENSIBLE BODY ROLL, BRAKE DIVE & ACCEL SQUAT
    const brakePct = (this.currentTelemetry.brake_pct || 0) / 100.0;
    const throttlePct = (this.currentTelemetry.throttle_pct || 0) / 100.0;

    // Gentle body roll into curves (calm, sensible chauffeur physics - no violent tilting)
    const targetRoll = -(this.smoothedSteerDeg * Math.PI / 180) * 0.12 - roadTangentYaw * 0.08;
    this.chassisRoll = THREE.MathUtils.lerp(this.chassisRoll, targetRoll, 1.0 - Math.exp(-6.0 * dt));

    // Suspension pitch: Gentle dive under braking, subtle squat under acceleration
    let targetPitch = 0.0;
    if (brakePct > 0.05) {
      targetPitch = -Math.min(0.035, brakePct * 0.045);
    } else if (throttlePct > 0.05 && speedKmh < 40) {
      targetPitch = Math.min(0.020, throttlePct * 0.025);
    }
    this.chassisPitch = THREE.MathUtils.lerp(this.chassisPitch, targetPitch, 1.0 - Math.exp(-6.0 * dt));

    // Apply pitch, roll and micro-rumble vibration to inner egoBody
    if (this.egoBody) {
      this.egoBody.rotation.z = this.chassisRoll;
      this.egoBody.rotation.x = this.chassisPitch;

      const rumbleFreq = speedKmh > 5 ? 0.035 : 0.008;
      const rumbleAmp = speedKmh > 5 ? 0.006 : 0.0012;
      this.egoBody.position.y = 0.25 + Math.sin(now * rumbleFreq) * rumbleAmp;
    }

    // 4. EGO VEHICLE ROAD CURVATURE TRACKING & VISIBLE ROTATION
    if (this.egoVehicle) {
      this.egoVehicle.position.x = roadCurveAtEgo.x + this.smoothedLaneX;
      this.egoVehicle.position.y = roadCurveAtEgo.y;
      this.egoVehicle.position.z = 0;

      // Active yaw rotation through the zig-zag turns!
      this.egoVehicle.rotation.y = egoTotalYaw;

      // Steer front wheels
      this.egoFrontWheels.forEach(wGroup => {
        wGroup.rotation.y = (this.smoothedSteerDeg * Math.PI / 180) * 0.88;
      });
    }

    // 5. UPDATE WINDING ROAD & SHOULDER CURVES IN REAL TIME
    if (this.roadGeo) this.updateWindingMesh(this.roadGeo);
    if (this.shoulderGeo) this.updateWindingMesh(this.shoulderGeo);
    if (this.edgeGeos) this.edgeGeos.forEach(eg => this.updateWindingMesh(eg));

    // 6. UPDATE ROADSIDE VILLAGE PROPS (Recycle continuously & orient with road)
    if (this.villageProps) {
      for (const prop of this.villageProps) {
        let curZ = (prop.userData.baseZ - (this.distanceTraveled % this.roadLength));
        if (curZ < -35) {
          curZ += this.roadLength;
        }

        const curve = this.getRoadCurve(curZ, this.distanceTraveled);
        prop.position.x = curve.x + prop.userData.relX;
        prop.position.y = curve.y;
        prop.position.z = curZ;

        // Align props with road tangent heading so huts and dhabas face the road organically
        if (prop.userData.type === 'hut' || prop.userData.type === 'dhaba' || prop.userData.type === 'well' || prop.userData.type === 'cart') {
          const pAhead = this.getRoadCurve(curZ + 2.0, this.distanceTraveled);
          const propYaw = Math.atan2(pAhead.x - curve.x, 2.0);
          prop.rotation.y = propYaw + (prop.userData.baseYaw || 0);
        } else if (prop.userData.type === 'tree') {
          prop.rotation.z = Math.sin(now * 0.0018 + curZ * 0.08) * 0.035;
        }
      }
    }

    // 7. UPDATE WHEEL DUST PARTICLES
    if (this.dustParticles && this.egoVehicle) {
      const positions = this.dustParticles.geometry.attributes.position.array;
      const count = positions.length / 3;
      const egoX = this.egoVehicle.position.x;

      for (let i = 0; i < count; i++) {
        positions[i * 3 + 2] -= (speedMs * 0.8 + 2.0) * dt;
        positions[i * 3 + 1] += 0.25 * dt;

        if (positions[i * 3 + 2] < -12.0) {
          positions[i * 3 + 0] = egoX + (Math.random() - 0.5) * 1.6;
          positions[i * 3 + 1] = 0.15 + Math.random() * 0.25;
          positions[i * 3 + 2] = -1.8;
        }
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 8. CONTINUOUS INDEPENDENT TRAFFIC VEHICLE DYNAMICS (60 FPS)
    if (this.trafficData) {
      for (const v of this.trafficData) {
        const dir = (v.dir !== undefined) ? v.dir : 1;
        const vSpeedKmh = v.speed_kmh || 0;
        const vSpeedMs = vSpeedKmh / 3.6;

        const relSpeedMs = (dir * vSpeedMs) - speedMs;
        v.z += relSpeedMs * dt;

        // Smooth wrap-around
        if (dir === -1 && v.z < -45.0) {
          v.z += 380.0;
        } else if (dir === 1 && v.z > 360.0) {
          v.z -= 410.0;
        }
      }

      // 8b. PAIRWISE ZERO-INTERSECTION ANTI-CLIPPING & ANTI-MOUNTING PASS
      const VEH_SPECS = {
        ego:           { len: 4.4, width: 2.0 },
        tractor:       { len: 7.6, width: 2.4 },
        truck:         { len: 8.2, width: 2.5 },
        auto_rickshaw: { len: 3.4, width: 1.6 },
        motorcycle:    { len: 2.2, width: 0.9 },
        cattle:        { len: 2.6, width: 1.1 }
      };

      const entities = [];
      entities.push({
        isEgo: true,
        id: 'ego',
        type: 'ego',
        x: this.smoothedLaneX,
        z: 0.0,
        dir: 1,
        speed_kmh: speedKmh,
        spec: VEH_SPECS.ego
      });

      for (const v of this.trafficData) {
        entities.push({
          isEgo: false,
          ref: v,
          id: v.id,
          type: v.type,
          x: v.x,
          z: v.z,
          dir: (v.dir !== undefined) ? v.dir : 1,
          speed_kmh: v.speed_kmh || 0,
          spec: VEH_SPECS[v.type] || VEH_SPECS.auto_rickshaw
        });
      }

      const eCount = entities.length;
      for (let i = 0; i < eCount; i++) {
        const eA = entities[i];
        for (let j = i + 1; j < eCount; j++) {
          const eB = entities[j];

          const touchZ = (eA.spec.len + eB.spec.len) * 0.5 + 1.2;
          const touchX = (eA.spec.width + eB.spec.width) * 0.5 + 0.35;

          const dz = Math.abs(eA.z - eB.z);
          const dx = Math.abs(eA.x - eB.x);

          // Hard AABB Overlap Intersection Check
          if (dz < touchZ && dx < touchX) {
            const penX = touchX - dx;
            const penZ = touchZ - dz;

            // Determine primary collision axis (longitudinal vs lateral)
            if (penZ < penX * 1.4) {
              // 1. Longitudinal Separation (Front-to-Rear)
              if (eA.isEgo) {
                // eB is traffic: push eB away from Ego
                if (eB.z >= 0) eB.z = Math.max(eB.z, touchZ + 0.25);
                else eB.z = Math.min(eB.z, -touchZ - 0.25);
              } else if (eB.isEgo) {
                // eA is traffic: push eA away from Ego
                if (eA.z >= 0) eA.z = Math.max(eA.z, touchZ + 0.25);
                else eA.z = Math.min(eA.z, -touchZ - 0.25);
              } else {
                // Traffic vs Traffic
                if (eA.dir === eB.dir) {
                  if (eA.dir === 1) {
                    if (eA.z > eB.z) eB.z = eA.z - touchZ - 0.2;
                    else eA.z = eB.z - touchZ - 0.2;
                  } else if (eA.dir === -1) {
                    if (eA.z < eB.z) eB.z = eA.z + touchZ + 0.2;
                    else eA.z = eB.z + touchZ + 0.2;
                  }
                } else {
                  // Opposite direction head-on: push apart laterally immediately
                  if (eA.x >= eB.x) {
                    eA.x += penX * 0.6;
                    eB.x -= penX * 0.6;
                  } else {
                    eA.x -= penX * 0.6;
                    eB.x += penX * 0.6;
                  }
                }
              }
            } else {
              // 2. Lateral Separation (Sideswipe / Side-by-Side)
              if (eA.isEgo) {
                if (eB.x >= eA.x) eB.x = eA.x + touchX + 0.15;
                else eB.x = eA.x - touchX - 0.15;
              } else if (eB.isEgo) {
                if (eA.x >= eB.x) eA.x = eB.x + touchX + 0.15;
                else eA.x = eB.x - touchX - 0.15;
              } else {
                if (eA.x >= eB.x) {
                  eA.x += penX * 0.6;
                  eB.x -= penX * 0.6;
                } else {
                  eA.x -= penX * 0.6;
                  eB.x += penX * 0.6;
                }
              }
            }
          }
        }
      }

      for (const ent of entities) {
        if (!ent.isEgo && ent.ref) {
          ent.ref.x = ent.x;
          ent.ref.z = ent.z;
        }
      }

      // 8c. RENDER 3D TRAFFIC MESHES & ROTATE THROUGH ZIG-ZAGS
      for (const v of this.trafficData) {
        const dir = (v.dir !== undefined) ? v.dir : 1;
        const vSpeedKmh = v.speed_kmh || 0;
        const vSpeedMs = vSpeedKmh / 3.6;

        const model = this.trafficObjects.get(v.id);
        if (!model) continue;

        // Snap to winding road curve at this exact Z position
        const curve = this.getRoadCurve(v.z, this.distanceTraveled);
        model.position.set(curve.x + v.x, curve.y, v.z);

        // Update 3D Holographic Perception Brackets & Tags
        this.updateTargetBadge(model, v);

        // Align heading along road tangent of zig-zag curve
        const lookDelta = 3.5;
        const cAhead = this.getRoadCurve(v.z + (dir >= 0 ? lookDelta : -lookDelta), this.distanceTraveled);
        const roadTangentYaw = Math.atan2(cAhead.x - curve.x, lookDelta);

        if (dir === -1) {
          model.rotation.y = Math.PI - roadTangentYaw;
        } else {
          model.rotation.y = roadTangentYaw;
        }

        // Independent wheel rotation based on THIS vehicle's speed
        if (v.type !== 'cattle') {
          if (model.userData.wheelAngle === undefined) model.userData.wheelAngle = 0;
          const wheelRadius = (v.type === 'tractor' ? 0.68 : 0.38);
          model.userData.wheelAngle += (vSpeedMs / wheelRadius) * dt;
          const wheels = model.userData.wheels || [];
          wheels.forEach(w => {
            w.rotation.x = model.userData.wheelAngle;
          });

          // Tractor diesel exhaust puff pulsing animation
          if (v.type === 'tractor' && model.userData.smokePuff) {
            const puff = model.userData.smokePuff;
            const pulse = (Math.sin(now * 0.015 + v.id * 3) + 1.0) * 0.5;
            puff.scale.set(0.8 + pulse * 0.8, 0.8 + pulse * 1.2, 0.8 + pulse * 0.8);
            puff.material.opacity = 0.18 + (1.0 - pulse) * 0.30;
            puff.position.y = 2.7 + pulse * 0.35;
          }
        } else {
          const head = model.userData.head;
          if (head) {
            head.rotation.x = Math.sin(now * 0.002 + v.id) * 0.08;
            head.rotation.y = Math.sin(now * 0.0015 + v.id) * 0.12;
          }
          const tail = model.userData.tail;
          if (tail) {
            tail.rotation.z = Math.sin(now * 0.0035 + v.id) * 0.35;
          }
        }
      }
    }

    // 9. DYNAMIC CHASE CAMERA WITH SMOOTH, STEADY CINEMATIC INERTIA
    if (this.camera && this.egoVehicle) {
      if (this.cameraView === 'follow') {
        // Smoothly trail the camera yaw behind the car's heading (gentle, steady follow - no jerky swinging)
        this.camSmoothedYaw = THREE.MathUtils.lerp(
          this.camSmoothedYaw,
          egoTotalYaw,
          1.0 - Math.exp(-4.5 * dt)
        );

        const camDist = 8.8;
        const camHeight = 3.9 + roadCurveAtEgo.y;

        // Camera sits BEHIND car along smoothed yaw direction with subtle, natural lateral lead
        const targetCamX = (roadCurveAtEgo.x + this.smoothedLaneX) - Math.sin(this.camSmoothedYaw) * camDist * 0.72;
        const targetCamZ = -Math.cos(this.camSmoothedYaw) * camDist;
        const targetCamY = camHeight;

        this.camSmoothedPos.x = THREE.MathUtils.lerp(this.camSmoothedPos.x, targetCamX, 1.0 - Math.exp(-7.0 * dt));
        this.camSmoothedPos.y = THREE.MathUtils.lerp(this.camSmoothedPos.y, targetCamY, 1.0 - Math.exp(-10.0 * dt));
        this.camSmoothedPos.z = THREE.MathUtils.lerp(this.camSmoothedPos.z, targetCamZ, 1.0 - Math.exp(-7.0 * dt));
        this.camera.position.copy(this.camSmoothedPos);

        // Lookahead point: tracks road curve apex 24m ahead
        const lookAheadZ = 24.0;
        const roadLookahead = this.getRoadCurve(lookAheadZ, this.distanceTraveled);
        const targetLookX = roadLookahead.x + this.smoothedLaneX * 0.35;
        const targetLookY = 1.15 + roadLookahead.y;
        const targetLookZ = lookAheadZ;

        this.camSmoothedLook.x = THREE.MathUtils.lerp(this.camSmoothedLook.x, targetLookX, 1.0 - Math.exp(-8.5 * dt));
        this.camSmoothedLook.y = THREE.MathUtils.lerp(this.camSmoothedLook.y, targetLookY, 1.0 - Math.exp(-8.5 * dt));
        this.camSmoothedLook.z = THREE.MathUtils.lerp(this.camSmoothedLook.z, targetLookZ, 1.0 - Math.exp(-8.5 * dt));
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.camSmoothedLook);

        // Dynamic Speed FOV
        const targetFov = 51.0 + (speedKmh / 50.0) * 5.0;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1.0 - Math.exp(-4.0 * dt));
        this.camera.updateProjectionMatrix();

      } else if (this.cameraView === 'hood') {
        const targetCamX = roadCurveAtEgo.x + this.smoothedLaneX;
        const targetCamY = 1.35 + roadCurveAtEgo.y;
        const targetCamZ = 0.8;

        this.camera.position.set(targetCamX, targetCamY, targetCamZ);
        const roadLookahead = this.getRoadCurve(28, this.distanceTraveled);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(roadLookahead.x + this.smoothedLaneX * 0.2, 1.2 + roadLookahead.y, 28.0);

      } else if (this.cameraView === 'topdown') {
        this.camera.position.set(roadCurveAtEgo.x + this.smoothedLaneX * 0.5, 38 + roadCurveAtEgo.y, 18);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(roadCurveAtEgo.x, 0, 22);

      } else if (this.cameraView === 'drone') {
        if (this.droneAngle === undefined) this.droneAngle = 0;
        this.droneAngle += 0.35 * dt;

        const droneDist = 12.0;
        const droneHeight = 4.8 + Math.sin(this.droneAngle * 1.4) * 1.6;
        const targetCamX = roadCurveAtEgo.x + this.smoothedLaneX + Math.sin(this.droneAngle) * droneDist;
        const targetCamZ = Math.cos(this.droneAngle) * droneDist;
        const targetCamY = droneHeight + roadCurveAtEgo.y;

        this.camSmoothedPos.x = THREE.MathUtils.lerp(this.camSmoothedPos.x, targetCamX, 1.0 - Math.exp(-6.0 * dt));
        this.camSmoothedPos.y = THREE.MathUtils.lerp(this.camSmoothedPos.y, targetCamY, 1.0 - Math.exp(-6.0 * dt));
        this.camSmoothedPos.z = THREE.MathUtils.lerp(this.camSmoothedPos.z, targetCamZ, 1.0 - Math.exp(-6.0 * dt));
        this.camera.position.copy(this.camSmoothedPos);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(roadCurveAtEgo.x + this.smoothedLaneX, 1.2 + roadCurveAtEgo.y, 4.0);

      } else if (this.cameraView === 'orbit') {
        const camX = roadCurveAtEgo.x + this.smoothedLaneX - Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;
        const camZ = -Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;
        const camY = Math.sin(this.orbitPitch) * this.orbitDist + roadCurveAtEgo.y;

        this.camera.position.set(camX, camY, camZ);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(roadCurveAtEgo.x + this.smoothedLaneX, 1.2 + roadCurveAtEgo.y, 1.0);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateWindingMesh(geo) {
    const pos = geo.attributes.position;
    const origX = geo.userData.origX;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const z = pos.getZ(i);
      const curve = this.getRoadCurve(z, this.distanceTraveled);

      pos.setX(i, curve.x + origX[i]);
      pos.setY(i, curve.y);
    }
    pos.needsUpdate = true;
  }

  setCameraView(viewMode) {
    this.cameraView = viewMode;
    if (!this.camera) return;
    this.camera.up.set(0, 1, 0);

    if (viewMode === 'follow') {
      this.camera.fov = 52.0;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(0, 4.0, -8.8);
      this.camera.lookAt(0, 1.2, 24.0);
    } else if (viewMode === 'hood') {
      this.camera.fov = 56.0;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(0, 1.35, 0.8);
      this.camera.lookAt(0, 1.2, 28.0);
    } else if (viewMode === 'topdown') {
      this.camera.fov = 45.0;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(0, 38, 18);
      this.camera.lookAt(0, 0, 22);
    } else if (viewMode === 'drone') {
      this.camera.fov = 52.0;
      this.camera.updateProjectionMatrix();
    } else if (viewMode === 'orbit') {
      this.camera.fov = 50.0;
      this.camera.updateProjectionMatrix();
    }
  }

  reparent(targetContainer) {
    if (!targetContainer || !this.renderer) return;
    if (this.container !== targetContainer) {
      targetContainer.innerHTML = '';
      targetContainer.appendChild(this.renderer.domElement);
      this.container = targetContainer;
    }
    setTimeout(() => this.onResize(), 30);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
