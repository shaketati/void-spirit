// Simple Noise Generator
class SimpleNoise {
    constructor() {
        this.perm = new Uint8Array(512);
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
        }
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        const A = this.perm[X] + Y, AA = this.perm[A] + Z, AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y, BA = this.perm[B] + Z, BB = this.perm[B + 1] + Z;

        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
            this.grad(this.perm[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.perm[AB], x, y - 1, z),
                this.grad(this.perm[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1),
                this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1),
                    this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))));
    }
}

const noiseGen = new SimpleNoise();

// Advanced Texture Generator
function createPlanetTexture(type, color1, color2) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const c1 = color1;
    const c2 = color2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;

            // Normalize coordinates
            const nx = x / size;
            const ny = y / size;

            let n = 0;

            if (type === 'gas') {
                // Gas Giant: Banded structure with turbulence
                // Base bands
                let value = Math.sin(ny * 20 + noiseGen.noise(nx * 5, ny * 5, 0) * 2);
                // Add turbulence
                value += noiseGen.noise(nx * 10, ny * 20, 1) * 0.5;
                n = (value + 1) / 2; // Normalize to 0-1

            } else if (type === 'rocky') {
                // Rocky: Fractal noise
                let scale = 5;
                let amplitude = 1;
                let total = 0;
                let maxVal = 0;

                for (let oct = 0; oct < 5; oct++) {
                    total += noiseGen.noise(nx * scale, ny * scale, 0) * amplitude;
                    maxVal += amplitude;
                    scale *= 2;
                    amplitude *= 0.5;
                }
                n = (total / maxVal + 1) / 2;

            } else if (type === 'sun') {
                // Sun: Turbulent plasma
                let scale = 8;
                n = noiseGen.noise(nx * scale, ny * scale, Date.now() * 0.0001); // Time based? No, static for texture
                n = Math.abs(n); // Ridged noise look
                n = 1 - n;
                n = Math.pow(n, 3); // Sharpen
            } else if (type === 'ice') {
                // Ice Giant: Smooth with subtle bands
                n = noiseGen.noise(nx * 2, ny * 10, 0);
                n = (n + 1) / 2;
            }

            // Mix colors based on noise value
            const r = c1.r * (1 - n) + c2.r * n;
            const g = c1.g * (1 - n) + c2.g * n;
            const b = c1.b * (1 - n) + c2.b * n;

            data[i] = r * 255;
            data[i + 1] = g * 255;
            data[i + 2] = b * 255;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // Post-processing for specific types
    if (type === 'rocky') {
        // Add craters? (Simple circles)
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let k = 0; k < 20; k++) {
            const cx = Math.random() * size;
            const cy = Math.random() * size;
            const cr = Math.random() * 30 + 5;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Planet Class
class Planet {
    constructor(scene, name, size, color, distance, speed, type = 'rocky') {
        this.scene = scene;
        this.name = name;
        this.distance = distance;
        this.speed = speed;
        this.angle = Math.random() * Math.PI * 2;
        this.mesh = null;
        this.orbitLine = null;
        this.type = type;

        this.init(size, color);
    }

    init(size, color) {
        // Generate Texture
        const baseColor = new THREE.Color(color);
        const secondaryColor = baseColor.clone().offsetHSL(0, 0, this.type === 'gas' ? 0.1 : -0.2);
        const texture = createPlanetTexture(this.type, baseColor, secondaryColor);

        // Planet Mesh
        const geometry = new THREE.SphereGeometry(size, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: this.type === 'gas' ? 0.4 : 0.8,
            metalness: 0.1,
            emissive: this.name === 'sun' ? color : 0x000000,
            emissiveIntensity: this.name === 'sun' ? 0.5 : 0,
            emissiveMap: this.name === 'sun' ? texture : null
        });

        // Bump map for rocky planets
        if (this.type === 'rocky') {
            material.bumpMap = texture;
            material.bumpScale = 0.05;
        }

        this.mesh = new THREE.Mesh(geometry, material);

        // Atmosphere for Earth and Venus
        if (this.name === 'earth' || this.name === 'venus') {
            const atmoGeo = new THREE.SphereGeometry(size * 1.05, 64, 64);
            const atmoMat = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.2,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            });
            const atmo = new THREE.Mesh(atmoGeo, atmoMat);
            this.mesh.add(atmo);
        }

        // Add specific features
        if (this.name === 'saturn') {
            const ringGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x888888,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2.5;
            this.mesh.add(ring);
        }

        this.scene.add(this.mesh);

        // Orbit Line
        if (this.distance > 0) {
            const points = [];
            const segments = 128;
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(theta) * this.distance, 0, Math.sin(theta) * this.distance));
            }

            const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
            const orbitMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15
            });

            this.orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
            this.scene.add(this.orbitLine);
        }
    }

    update() {
        if (this.distance > 0) {
            this.angle += this.speed * 0.005;
            this.mesh.position.x = Math.cos(this.angle) * this.distance;
            this.mesh.position.z = Math.sin(this.angle) * this.distance;
        }
        this.mesh.rotation.y += 0.01;
    }
}

// SolarSystem Manager
class SolarSystem {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.planets = {};
        this.focusedPlanet = null;
        this.previousPlanetPosition = new THREE.Vector3();

        this.initPlanets();
    }

    initPlanets() {
        // Sun
        const sun = new Planet(this.scene, 'sun', 10, 0xffaa00, 0, 0, 'sun');
        sun.mesh.material.emissiveIntensity = 1;
        this.planets['sun'] = sun;

        const sunLight = new THREE.PointLight(0xffffff, 2, 300);
        this.scene.add(sunLight);
        const ambientLight = new THREE.AmbientLight(0x404040, 0.2); // Reduced ambient to show off emissive
        this.scene.add(ambientLight);

        this.planets['mercury'] = new Planet(this.scene, 'mercury', 0.8, 0xaaaaaa, 15, 4.0, 'rocky');
        this.planets['venus'] = new Planet(this.scene, 'venus', 1.5, 0xe3bb76, 22, 3.0, 'rocky');
        this.planets['earth'] = new Planet(this.scene, 'earth', 1.6, 0x2233ff, 32, 2.5, 'rocky');
        this.planets['mars'] = new Planet(this.scene, 'mars', 1.0, 0xff3300, 42, 2.0, 'rocky');
        this.planets['jupiter'] = new Planet(this.scene, 'jupiter', 5.0, 0xd8ca9d, 65, 1.0, 'gas');
        this.planets['saturn'] = new Planet(this.scene, 'saturn', 4.0, 0xe3e3bd, 90, 0.8, 'gas');
        this.planets['uranus'] = new Planet(this.scene, 'uranus', 2.5, 0x99ffff, 115, 0.6, 'ice');
        this.planets['neptune'] = new Planet(this.scene, 'neptune', 2.4, 0x3333ff, 135, 0.5, 'ice');
    }

    update() {
        // Update all planets first
        Object.values(this.planets).forEach(planet => planet.update());

        // Camera tracking logic
        if (this.focusedPlanet) {
            const currentPos = this.focusedPlanet.mesh.position;

            // Calculate how much the planet moved since last frame
            const delta = currentPos.clone().sub(this.previousPlanetPosition);

            // Move camera by the same amount to maintain relative position
            this.camera.position.add(delta);

            // Update controls target to the new planet position
            this.controls.target.copy(currentPos);

            // Store current position for next frame
            this.previousPlanetPosition.copy(currentPos);
        }
    }

    focusOn(planetName) {
        const planet = this.planets[planetName];
        if (!planet) return;

        this.focusedPlanet = planet;
        this.previousPlanetPosition.copy(planet.mesh.position);

        const offset = planet.name === 'sun' ? 40 : planet.name === 'saturn' ? 15 : 8;

        // Calculate a nice viewing angle (offset from planet)
        // We use the planet's current position to determine a "front" facing view relative to the sun if possible,
        // or just a fixed offset. Let's use a fixed offset relative to the planet for simplicity of transition.
        const targetPos = planet.mesh.position.clone();
        const cameraOffset = new THREE.Vector3(0, offset * 0.5, offset);
        const newCameraPos = targetPos.clone().add(cameraOffset);

        gsap.to(this.camera.position, {
            duration: 1.5,
            x: newCameraPos.x,
            y: newCameraPos.y,
            z: newCameraPos.z,
            onUpdate: () => {
                this.controls.target.copy(planet.mesh.position);
                this.controls.update();
            },
            onComplete: () => {
                // Ensure we have the latest position after animation for the tracking loop
                this.previousPlanetPosition.copy(planet.mesh.position);
            }
        });
    }
}

// Particle System Class
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particleCount = 2000;
        this.particles = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetSpeed = 0.05;
        this.speed = 0.05;

        this.init();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);

        const color1 = new THREE.Color(0xa855f7);
        const color2 = new THREE.Color(0x6366f1);
        const color3 = new THREE.Color(0xffffff);

        for (let i = 0; i < this.particleCount; i++) {
            const r = 300 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            sizes[i] = Math.random() * 2;

            const mixedColor = Math.random() > 0.8 ? color3 : (Math.random() > 0.5 ? color1 : color2);
            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    onMouseMove(event) {
        this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    update() {
        if (!this.particles) return;
        this.particles.rotation.y += 0.0002;
    }
}

// Scene Manager Class
class SceneManager {
    constructor(container) {
        this.container = container;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.initScene();
        this.initRenderer();
        this.initCamera();
        this.initControls();
        this.initParticles();
        this.initSolarSystem();
        this.addEvents();

        this.animate();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050505, 0.001);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 2000);
        this.camera.position.set(0, 50, 100);
        this.camera.lookAt(0, 0, 0);
    }

    initControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 500;
        this.controls.minDistance = 5;
    }

    initParticles() {
        this.particleSystem = new ParticleSystem(this.scene);
    }

    initSolarSystem() {
        this.solarSystem = new SolarSystem(this.scene, this.camera, this.controls);
    }

    addEvents() {
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('mousemove', (e) => this.particleSystem.onMouseMove(e));

        // Planet navigation
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planetName = e.target.dataset.planet;
                this.solarSystem.focusOn(planetName);
                this.updateInfoPanel(planetName);

                // Update UI active state
                document.querySelectorAll('.planet-btn').forEach(b => b.classList.remove('text-void-accent'));
                e.target.classList.add('text-void-accent');

                // Hide main title
                this.hideMainUI();
            });
        });

        // Hide main title on interaction
        document.getElementById('explore-btn').addEventListener('click', () => {
            this.hideMainUI();
            this.solarSystem.focusOn('sun');
            this.updateInfoPanel('sun');
        });
    }

    hideMainUI() {
        const mainTitle = document.querySelector('main');
        if (mainTitle && mainTitle.style.opacity !== '0') {
            gsap.to(mainTitle, {
                opacity: 0, duration: 1, onComplete: () => {
                    mainTitle.style.display = 'none';
                }
            });
        }
    }

    updateInfoPanel(planetName) {
        const infoPanel = document.getElementById('planet-info');
        const data = planetData[planetName];

        if (!data) return;

        // Fade out, update, fade in
        gsap.to(infoPanel, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                document.getElementById('info-name').textContent = data.name;
                document.getElementById('info-desc').textContent = data.desc;
                document.getElementById('info-type').textContent = data.type;
                document.getElementById('info-diameter').textContent = data.diameter;
                document.getElementById('info-orbit').textContent = data.orbit;
                document.getElementById('info-temp').textContent = data.temp;

                gsap.to(infoPanel, { opacity: 1, duration: 0.5, delay: 0.2 });
            }
        });
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        this.controls.update();
        this.particleSystem.update();
        this.solarSystem.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const sceneManager = new SceneManager(container);
});

const planetData = {
    sun: {
        name: "太陽 (Sun)",
        desc: "太陽系の中心にある恒星。巨大な熱いプラズマの球体であり、中心核での核融合反応によって白熱しています。",
        type: "恒星",
        diameter: "1,392,700 km",
        orbit: "N/A",
        temp: "5,505°C"
    },
    mercury: {
        name: "水星 (Mercury)",
        desc: "太陽系で最も小さく、太陽に最も近い惑星です。太陽の周りをわずか88日で一周します。",
        type: "岩石惑星",
        diameter: "4,879 km",
        orbit: "88日",
        temp: "167°C"
    },
    venus: {
        name: "金星 (Venus)",
        desc: "太陽から2番目の惑星。二酸化炭素を主成分とする非常に厚い大気を持ち、温室効果により高温になっています。",
        type: "岩石惑星",
        diameter: "12,104 km",
        orbit: "225日",
        temp: "464°C"
    },
    earth: {
        name: "地球 (Earth)",
        desc: "太陽から3番目の惑星であり、生命が存在することが知られている唯一の天体です。表面の約7割は海で覆われています。",
        type: "岩石惑星",
        diameter: "12,742 km",
        orbit: "365.25日",
        temp: "15°C"
    },
    mars: {
        name: "火星 (Mars)",
        desc: "太陽から4番目の惑星。「赤い惑星」として知られ、酸化鉄（赤さび）を含む地表が特徴です。",
        type: "岩石惑星",
        diameter: "6,779 km",
        orbit: "687日",
        temp: "-65°C"
    },
    jupiter: {
        name: "木星 (Jupiter)",
        desc: "太陽系最大の惑星。巨大なガス惑星であり、その質量は他のすべての惑星を合わせたものの2.5倍以上あります。",
        type: "ガス惑星",
        diameter: "139,820 km",
        orbit: "12年",
        temp: "-110°C"
    },
    saturn: {
        name: "土星 (Saturn)",
        desc: "太陽系で2番目に大きな惑星。美しい環（リング）を持つことで有名で、主に水素とヘリウムで構成されています。",
        type: "ガス惑星",
        diameter: "116,460 km",
        orbit: "29年",
        temp: "-140°C"
    },
    uranus: {
        name: "天王星 (Uranus)",
        desc: "太陽から7番目の惑星。青緑色に見えるのは大気中のメタンが赤色光を吸収するためです。自転軸が横倒しになっています。",
        type: "巨大氷惑星",
        diameter: "50,724 km",
        orbit: "84年",
        temp: "-195°C"
    },
    neptune: {
        name: "海王星 (Neptune)",
        desc: "太陽系で最も外側を公転する惑星。鮮やかな青色をしており、非常に強い風が吹いています。",
        type: "巨大氷惑星",
        diameter: "49,244 km",
        orbit: "165年",
        temp: "-200°C"
    }
};
