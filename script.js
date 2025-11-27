// ==========================================
// 3D Particle System with Hand Gesture Control
// Using Three.js and MediaPipe
// ==========================================

// Configuration
const PARTICLE_COUNT = 5000;
const PARTICLE_SIZE = 0.02;
const INTERPOLATION_SPEED = 0.05;
const SCATTER_INTENSITY = 2.0;

// ==========================================
// Three.js Setup
// ==========================================

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// Particle System
// ==========================================

// Arrays for particle positions
const currentPositions = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
const spherePositions = new Float32Array(PARTICLE_COUNT * 3);
const cubePositions = new Float32Array(PARTICLE_COUNT * 3);

// Generate sphere positions
function generateSpherePositions() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 1.5;
        
        spherePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        spherePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        spherePositions[i * 3 + 2] = radius * Math.cos(phi);
    }
}

// Generate cube positions
function generateCubePositions() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        cubePositions[i * 3] = (Math.random() - 0.5) * 2.5;
        cubePositions[i * 3 + 1] = (Math.random() - 0.5) * 2.5;
        cubePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
    }
}

// Initialize positions
generateSpherePositions();
generateCubePositions();

// Initialize current positions (start with sphere)
for (let i = 0; i < currentPositions.length; i++) {
    currentPositions[i] = spherePositions[i];
    targetPositions[i] = spherePositions[i];
}

// Create geometry
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

// Create material
const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
});

// Create particle system
const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ==========================================
// GUI Controls
// ==========================================

const guiParams = {
    color: '#00ffff',
    shape: 'Sphere',
    particleSize: PARTICLE_SIZE
};

const gui = new lil.GUI();

// Color picker
gui.addColor(guiParams, 'color').name('Particle Color').onChange((value) => {
    material.color.set(value);
});

// Shape selector
gui.add(guiParams, 'shape', ['Sphere', 'Cube']).name('Target Shape').onChange((value) => {
    if (value === 'Sphere') {
        for (let i = 0; i < targetPositions.length; i++) {
            targetPositions[i] = spherePositions[i];
        }
    } else {
        for (let i = 0; i < targetPositions.length; i++) {
            targetPositions[i] = cubePositions[i];
        }
    }
});

// Particle size control
gui.add(guiParams, 'particleSize', 0.01, 0.1).name('Particle Size').onChange((value) => {
    material.size = value;
});

// ==========================================
// MediaPipe Integration
// ==========================================

// Hand detection state
let handDetected = false;
let fingerDistance = 0;
let normalizedDistance = 0;

// Get video element
const videoElement = document.querySelector('.input_video');

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// OnResults callback
hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];
        
        // Landmark 4: Thumb Tip
        // Landmark 8: Index Finger Tip
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate Euclidean distance
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = thumbTip.z - indexTip.z;
        fingerDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Normalize distance to 0-1 range
        // Typical pinch distance is ~0.05, open hand is ~0.3
        const minDist = 0.05;
        const maxDist = 0.25;
        normalizedDistance = Math.max(0, Math.min(1, (fingerDistance - minDist) / (maxDist - minDist)));
    } else {
        handDetected = false;
        normalizedDistance = 0;
    }
});

// Start camera
const mpCamera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
mpCamera.start();

// ==========================================
// Animation Loop
// ==========================================

function animate() {
    requestAnimationFrame(animate);
    
    // Rotate particles slowly
    particles.rotation.y += 0.002;
    
    // Update particle positions based on hand gesture
    const positions = geometry.attributes.position.array;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;
        
        if (handDetected) {
            // When hand is detected, use finger distance to control scatter
            // Large distance (open hand) = scatter/explode
            // Small distance (pinch) = tight to target shape
            
            const scatterAmount = normalizedDistance * SCATTER_INTENSITY;
            
            // Add noise/scatter based on finger distance
            const noiseX = (Math.random() - 0.5) * scatterAmount * 0.1;
            const noiseY = (Math.random() - 0.5) * scatterAmount * 0.1;
            const noiseZ = (Math.random() - 0.5) * scatterAmount * 0.1;
            
            // Interpolate towards target with noise
            positions[idx] += (targetPositions[idx] + noiseX - positions[idx]) * INTERPOLATION_SPEED;
            positions[idx + 1] += (targetPositions[idx + 1] + noiseY - positions[idx + 1]) * INTERPOLATION_SPEED;
            positions[idx + 2] += (targetPositions[idx + 2] + noiseZ - positions[idx + 2]) * INTERPOLATION_SPEED;
            
            // When distance is large, add more scatter/explosion effect
            if (normalizedDistance > 0.5) {
                const explosionFactor = (normalizedDistance - 0.5) * 2;
                positions[idx] += (Math.random() - 0.5) * explosionFactor * 0.05;
                positions[idx + 1] += (Math.random() - 0.5) * explosionFactor * 0.05;
                positions[idx + 2] += (Math.random() - 0.5) * explosionFactor * 0.05;
            }
        } else {
            // No hand detected - smoothly interpolate to target shape
            positions[idx] += (targetPositions[idx] - positions[idx]) * INTERPOLATION_SPEED;
            positions[idx + 1] += (targetPositions[idx + 1] - positions[idx + 1]) * INTERPOLATION_SPEED;
            positions[idx + 2] += (targetPositions[idx + 2] - positions[idx + 2]) * INTERPOLATION_SPEED;
        }
    }
    
    // Mark positions as needing update
    geometry.attributes.position.needsUpdate = true;
    
    // Render scene
    renderer.render(scene, camera);
}

// Start animation
animate();

console.log('3D Particle System initialized. Open your hand to scatter particles, pinch to form shapes!');
