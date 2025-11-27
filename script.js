// ============================================
// Gesture Particle 3D
// Real-time interactive 3D particle system
// using Three.js and MediaPipe Hands
// ============================================

// ============================================
// Configuration
// ============================================
const CONFIG = {
    particleCount: 4000,
    particleSize: 0.05,
    shapeRadius: 5,
    cubeSize: 8,
    lerpSpeed: 0.02,
    dispersionMultiplier: 15,
    pinchThreshold: 0.1,
    openThreshold: 0.25
};

// ============================================
// Global Variables
// ============================================
let scene, camera, renderer;
let particles, particleGeometry, particleMaterial;
let currentPositions, targetPositions;
let sphereTargets, cubeTargets;
let dispersionFactor = 0;
let handDetected = false;

// GUI settings
const settings = {
    color: '#00ffff',
    shape: 'Sphere'
};

// ============================================
// Three.js Setup
// ============================================
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 15;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Particle System
// ============================================
function initParticles() {
    // Create geometry
    particleGeometry = new THREE.BufferGeometry();
    
    // Initialize position arrays
    currentPositions = new Float32Array(CONFIG.particleCount * 3);
    targetPositions = new Float32Array(CONFIG.particleCount * 3);
    sphereTargets = new Float32Array(CONFIG.particleCount * 3);
    cubeTargets = new Float32Array(CONFIG.particleCount * 3);

    // Generate target positions for both shapes
    generateSphereTargets();
    generateCubeTargets();

    // Set initial positions to sphere targets
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        currentPositions[i] = sphereTargets[i];
        targetPositions[i] = sphereTargets[i];
    }

    // Set position attribute
    particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(currentPositions, 3)
    );

    // Create material
    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(settings.color),
        size: CONFIG.particleSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
    });

    // Create Points mesh
    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function generateSphereTargets() {
    for (let i = 0; i < CONFIG.particleCount; i++) {
        // Random points on sphere surface using spherical coordinates
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        
        const x = CONFIG.shapeRadius * Math.sin(phi) * Math.cos(theta);
        const y = CONFIG.shapeRadius * Math.sin(phi) * Math.sin(theta);
        const z = CONFIG.shapeRadius * Math.cos(phi);

        sphereTargets[i * 3] = x;
        sphereTargets[i * 3 + 1] = y;
        sphereTargets[i * 3 + 2] = z;
    }
}

function generateCubeTargets() {
    for (let i = 0; i < CONFIG.particleCount; i++) {
        // Random points inside cube volume
        const x = (Math.random() - 0.5) * CONFIG.cubeSize;
        const y = (Math.random() - 0.5) * CONFIG.cubeSize;
        const z = (Math.random() - 0.5) * CONFIG.cubeSize;

        cubeTargets[i * 3] = x;
        cubeTargets[i * 3 + 1] = y;
        cubeTargets[i * 3 + 2] = z;
    }
}

function updateTargetShape() {
    const source = settings.shape === 'Sphere' ? sphereTargets : cubeTargets;
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        targetPositions[i] = source[i];
    }
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    requestAnimationFrame(animate);

    // Update particle positions with interpolation
    updateParticles();

    // Slowly rotate the particle system
    if (particles) {
        particles.rotation.y += 0.002;
    }

    renderer.render(scene, camera);
}

function updateParticles() {
    if (!particleGeometry) return;

    const positions = particleGeometry.attributes.position.array;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;

        // Calculate dispersed target (expanded from center)
        const targetX = targetPositions[i3];
        const targetY = targetPositions[i3 + 1];
        const targetZ = targetPositions[i3 + 2];

        // Calculate direction from center
        const length = Math.sqrt(targetX * targetX + targetY * targetY + targetZ * targetZ);
        const normalizedX = length > 0 ? targetX / length : 0;
        const normalizedY = length > 0 ? targetY / length : 0;
        const normalizedZ = length > 0 ? targetZ / length : 0;

        // Apply dispersion factor
        const dispersedX = targetX + normalizedX * dispersionFactor * CONFIG.dispersionMultiplier;
        const dispersedY = targetY + normalizedY * dispersionFactor * CONFIG.dispersionMultiplier;
        const dispersedZ = targetZ + normalizedZ * dispersionFactor * CONFIG.dispersionMultiplier;

        // Lerp current position towards dispersed target
        positions[i3] += (dispersedX - positions[i3]) * CONFIG.lerpSpeed;
        positions[i3 + 1] += (dispersedY - positions[i3 + 1]) * CONFIG.lerpSpeed;
        positions[i3 + 2] += (dispersedZ - positions[i3 + 2]) * CONFIG.lerpSpeed;
    }

    particleGeometry.attributes.position.needsUpdate = true;
}

// ============================================
// MediaPipe Hands Integration
// ============================================
function initMediaPipe() {
    const videoElement = document.querySelector('.input_video');

    // Initialize Hands
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    // Initialize Camera
    const cameraInstance = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    cameraInstance.start();
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];

        // Get thumb tip (index 4) and index finger tip (index 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // Calculate Euclidean distance between thumb and index finger
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );

        // Map distance to dispersion factor
        // Pinched (small distance) = tight shape (dispersion = 0)
        // Open (large distance) = scattered (dispersion = 1)
        dispersionFactor = mapRange(
            distance,
            CONFIG.pinchThreshold,
            CONFIG.openThreshold,
            0,
            1
        );

        // Clamp dispersion factor
        dispersionFactor = Math.max(0, Math.min(1, dispersionFactor));
    } else {
        handDetected = false;
        // Gradually return to default state when no hand detected
        dispersionFactor *= 0.95;
    }
}

// Helper function to map a value from one range to another
function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// ============================================
// lil-gui Controls
// ============================================
function initGUI() {
    const gui = new lil.GUI();

    // Color picker
    gui.addColor(settings, 'color')
        .name('Particle Color')
        .onChange((value) => {
            if (particleMaterial) {
                particleMaterial.color.set(value);
            }
        });

    // Shape selector
    gui.add(settings, 'shape', ['Sphere', 'Cube'])
        .name('Shape')
        .onChange(() => {
            updateTargetShape();
        });
}

// ============================================
// Initialize Application
// ============================================
function init() {
    initThreeJS();
    initParticles();
    initGUI();
    initMediaPipe();
    animate();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
