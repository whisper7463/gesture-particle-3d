import * as THREE from 'three';

// ============================================
// Configuration
// ============================================
const PARTICLE_COUNT = 4000;
const SHAPE_RADIUS = 2;
const MAX_SPREAD = 5;

// ============================================
// GUI Settings
// ============================================
const settings = {
    particleColor: '#00ffff',
    shape: 'Sphere',
    spread: 0.0
};

// ============================================
// Global Variables
// ============================================
let scene, camera, renderer;
let particles, particleGeometry, particleMaterial;
let spherePositions, cubePositions;
let targetPositions;
let currentSpread = 0;
let targetSpread = 0;
let hands, webcamCamera;
let gui;

// Webcam elements
const videoElement = document.getElementById('webcam');
const webcamCanvas = document.getElementById('webcam-canvas');
const webcamCtx = webcamCanvas.getContext('2d');

// ============================================
// Initialize Three.js Scene
// ============================================
function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.id = 'three-canvas';
    document.body.appendChild(renderer.domElement);

    // Generate shape positions
    spherePositions = generateSpherePositions(PARTICLE_COUNT, SHAPE_RADIUS);
    cubePositions = generateCubePositions(PARTICLE_COUNT, SHAPE_RADIUS);
    targetPositions = new Float32Array(spherePositions);

    // Create particles
    createParticles();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// ============================================
// Generate Sphere Positions
// ============================================
function generateSpherePositions(count, radius) {
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        // Use Fibonacci sphere for even distribution
        const phi = Math.acos(1 - 2 * (i + 0.5) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }
    
    return positions;
}

// ============================================
// Generate Cube Positions
// ============================================
function generateCubePositions(count, size) {
    const positions = new Float32Array(count * 3);
    const particlesPerFace = Math.floor(count / 6);
    const gridSize = Math.ceil(Math.sqrt(particlesPerFace));
    const step = (size * 2) / gridSize;
    
    let index = 0;
    
    // Generate particles on each face of the cube
    for (let face = 0; face < 6 && index < count; face++) {
        for (let i = 0; i < gridSize && index < count; i++) {
            for (let j = 0; j < gridSize && index < count; j++) {
                const u = -size + step * (i + 0.5);
                const v = -size + step * (j + 0.5);
                
                let x, y, z;
                
                switch (face) {
                    case 0: x = size; y = u; z = v; break;  // Right
                    case 1: x = -size; y = u; z = v; break; // Left
                    case 2: x = u; y = size; z = v; break;  // Top
                    case 3: x = u; y = -size; z = v; break; // Bottom
                    case 4: x = u; y = v; z = size; break;  // Front
                    case 5: x = u; y = v; z = -size; break; // Back
                }
                
                positions[index * 3] = x;
                positions[index * 3 + 1] = y;
                positions[index * 3 + 2] = z;
                index++;
            }
        }
    }
    
    return positions;
}

// ============================================
// Create Particle System
// ============================================
function createParticles() {
    particleGeometry = new THREE.BufferGeometry();
    
    // Initial positions (copy of target positions)
    const positions = new Float32Array(targetPositions);
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Store original positions for spread calculation
    particleGeometry.setAttribute('originalPosition', new THREE.BufferAttribute(new Float32Array(targetPositions), 3));
    
    // Random directions for spreading
    const spreadDirections = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        spreadDirections[i * 3] = Math.sin(phi) * Math.cos(theta);
        spreadDirections[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
        spreadDirections[i * 3 + 2] = Math.cos(phi);
    }
    particleGeometry.setAttribute('spreadDirection', new THREE.BufferAttribute(spreadDirections, 3));
    
    // Particle material
    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(settings.particleColor),
        size: 0.03,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// ============================================
// Update Target Shape
// ============================================
function updateTargetShape(shapeName) {
    if (shapeName === 'Sphere') {
        targetPositions = new Float32Array(spherePositions);
    } else {
        targetPositions = new Float32Array(cubePositions);
    }
    
    // Update original positions for spread calculation
    const originalPositionAttr = particleGeometry.getAttribute('originalPosition');
    originalPositionAttr.array.set(targetPositions);
    originalPositionAttr.needsUpdate = true;
}

// ============================================
// Initialize MediaPipe Hands
// ============================================
function initMediaPipe() {
    // Set up webcam canvas size
    webcamCanvas.width = 320;
    webcamCanvas.height = 240;
    
    // Initialize MediaPipe Hands
    hands = new window.Hands({
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
    
    // Initialize camera
    webcamCamera = new window.Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    
    webcamCamera.start();
}

// ============================================
// Handle Hand Detection Results
// ============================================
function onHandResults(results) {
    // Draw webcam feed to canvas
    webcamCtx.save();
    webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
    webcamCtx.drawImage(results.image, 0, 0, webcamCanvas.width, webcamCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Draw hand landmarks
        drawHandLandmarks(landmarks);
        
        // Get thumb tip (4) and index finger tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index finger
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = (thumbTip.z || 0) - (indexTip.z || 0);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Map distance to spread value (0-1)
        // Pinched: distance ~0.03, Open: distance ~0.2
        const normalizedDistance = Math.min(Math.max((distance - 0.03) / 0.17, 0), 1);
        targetSpread = normalizedDistance;
        
        settings.spread = targetSpread;
    }
    
    webcamCtx.restore();
}

// ============================================
// Draw Hand Landmarks on Webcam Canvas
// ============================================
function drawHandLandmarks(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],     // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],     // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17]            // Palm
    ];
    
    // Draw connections
    webcamCtx.strokeStyle = '#00ff00';
    webcamCtx.lineWidth = 2;
    
    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        webcamCtx.beginPath();
        webcamCtx.moveTo(startPoint.x * webcamCanvas.width, startPoint.y * webcamCanvas.height);
        webcamCtx.lineTo(endPoint.x * webcamCanvas.width, endPoint.y * webcamCanvas.height);
        webcamCtx.stroke();
    });
    
    // Draw landmarks
    landmarks.forEach((landmark, index) => {
        const x = landmark.x * webcamCanvas.width;
        const y = landmark.y * webcamCanvas.height;
        
        webcamCtx.beginPath();
        webcamCtx.arc(x, y, 4, 0, Math.PI * 2);
        
        // Highlight thumb tip (4) and index tip (8)
        if (index === 4 || index === 8) {
            webcamCtx.fillStyle = '#ff0000';
        } else {
            webcamCtx.fillStyle = '#00ff00';
        }
        
        webcamCtx.fill();
    });
}

// ============================================
// Initialize GUI
// ============================================
function initGUI() {
    // Wait for lil-gui to load
    const checkGUI = setInterval(() => {
        if (window.GUI) {
            clearInterval(checkGUI);
            
            gui = new window.GUI({ title: 'Particle Controls' });
            
            gui.addColor(settings, 'particleColor')
                .name('Particle Color')
                .onChange((value) => {
                    particleMaterial.color.set(value);
                });
            
            gui.add(settings, 'shape', ['Sphere', 'Cube'])
                .name('Shape')
                .onChange((value) => {
                    updateTargetShape(value);
                });
            
            gui.add(settings, 'spread', 0, 1)
                .name('Spread')
                .listen()
                .disable();
        }
    }, 100);
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
    
    // Smoothly interpolate current spread to target spread
    currentSpread += (targetSpread - currentSpread) * 0.1;
    
    // Update particle positions
    const positions = particleGeometry.getAttribute('position');
    const originalPositions = particleGeometry.getAttribute('originalPosition');
    const spreadDirections = particleGeometry.getAttribute('spreadDirection');
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Get target position (shape position)
        const targetX = originalPositions.array[i3];
        const targetY = originalPositions.array[i3 + 1];
        const targetZ = originalPositions.array[i3 + 2];
        
        // Get spread direction
        const spreadX = spreadDirections.array[i3];
        const spreadY = spreadDirections.array[i3 + 1];
        const spreadZ = spreadDirections.array[i3 + 2];
        
        // Calculate final position with spread
        const spreadAmount = currentSpread * MAX_SPREAD;
        const finalX = targetX + spreadX * spreadAmount;
        const finalY = targetY + spreadY * spreadAmount;
        const finalZ = targetZ + spreadZ * spreadAmount;
        
        // Smoothly interpolate current position to final position
        positions.array[i3] += (finalX - positions.array[i3]) * 0.05;
        positions.array[i3 + 1] += (finalY - positions.array[i3 + 1]) * 0.05;
        positions.array[i3 + 2] += (finalZ - positions.array[i3 + 2]) * 0.05;
    }
    
    positions.needsUpdate = true;
    
    // Rotate particle system slowly
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    
    renderer.render(scene, camera);
}

// ============================================
// Main Initialization
// ============================================
function init() {
    initThree();
    initGUI();
    initMediaPipe();
    animate();
}

// Start the application
init();
