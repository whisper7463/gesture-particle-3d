/**
 * 3D Gesture Particle System
 * 
 * A real-time interactive 3D particle system using Three.js and MediaPipe Hands.
 * Particles morph between shapes (Sphere/Cube) and respond to hand gestures.
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    particleCount: 5000,
    particleSize: 3,
    defaultColor: '#00ffff',
    cameraDistance: 400,
    rotationSpeed: 0.001,
    morphSpeed: 0.05,
    dispersionRange: { min: 0.8, max: 3.0 },
    pinchThreshold: { min: 0.03, max: 0.25 },
    dispersionReturnSpeed: 0.02
};

// ============================================
// Global State
// ============================================
let scene, camera, renderer, particles;
let targetPositions = [];
let currentShape = 'sphere';
let dispersionFactor = 1.0;
let handDetected = false;

// GUI controls state
const guiState = {
    color: CONFIG.defaultColor,
    shape: 'sphere',
    autoRotate: true,
    rotationSpeed: 1.0
};

// ============================================
// Three.js Setup
// ============================================
function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.z = CONFIG.cameraDistance;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Create particles
    createParticles();
    
    // Set initial shape
    setTargetShape('sphere');
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    
    // Initialize particles at origin
    for (let i = 0; i < CONFIG.particleCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
    }
    
    // Set initial color
    const color = new THREE.Color(CONFIG.defaultColor);
    for (let i = 0; i < CONFIG.particleCount; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create particle material
    const material = new THREE.PointsMaterial({
        size: CONFIG.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
    
    // Initialize target positions array
    targetPositions = new Float32Array(CONFIG.particleCount * 3);
}

// ============================================
// Shape Generation
// ============================================
function generateSpherePositions(radius = 150) {
    const positions = new Float32Array(CONFIG.particleCount * 3);
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        // Use Fibonacci sphere distribution for even coverage
        const phi = Math.acos(1 - 2 * (i + 0.5) / CONFIG.particleCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    
    return positions;
}

function generateCubePositions(size = 200) {
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const halfSize = size / 2;
    const particlesPerFace = Math.floor(CONFIG.particleCount / 6);
    
    let index = 0;
    
    // Generate particles on each face of the cube
    for (let face = 0; face < 6 && index < CONFIG.particleCount; face++) {
        for (let j = 0; j < particlesPerFace && index < CONFIG.particleCount; j++) {
            const u = (Math.random() - 0.5) * size;
            const v = (Math.random() - 0.5) * size;
            
            switch (face) {
                case 0: // Front
                    positions[index * 3] = u;
                    positions[index * 3 + 1] = v;
                    positions[index * 3 + 2] = halfSize;
                    break;
                case 1: // Back
                    positions[index * 3] = u;
                    positions[index * 3 + 1] = v;
                    positions[index * 3 + 2] = -halfSize;
                    break;
                case 2: // Top
                    positions[index * 3] = u;
                    positions[index * 3 + 1] = halfSize;
                    positions[index * 3 + 2] = v;
                    break;
                case 3: // Bottom
                    positions[index * 3] = u;
                    positions[index * 3 + 1] = -halfSize;
                    positions[index * 3 + 2] = v;
                    break;
                case 4: // Right
                    positions[index * 3] = halfSize;
                    positions[index * 3 + 1] = u;
                    positions[index * 3 + 2] = v;
                    break;
                case 5: // Left
                    positions[index * 3] = -halfSize;
                    positions[index * 3 + 1] = u;
                    positions[index * 3 + 2] = v;
                    break;
            }
            index++;
        }
    }
    
    return positions;
}

function setTargetShape(shape) {
    currentShape = shape;
    
    if (shape === 'sphere') {
        targetPositions = generateSpherePositions();
    } else if (shape === 'cube') {
        targetPositions = generateCubePositions();
    }
}

// ============================================
// Particle Animation
// ============================================
function updateParticles() {
    if (!particles) return;
    
    const positions = particles.geometry.attributes.position.array;
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        
        // Calculate target position with dispersion
        const targetX = targetPositions[i3] * dispersionFactor;
        const targetY = targetPositions[i3 + 1] * dispersionFactor;
        const targetZ = targetPositions[i3 + 2] * dispersionFactor;
        
        // Smoothly interpolate current position towards target
        positions[i3] += (targetX - positions[i3]) * CONFIG.morphSpeed;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * CONFIG.morphSpeed;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * CONFIG.morphSpeed;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
}

function updateParticleColor(hexColor) {
    if (!particles) return;
    
    const color = new THREE.Color(hexColor);
    const colors = particles.geometry.attributes.color.array;
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    
    particles.geometry.attributes.color.needsUpdate = true;
}

// ============================================
// MediaPipe Hands Setup
// ============================================
async function initMediaPipe() {
    const videoElement = document.getElementById('webcam');
    const previewElement = document.getElementById('preview-video');
    const loadingElement = document.getElementById('loading');
    
    try {
        // Initialize MediaPipe Hands
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
        
        // Initialize camera
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        // Set preview video source
        previewElement.srcObject = videoElement.srcObject;
        
        // Hide loading indicator
        loadingElement.classList.add('hidden');
        
        console.log('MediaPipe Hands initialized successfully');
        
    } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        // Use textContent to prevent XSS vulnerabilities
        const errorText = document.createElement('p');
        errorText.textContent = 'Error initializing camera';
        const hintText = document.createElement('p');
        hintText.className = 'hint';
        hintText.textContent = error.message || 'Please check camera permissions and try again.';
        loadingElement.textContent = '';
        loadingElement.appendChild(errorText);
        loadingElement.appendChild(hintText);
    }
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];
        
        // Get thumb tip (landmark 4) and index finger tip (landmark 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index finger
        const distance = calculateDistance(thumbTip, indexTip);
        
        // Map distance to dispersion factor
        // Pinched (close) = tighter particles, Open (far) = scattered particles
        const normalizedDistance = mapRange(
            distance,
            CONFIG.pinchThreshold.min,
            CONFIG.pinchThreshold.max,
            0,
            1
        );
        
        // Calculate dispersion factor
        dispersionFactor = mapRange(
            normalizedDistance,
            0,
            1,
            CONFIG.dispersionRange.min,
            CONFIG.dispersionRange.max
        );
        
    } else {
        handDetected = false;
        // Gradually return to default dispersion when no hand detected
        dispersionFactor += (1.0 - dispersionFactor) * CONFIG.dispersionReturnSpeed;
    }
}

function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    const clamped = Math.max(inMin, Math.min(inMax, value));
    return outMin + (clamped - inMin) * (outMax - outMin) / (inMax - inMin);
}

// ============================================
// GUI Setup
// ============================================
function initGUI() {
    const gui = new lil.GUI({ title: 'Controls' });
    
    // Color picker
    gui.addColor(guiState, 'color')
        .name('Particle Color')
        .onChange((value) => {
            updateParticleColor(value);
        });
    
    // Shape selector
    gui.add(guiState, 'shape', ['sphere', 'cube'])
        .name('Shape')
        .onChange((value) => {
            setTargetShape(value);
        });
    
    // Auto-rotate toggle
    gui.add(guiState, 'autoRotate')
        .name('Auto Rotate');
    
    // Rotation speed
    gui.add(guiState, 'rotationSpeed', 0.1, 3.0, 0.1)
        .name('Rotation Speed');
}

// ============================================
// Window Resize Handler
// ============================================
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    requestAnimationFrame(animate);
    
    // Update particle positions
    updateParticles();
    
    // Auto-rotate particles
    if (guiState.autoRotate && particles) {
        particles.rotation.y += CONFIG.rotationSpeed * guiState.rotationSpeed;
        particles.rotation.x += CONFIG.rotationSpeed * guiState.rotationSpeed * 0.3;
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// ============================================
// Initialization
// ============================================
async function init() {
    // Initialize Three.js
    initThreeJS();
    
    // Initialize GUI
    initGUI();
    
    // Start animation loop
    animate();
    
    // Initialize MediaPipe (async)
    await initMediaPipe();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
