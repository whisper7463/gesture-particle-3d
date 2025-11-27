# Gesture Particle 3D

A real-time interactive 3D particle system using Three.js, controlled by hand gestures via MediaPipe Hands.

## Features

- **3D Particle System**: 4000+ particles rendered with Three.js
- **Shape Morphing**: Smooth transitions between Sphere and Cube shapes
- **Hand Gesture Control**: Use pinch gesture (thumb + index finger) to control particle spread
- **Real-time Webcam**: Mirrored webcam preview with hand landmark visualization
- **Customizable**: Change particle color and shape via GUI controls

## How to Use

1. Open `index.html` in a modern web browser
2. Allow camera access when prompted
3. Use your hand in front of the webcam:
   - **Pinch fingers together** → Particles form tight shape
   - **Spread fingers apart** → Particles explode outward
4. Use the GUI panel (top-right) to:
   - Change particle color
   - Switch between Sphere and Cube shapes

## Technical Details

- **Three.js**: WebGL-based 3D rendering
- **MediaPipe Hands**: Real-time hand landmark detection
- **lil-gui**: Lightweight GUI controls

## File Structure

```
├── index.html    # Main HTML with library imports
├── style.css     # Fullscreen layout and styling
├── script.js     # Three.js scene, MediaPipe, and animation logic
└── README.md     # This file
```

## Requirements

- Modern web browser with WebGL support
- Webcam for hand gesture control
- Internet connection (for CDN libraries)