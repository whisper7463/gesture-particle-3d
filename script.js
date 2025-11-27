import * as THREE from 'three';
import GUI from 'lil-gui';

// ========================================
// Configuration
// ========================================
const CONFIG = {
    particleCount: 5000,
    particleSize: 0.05,
    particleColor: '#00ffff',
    currentShape: 'Sphere',
    morphSpeed: 0.05,
    dispersionFactor: 1.0,
    maxDispersion: 3.0,
    minDispersion: 0.5,
    // Pinch distance thresholds (normalized MediaPipe coordinates)
    minPinchDistance: 0.02,  // Fingers close together
    maxPinchDistance: 0.3    // Fingers spread apart
};

// ========================================
// Global Variables
// ========================================
let scene, camera, renderer;
let particles, particleGeometry, particleMaterial;
let boxPositions, spherePositions;
let targetPositions;
let currentPositions;
let handDetected = false;
let pinchDistance = 0;

// ========================================
// Three.js Setup
// ========================================
function initThreeJS() {
    // Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Create PerspectiveCamera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Create WebGLRenderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);

    // Generate particle positions for shapes
    generateShapePositions();

    // Create Particle System
    createParticleSystem();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// ========================================
// Particle Shape Positions
// ========================================
function generateShapePositions() {
    const count = CONFIG.particleCount;
    
    boxPositions = new Float32Array(count * 3);
    spherePositions = new Float32Array(count * 3);

    // Generate Box positions (random within a cube)
    const boxSize = 2;
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Random face selection for hollow cube effect
        const face = Math.floor(Math.random() * 6);
        let x, y, z;
        
        switch (face) {
            case 0: // Front
                x = (Math.random() - 0.5) * boxSize;
                y = (Math.random() - 0.5) * boxSize;
                z = boxSize / 2;
                break;
            case 1: // Back
                x = (Math.random() - 0.5) * boxSize;
                y = (Math.random() - 0.5) * boxSize;
                z = -boxSize / 2;
                break;
            case 2: // Top
                x = (Math.random() - 0.5) * boxSize;
                y = boxSize / 2;
                z = (Math.random() - 0.5) * boxSize;
                break;
            case 3: // Bottom
                x = (Math.random() - 0.5) * boxSize;
                y = -boxSize / 2;
                z = (Math.random() - 0.5) * boxSize;
                break;
            case 4: // Right
                x = boxSize / 2;
                y = (Math.random() - 0.5) * boxSize;
                z = (Math.random() - 0.5) * boxSize;
                break;
            case 5: // Left
                x = -boxSize / 2;
                y = (Math.random() - 0.5) * boxSize;
                z = (Math.random() - 0.5) * boxSize;
                break;
        }
        
        boxPositions[i3] = x;
        boxPositions[i3 + 1] = y;
        boxPositions[i3 + 2] = z;
    }

    // Generate Sphere positions (points on sphere surface)
    const radius = 1.5;
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Random point on sphere surface using spherical coordinates
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        spherePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        spherePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        spherePositions[i3 + 2] = radius * Math.cos(phi);
    }

    // Initialize target and current positions
    targetPositions = new Float32Array(count * 3);
    currentPositions = new Float32Array(count * 3);
    targetPositions.set(spherePositions);
    currentPositions.set(spherePositions);
}

// ========================================
// Create Particle System
// ========================================
function createParticleSystem() {
    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(currentPositions, 3)
    );

    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(CONFIG.particleColor),
        size: CONFIG.particleSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// ========================================
// Shape Morphing
// ========================================
function setTargetShape(shapeName) {
    CONFIG.currentShape = shapeName;
    
    if (shapeName === 'Box') {
        targetPositions.set(boxPositions);
    } else {
        targetPositions.set(spherePositions);
    }
}

function updateParticlePositions() {
    const positions = particleGeometry.attributes.position.array;
    const dispersion = CONFIG.dispersionFactor;
    
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        // Lerp towards target position
        currentPositions[i] += (targetPositions[i] - currentPositions[i]) * CONFIG.morphSpeed;
        
        // Apply dispersion factor
        positions[i] = currentPositions[i] * dispersion;
    }
    
    particleGeometry.attributes.position.needsUpdate = true;
}

// ========================================
// MediaPipe Integration
// ========================================
function initMediaPipe() {
    const videoElement = document.getElementById('webcam');
    
    // Initialize MediaPipe Hands
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });
    
    hands.onResults(onHandResults);
    
    // Setup Camera utility to feed webcam to MediaPipe
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    
    camera.start();
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];
        
        // Get Thumb Tip (Index 4) and Index Finger Tip (Index 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index finger
        pinchDistance = calculateDistance(thumbTip, indexTip);
        
        // Map pinch distance to dispersion factor
        // When fingers are close (pinch): particles converge (smaller dispersion)
        // When fingers are apart: particles expand (larger dispersion)
        const normalizedDistance = Math.min(
            Math.max(pinchDistance, CONFIG.minPinchDistance),
            CONFIG.maxPinchDistance
        );
        const mappedDispersion = mapRange(
            normalizedDistance,
            CONFIG.minPinchDistance,
            CONFIG.maxPinchDistance,
            CONFIG.minDispersion,
            CONFIG.maxDispersion
        );
        
        CONFIG.dispersionFactor = mappedDispersion;
    } else {
        handDetected = false;
        // Gradually return to default dispersion when no hand detected
        CONFIG.dispersionFactor += (1.0 - CONFIG.dispersionFactor) * 0.05;
    }
}

function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// ========================================
// UI Controls (lil-gui)
// ========================================
function initGUI() {
    const gui = new GUI();
    
    // Particle Color control
    gui.addColor(CONFIG, 'particleColor')
        .name('Particle Color')
        .onChange((value) => {
            particleMaterial.color.set(value);
        });
    
    // Shape selection dropdown
    gui.add(CONFIG, 'currentShape', ['Sphere', 'Box'])
        .name('Shape')
        .onChange((value) => {
            setTargetShape(value);
        });
    
    // Additional controls
    gui.add(CONFIG, 'particleSize', 0.01, 0.2)
        .name('Particle Size')
        .onChange((value) => {
            particleMaterial.size = value;
        });
    
    gui.add(CONFIG, 'morphSpeed', 0.01, 0.2)
        .name('Morph Speed');
}

// ========================================
// Window Resize Handler
// ========================================
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ========================================
// Animation Loop
// ========================================
function animate() {
    requestAnimationFrame(animate);
    
    // Update particle positions (morphing + dispersion)
    updateParticlePositions();
    
    // Rotate particles for visual effect
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    
    renderer.render(scene, camera);
}

// ========================================
// Initialize Application
// ========================================
function init() {
    initThreeJS();
    initMediaPipe();
    initGUI();
    animate();
}

// Start the application when DOM is ready
init();
