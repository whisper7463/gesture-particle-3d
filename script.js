// ============================================
// 3D Particle System with Hand Gesture Control
// ============================================

// Configuration
const PARTICLE_COUNT = 5000;
const SPHERE_RADIUS = 2;
const CUBE_SIZE = 3;
const LERP_SPEED = 0.05;
const MAX_DISPERSION = 5;

// Global variables
let scene, camera, renderer;
let particles, particleMaterial;
let currentPositions, targetPositions, originalPositions;
let expansionFactor = 0;
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
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Create particle system
    createParticleSystem();

    // Start animation loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Particle System
// ============================================

function createParticleSystem() {
    // Create geometry
    const geometry = new THREE.BufferGeometry();

    // Initialize position arrays
    currentPositions = new Float32Array(PARTICLE_COUNT * 3);
    targetPositions = new Float32Array(PARTICLE_COUNT * 3);
    originalPositions = new Float32Array(PARTICLE_COUNT * 3);

    // Generate initial sphere positions
    generateSpherePositions(targetPositions);
    
    // Copy target to current and original
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        currentPositions[i] = targetPositions[i];
        originalPositions[i] = targetPositions[i];
    }

    // Set geometry attribute
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    // Create material
    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(settings.color),
        size: 0.03,
        sizeAttenuation: true
    });

    // Create points mesh
    particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);
}

function generateSpherePositions(positionsArray) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Use spherical coordinates for even distribution
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;

        const x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = SPHERE_RADIUS * Math.cos(phi);

        positionsArray[i * 3] = x;
        positionsArray[i * 3 + 1] = y;
        positionsArray[i * 3 + 2] = z;
    }
}

function generateCubePositions(positionsArray) {
    const halfSize = CUBE_SIZE / 2;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribute particles on cube surface
        const face = Math.floor(Math.random() * 6);
        let x, y, z;

        switch (face) {
            case 0: // Front face
                x = (Math.random() - 0.5) * CUBE_SIZE;
                y = (Math.random() - 0.5) * CUBE_SIZE;
                z = halfSize;
                break;
            case 1: // Back face
                x = (Math.random() - 0.5) * CUBE_SIZE;
                y = (Math.random() - 0.5) * CUBE_SIZE;
                z = -halfSize;
                break;
            case 2: // Top face
                x = (Math.random() - 0.5) * CUBE_SIZE;
                y = halfSize;
                z = (Math.random() - 0.5) * CUBE_SIZE;
                break;
            case 3: // Bottom face
                x = (Math.random() - 0.5) * CUBE_SIZE;
                y = -halfSize;
                z = (Math.random() - 0.5) * CUBE_SIZE;
                break;
            case 4: // Right face
                x = halfSize;
                y = (Math.random() - 0.5) * CUBE_SIZE;
                z = (Math.random() - 0.5) * CUBE_SIZE;
                break;
            case 5: // Left face
                x = -halfSize;
                y = (Math.random() - 0.5) * CUBE_SIZE;
                z = (Math.random() - 0.5) * CUBE_SIZE;
                break;
        }

        positionsArray[i * 3] = x;
        positionsArray[i * 3 + 1] = y;
        positionsArray[i * 3 + 2] = z;
    }
}

function updateTargetShape(shapeName) {
    if (shapeName === 'Sphere') {
        generateSpherePositions(targetPositions);
    } else if (shapeName === 'Cube') {
        generateCubePositions(targetPositions);
    }
    
    // Update original positions for dispersion calculations
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        originalPositions[i] = targetPositions[i];
    }
}

// ============================================
// MediaPipe Integration
// ============================================

function initMediaPipe() {
    const videoElement = document.getElementById('webcam');

    // Initialize MediaPipe Hands
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    // Initialize camera
    const cam = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    cam.start();
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];

        // Get thumb tip (landmark 4) and index finger tip (landmark 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // Calculate Euclidean distance between thumb and index finger
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = thumbTip.z - indexTip.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Map distance to expansion factor
        // When pinched (distance ~0.02-0.05), expansion = 0 (form shape)
        // When open (distance ~0.15-0.25), expansion = max (scatter)
        const minDistance = 0.03;
        const maxDistance = 0.2;
        
        const normalizedDistance = Math.max(0, Math.min(1, (distance - minDistance) / (maxDistance - minDistance)));
        expansionFactor = normalizedDistance * MAX_DISPERSION;
    } else {
        handDetected = false;
        // Gradually return to shape when no hand detected
        expansionFactor *= 0.95;
    }
}

// ============================================
// UI Controls (lil-gui)
// ============================================

function initGUI() {
    const gui = new lil.GUI();

    // Color picker
    gui.addColor(settings, 'color')
        .name('Particle Color')
        .onChange((value) => {
            particleMaterial.color.set(value);
        });

    // Shape selector
    gui.add(settings, 'shape', ['Sphere', 'Cube'])
        .name('Shape')
        .onChange((value) => {
            updateTargetShape(value);
        });
}

// ============================================
// Animation Loop
// ============================================

function animate() {
    requestAnimationFrame(animate);

    // Update particle positions
    updateParticles();

    // Slowly rotate the particle system
    particles.rotation.y += 0.002;

    // Render
    renderer.render(scene, camera);
}

function updateParticles() {
    const positions = particles.geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;

        // Calculate target position with dispersion
        // Get direction from center to original position
        const ox = originalPositions[idx];
        const oy = originalPositions[idx + 1];
        const oz = originalPositions[idx + 2];

        // Calculate distance from center and normalize direction
        const dist = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const invDist = dist > 0 ? 1 / dist : 0;
        const nx = ox * invDist;
        const ny = oy * invDist;
        const nz = oz * invDist;

        // Calculate dispersed position
        const tx = targetPositions[idx] + nx * expansionFactor;
        const ty = targetPositions[idx + 1] + ny * expansionFactor;
        const tz = targetPositions[idx + 2] + nz * expansionFactor;

        // Lerp current position towards target
        positions[idx] += (tx - positions[idx]) * LERP_SPEED;
        positions[idx + 1] += (ty - positions[idx + 1]) * LERP_SPEED;
        positions[idx + 2] += (tz - positions[idx + 2]) * LERP_SPEED;
    }

    // Mark positions as needing update
    particles.geometry.attributes.position.needsUpdate = true;
}

// ============================================
// Initialization
// ============================================

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initMediaPipe();
    initGUI();
});
