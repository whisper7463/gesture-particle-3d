/**
 * Gesture Particle 3D - Interactive 3D Particle System
 * Controlled by hand gestures using MediaPipe
 */

// ==================== Configuration ====================
const CONFIG = {
    particleCount: 4500,
    shapes: ['sphere', 'box'],
    defaultShape: 'sphere',
    defaultColor: '#4fc3f7',
    shapeRadius: 3,
    transitionSpeed: 0.05,
    expansionFactor: 2.5,
    pinchThreshold: 0.08, // Distance threshold for pinch detection
    cameraZ: 8
};

// ==================== Global Variables ====================
let scene, camera, renderer;
let particles, particleGeometry, particleMaterial;
let targetPositions = [];
let currentPositions = [];
let originalPositions = [];
let expandedPositions = [];
let isPinching = false;
let expansionAmount = 0;
let gui;
let hands;
let videoElement;

// GUI parameters
const params = {
    color: CONFIG.defaultColor,
    shape: CONFIG.defaultShape,
    particleSize: 0.03,
    rotationSpeed: 0.002,
    showWebcam: true
};

// ==================== Initialization ====================
function init() {
    setupThreeJS();
    createParticles();
    setupGUI();
    setupMediaPipe();
    addInstructions();
    animate();
}

// ==================== Three.js Setup ====================
function setupThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = CONFIG.cameraZ;
    
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

// ==================== Particle System ====================
function createParticles() {
    // Create geometry
    particleGeometry = new THREE.BufferGeometry();
    
    // Initialize position arrays
    currentPositions = new Float32Array(CONFIG.particleCount * 3);
    targetPositions = new Float32Array(CONFIG.particleCount * 3);
    originalPositions = new Float32Array(CONFIG.particleCount * 3);
    expandedPositions = new Float32Array(CONFIG.particleCount * 3);
    
    // Generate initial positions based on default shape
    generateShapePositions(params.shape);
    
    // Copy to current positions
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        currentPositions[i] = targetPositions[i];
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    
    // Create material
    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(params.color),
        size: params.particleSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    
    // Create points
    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function generateShapePositions(shape) {
    const radius = CONFIG.shapeRadius;
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        let x, y, z;
        
        if (shape === 'sphere') {
            // Generate points on a sphere using spherical coordinates
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = Math.random() * Math.PI * 2;
            const r = radius * Math.cbrt(Math.random()); // Cube root for uniform volume distribution
            
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
        } else if (shape === 'box') {
            // Generate points inside a cube
            x = (Math.random() - 0.5) * radius * 2;
            y = (Math.random() - 0.5) * radius * 2;
            z = (Math.random() - 0.5) * radius * 2;
        }
        
        // Store original (contracted) positions
        originalPositions[i3] = x;
        originalPositions[i3 + 1] = y;
        originalPositions[i3 + 2] = z;
        
        // Store expanded positions (scaled outward)
        const expandScale = CONFIG.expansionFactor;
        expandedPositions[i3] = x * expandScale;
        expandedPositions[i3 + 1] = y * expandScale;
        expandedPositions[i3 + 2] = z * expandScale;
        
        // Set initial target positions
        targetPositions[i3] = x;
        targetPositions[i3 + 1] = y;
        targetPositions[i3 + 2] = z;
    }
}

function updateParticleTargets() {
    // Interpolate between original and expanded positions based on expansion amount
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        targetPositions[i] = originalPositions[i] + 
            (expandedPositions[i] - originalPositions[i]) * expansionAmount;
    }
}

function updateParticles() {
    const positions = particleGeometry.attributes.position.array;
    
    // Smoothly interpolate current positions towards target positions
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        positions[i] += (targetPositions[i] - positions[i]) * CONFIG.transitionSpeed;
    }
    
    particleGeometry.attributes.position.needsUpdate = true;
}

function changeShape(newShape) {
    generateShapePositions(newShape);
    updateParticleTargets();
}

// ==================== MediaPipe Setup ====================
function setupMediaPipe() {
    videoElement = document.getElementById('webcam');

    // Check if MediaPipe Hands is available
    if (typeof Hands === 'undefined') {
        console.error('MediaPipe Hands library not loaded');
        updateStatus('Error: MediaPipe not available');
        return;
    }

    try {
        // Initialize MediaPipe Hands
        hands = new Hands({
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

        // Setup camera
        setupCamera();
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        updateStatus('Error: Failed to initialize hand tracking');
    }
}

function setupCamera() {
    // Check if Camera utility is available
    if (typeof Camera === 'undefined') {
        console.error('MediaPipe Camera utility not loaded');
        updateStatus('Error: Camera utility not available');
        return;
    }

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    cameraUtils.start()
        .then(() => {
            updateStatus('Hand tracking active');
        })
        .catch((error) => {
            console.error('Camera error:', error);
            // Provide more specific error messages
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                updateStatus('Camera permission denied - please allow access');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                updateStatus('No camera found - please connect a webcam');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                updateStatus('Camera in use by another application');
            } else {
                updateStatus('Camera error: ' + error.message);
            }
        });
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Get thumb tip (landmark 4) and index finger tip (landmark 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index finger
        const distance = calculateDistance(thumbTip, indexTip);
        
        // Determine if pinching (close distance = pinch)
        if (distance < CONFIG.pinchThreshold) {
            isPinching = true;
            // Map pinch to contraction (closer = more contracted)
            expansionAmount = Math.max(0, expansionAmount - 0.05);
            updateStatus(`Pinching - Contracting (${Math.round((1 - expansionAmount) * 100)}%)`);
        } else {
            isPinching = false;
            // Map release to expansion (further = more expanded)
            const normalizedDistance = Math.min(1, (distance - CONFIG.pinchThreshold) / 0.2);
            expansionAmount = Math.min(1, expansionAmount + 0.03 * normalizedDistance);
            updateStatus(`Released - Expanding (${Math.round(expansionAmount * 100)}%)`);
        }
        
        updateParticleTargets();
    } else {
        updateStatus('No hand detected - Show your hand');
    }
}

function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function updateStatus(message) {
    const statusElement = document.getElementById('status-text');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// ==================== GUI Setup ====================
function setupGUI() {
    gui = new lil.GUI({ title: 'Particle Controls' });
    
    // Color control
    gui.addColor(params, 'color')
        .name('Particle Color')
        .onChange((value) => {
            particleMaterial.color.set(value);
        });
    
    // Shape control
    gui.add(params, 'shape', CONFIG.shapes)
        .name('Shape')
        .onChange((value) => {
            changeShape(value);
        });
    
    // Particle size control
    gui.add(params, 'particleSize', 0.01, 0.1, 0.005)
        .name('Particle Size')
        .onChange((value) => {
            particleMaterial.size = value;
        });
    
    // Rotation speed control
    gui.add(params, 'rotationSpeed', 0, 0.02, 0.001)
        .name('Rotation Speed');
    
    // Webcam visibility toggle
    gui.add(params, 'showWebcam')
        .name('Show Webcam')
        .onChange((value) => {
            videoElement.style.display = value ? 'block' : 'none';
        });
}

// ==================== Instructions ====================
function addInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.innerHTML = `
        <h3>Gesture Controls</h3>
        <ul>
            <li><strong>Pinch:</strong> Close thumb & index finger to contract particles</li>
            <li><strong>Release:</strong> Open fingers to expand particles</li>
        </ul>
    `;
    document.body.appendChild(instructions);
}

// ==================== Animation Loop ====================
function animate() {
    requestAnimationFrame(animate);
    
    // Update particle positions
    updateParticles();
    
    // Rotate the particle system
    particles.rotation.y += params.rotationSpeed;
    particles.rotation.x += params.rotationSpeed * 0.3;
    
    // Render
    renderer.render(scene, camera);
}

// ==================== Start Application ====================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
