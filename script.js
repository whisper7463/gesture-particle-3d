// ==========================================
// Gesture Particle 3D - Main Script
// ==========================================

// Global Variables
let scene, camera, renderer;
let particleSystem, particleGeometry, particleMaterial;
let currentPositions, targetPositions, velocities;

// Constants
const PARTICLE_COUNT = 4000;
const PINCH_MIN_DISTANCE = 0.03;
const PINCH_MAX_DISTANCE = 0.2;
const INTERACTION_DECAY_RATE = 0.02;
const ANIMATION_SMOOTHING_FACTOR = 0.05;
const RANDOM_OFFSET_STRENGTH = 0.5;

// Hand tracking variables
let handLandmarks = null;
let interactionFactor = 1.0; // 0 = pinched (tight), 1 = open (scattered)
let handRotationAngle = null; // Rotation angle based on hand orientation

// GUI parameters
const params = {
    particleColor: '#00ffff',
    shape: 'Heart',
    particleSize: 3,
    dispersionStrength: 5
};

// ==========================================
// Three.js Setup
// ==========================================
function initThreeJS() {
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
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================
// Particle System
// ==========================================
function initParticles() {
    // Create BufferGeometry
    particleGeometry = new THREE.BufferGeometry();
    
    // Initialize arrays for positions
    currentPositions = new Float32Array(PARTICLE_COUNT * 3);
    targetPositions = new Float32Array(PARTICLE_COUNT * 3);
    velocities = new Float32Array(PARTICLE_COUNT * 3);
    
    // Generate initial heart shape
    generateHeartPositions(targetPositions);
    
    // Copy target to current positions initially
    for (let i = 0; i < currentPositions.length; i++) {
        currentPositions[i] = targetPositions[i];
        velocities[i] = 0;
    }
    
    // Set position attribute
    particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(currentPositions, 3)
    );
    
    // Create particle material
    particleMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(params.particleColor),
        size: params.particleSize * 0.01,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });
    
    // Create Points object
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

// Generate sphere positions
function generateSpherePositions(positions) {
    const radius = 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Use golden ratio spiral for even distribution
        const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }
}

// Generate cube positions
function generateCubePositions(positions) {
    const size = 2;
    const halfSize = size / 2;
    const particlesPerFace = Math.floor(PARTICLE_COUNT / 6);
    let index = 0;
    
    // Generate particles on each face of the cube
    const faces = [
        { axis: 'x', sign: 1 },  // +X face
        { axis: 'x', sign: -1 }, // -X face
        { axis: 'y', sign: 1 },  // +Y face
        { axis: 'y', sign: -1 }, // -Y face
        { axis: 'z', sign: 1 },  // +Z face
        { axis: 'z', sign: -1 }  // -Z face
    ];
    
    for (let f = 0; f < 6; f++) {
        const face = faces[f];
        const count = (f === 5) ? PARTICLE_COUNT - index : particlesPerFace;
        
        for (let i = 0; i < count && index < PARTICLE_COUNT; i++) {
            let x, y, z;
            const u = (Math.random() - 0.5) * size;
            const v = (Math.random() - 0.5) * size;
            
            if (face.axis === 'x') {
                x = face.sign * halfSize;
                y = u;
                z = v;
            } else if (face.axis === 'y') {
                x = u;
                y = face.sign * halfSize;
                z = v;
            } else {
                x = u;
                y = v;
                z = face.sign * halfSize;
            }
            
            positions[index * 3] = x;
            positions[index * 3 + 1] = y;
            positions[index * 3 + 2] = z;
            index++;
        }
    }
}

// Generate heart positions using rejection sampling
function generateHeartPositions(positions) {
    const scale = 1.5;
    let index = 0;
    let iterations = 0;
    const maxIterations = PARTICLE_COUNT * 100; // Safety limit
    
    // Use rejection sampling within a bounding box
    // Heart equation: (x^2 + 9/4 * y^2 + z^2 - 1)^3 - x^2 * z^3 - 9/80 * y^2 * z^3 < 0
    while (index < PARTICLE_COUNT && iterations < maxIterations) {
        iterations++;
        
        // Sample random point in bounding box
        const x = (Math.random() * 3 - 1.5); // [-1.5, 1.5]
        const z = (Math.random() * 3 - 1.5); // [-1.5, 1.5]
        const y = (Math.random() * 3 - 1);   // [-1, 2]
        
        // Check if point is inside the heart
        const x2 = x * x;
        const y2 = y * y;
        const z2 = z * z;
        
        const term1 = x2 + (9 / 4) * y2 + z2 - 1;
        const term1Cubed = term1 * term1 * term1;
        const z3 = z2 * z;
        const heartValue = term1Cubed - x2 * z3 - (9 / 80) * y2 * z3;
        
        if (heartValue < 0) {
            // Point is inside the heart - use it
            positions[index * 3] = x * scale;
            positions[index * 3 + 1] = z * scale; // Map z to Y (up)
            positions[index * 3 + 2] = y * scale; // Map y to Z (depth)
            index++;
        }
    }
    
    // Fill remaining positions with random points inside heart bounds if limit reached
    while (index < PARTICLE_COUNT) {
        const x = (Math.random() - 0.5) * 2 * scale;
        const y = Math.random() * 2 * scale;
        const z = (Math.random() - 0.5) * 2 * scale;
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        index++;
    }
}

// Generate fireworks positions (spherical distribution with trails/clusters)
function generateFireworksPositions(positions) {
    const numClusters = 8;
    const particlesPerCluster = Math.floor(PARTICLE_COUNT / numClusters);
    let index = 0;
    
    for (let c = 0; c < numClusters; c++) {
        // Random direction for each cluster
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const clusterDirX = Math.sin(theta) * Math.cos(phi);
        const clusterDirY = Math.sin(theta) * Math.sin(phi);
        const clusterDirZ = Math.cos(theta);
        
        const count = (c === numClusters - 1) ? PARTICLE_COUNT - index : particlesPerCluster;
        
        for (let i = 0; i < count && index < PARTICLE_COUNT; i++) {
            // Distance along the trail (creates elongated burst effect)
            const t = Math.random();
            const trailLength = 1.5 + Math.random() * 1.5;
            const spread = 0.3 * t; // Spread increases along trail
            
            // Position along trail with some spread
            const x = clusterDirX * trailLength * t + (Math.random() - 0.5) * spread;
            const y = clusterDirY * trailLength * t + (Math.random() - 0.5) * spread;
            const z = clusterDirZ * trailLength * t + (Math.random() - 0.5) * spread;
            
            positions[index * 3] = x;
            positions[index * 3 + 1] = y;
            positions[index * 3 + 2] = z;
            index++;
        }
    }
}

// Generate Christmas Tree positions (cone-like layered tree)
function generateChristmasTreePositions(positions) {
    const treeHeight = 3;
    const baseRadius = 1.5;
    const numLayers = 5;
    const trunkParticles = Math.floor(PARTICLE_COUNT * 0.1);
    const treeParticles = PARTICLE_COUNT - trunkParticles;
    let index = 0;
    
    // Generate tree layers (cone shape)
    for (let i = 0; i < treeParticles && index < PARTICLE_COUNT; i++) {
        // Random height along tree
        const heightRatio = Math.random();
        const y = heightRatio * treeHeight - 0.5; // Tree starts at -0.5
        
        // Radius decreases as we go up (cone shape)
        const layerRadius = baseRadius * (1 - heightRatio * 0.9);
        
        // Add some layer effect (scalloped edges)
        const layerIndex = Math.floor(heightRatio * numLayers);
        const layerOffset = (heightRatio * numLayers) % 1;
        const radiusVariation = 1 - layerOffset * 0.3;
        const effectiveRadius = layerRadius * radiusVariation;
        
        // Random angle around the tree
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * effectiveRadius; // sqrt for uniform distribution
        
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        index++;
    }
    
    // Generate trunk
    for (let i = 0; i < trunkParticles && index < PARTICLE_COUNT; i++) {
        const trunkRadius = 0.15;
        const trunkHeight = 0.8;
        
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * trunkRadius;
        const y = -0.5 - Math.random() * trunkHeight; // Below tree
        
        positions[index * 3] = r * Math.cos(angle);
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = r * Math.sin(angle);
        index++;
    }
}

// Generate Planet positions (central sphere with ring)
function generatePlanetPositions(positions) {
    const sphereRadius = 1;
    const ringInnerRadius = 1.5;
    const ringOuterRadius = 2.5;
    const ringThickness = 0.1;
    
    const sphereParticles = Math.floor(PARTICLE_COUNT * 0.6);
    const ringParticles = PARTICLE_COUNT - sphereParticles;
    let index = 0;
    
    // Generate sphere (planet body)
    for (let i = 0; i < sphereParticles && index < PARTICLE_COUNT; i++) {
        // Use golden ratio spiral for even distribution
        const phi = Math.acos(1 - 2 * (i + 0.5) / sphereParticles);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
        
        const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
        const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
        const z = sphereRadius * Math.cos(phi);
        
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        index++;
    }
    
    // Generate ring (flat disk around equator)
    for (let i = 0; i < ringParticles && index < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Random radius within ring bounds
        const r = ringInnerRadius + Math.random() * (ringOuterRadius - ringInnerRadius);
        
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        const y = (Math.random() - 0.5) * ringThickness; // Thin in Y direction
        
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        index++;
    }
}

// Switch shape
function switchShape(shape) {
    if (shape === 'Sphere') {
        generateSpherePositions(targetPositions);
    } else if (shape === 'Cube') {
        generateCubePositions(targetPositions);
    } else if (shape === 'Heart') {
        generateHeartPositions(targetPositions);
    } else if (shape === 'Fireworks') {
        generateFireworksPositions(targetPositions);
    } else if (shape === 'Christmas Tree') {
        generateChristmasTreePositions(targetPositions);
    } else if (shape === 'Planet') {
        generatePlanetPositions(targetPositions);
    }
}

// ==========================================
// MediaPipe Integration
// ==========================================
function initMediaPipe() {
    const videoElement = document.getElementById('webcam');
    
    // Initialize Hands
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
    
    // Initialize Camera
    const cameraInstance = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    
    cameraInstance.start()
        .then(() => {
            console.log('Webcam started successfully');
        })
        .catch((err) => {
            console.error('Error starting webcam:', err);
            alert('Could not access webcam. Please ensure you have granted camera permissions.');
        });
}

// Handle hand detection results
function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks[0];
        
        // Calculate pinch distance (thumb tip to index finger tip)
        const thumbTip = handLandmarks[4];  // Landmark 4: Thumb tip
        const indexTip = handLandmarks[8];  // Landmark 8: Index finger tip
        
        // Calculate Euclidean distance
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = (thumbTip.z || 0) - (indexTip.z || 0);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Map distance to interaction factor
        // Pinch threshold: ~0.05 (pinched) to ~0.2 (open)
        interactionFactor = Math.min(1, Math.max(0, (distance - PINCH_MIN_DISTANCE) / (PINCH_MAX_DISTANCE - PINCH_MIN_DISTANCE)));
        
        // Calculate hand rotation angle (wrist to middle finger tip)
        const wrist = handLandmarks[0];       // Landmark 0: Wrist
        const middleTip = handLandmarks[12];  // Landmark 12: Middle finger tip
        
        // Calculate angle in 2D (x, y plane) for Z-axis rotation
        const handDx = middleTip.x - wrist.x;
        const handDy = middleTip.y - wrist.y;
        handRotationAngle = Math.atan2(handDx, -handDy); // Negative handDy because y increases downward in screen coords
    } else {
        handLandmarks = null;
        handRotationAngle = null; // Reset rotation angle when no hand detected
        // Gradually return to default when no hand detected
        interactionFactor = Math.max(0, interactionFactor - INTERACTION_DECAY_RATE);
    }
}

// ==========================================
// lil-gui Setup
// ==========================================
function initGUI() {
    const gui = new lil.GUI();
    
    // Particle Color
    gui.addColor(params, 'particleColor')
        .name('Particle Color')
        .onChange((value) => {
            particleMaterial.color.set(value);
        });
    
    // Shape switching
    gui.add(params, 'shape', ['Sphere', 'Cube', 'Heart', 'Fireworks', 'Christmas Tree', 'Planet'])
        .name('Shape')
        .onChange((value) => {
            switchShape(value);
        });
    
    // Particle Size
    gui.add(params, 'particleSize', 1, 10)
        .name('Particle Size')
        .onChange((value) => {
            particleMaterial.size = value * 0.01;
        });
    
    // Dispersion Strength
    gui.add(params, 'dispersionStrength', 1, 20)
        .name('Dispersion Strength');
}

// ==========================================
// Animation Loop
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    
    updateParticles();
    
    // Apply rotation based on hand tracking or automatic rotation
    if (handRotationAngle !== null) {
        // Apply hand rotation to Z-axis
        particleSystem.rotation.z = handRotationAngle;
    } else {
        // Automatic rotation when no hand detected
        particleSystem.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);
}

function updateParticles() {
    const positions = particleGeometry.attributes.position.array;
    const dispersion = interactionFactor * params.dispersionStrength;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Get target position
        let targetX = targetPositions[i3];
        let targetY = targetPositions[i3 + 1];
        let targetZ = targetPositions[i3 + 2];
        
        // Apply dispersion based on interaction factor
        if (dispersion > 0.1) {
            // Get direction from center
            const length = Math.sqrt(targetX * targetX + targetY * targetY + targetZ * targetZ);
            if (length > 0) {
                const dirX = targetX / length;
                const dirY = targetY / length;
                const dirZ = targetZ / length;
                
                // Add random scatter
                const randomOffset = (Math.random() - 0.5) * RANDOM_OFFSET_STRENGTH;
                targetX += dirX * dispersion + randomOffset;
                targetY += dirY * dispersion + randomOffset;
                targetZ += dirZ * dispersion + randomOffset;
            }
        }
        
        // Smoothly interpolate current position towards target
        positions[i3] += (targetX - positions[i3]) * ANIMATION_SMOOTHING_FACTOR;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * ANIMATION_SMOOTHING_FACTOR;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * ANIMATION_SMOOTHING_FACTOR;
    }
    
    // Mark positions as needing update
    particleGeometry.attributes.position.needsUpdate = true;
}

// ==========================================
// Initialize Everything
// ==========================================
function init() {
    initThreeJS();
    initParticles();
    initGUI();
    initMediaPipe();
    animate();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
