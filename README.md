# Gesture Particle 3D

A real-time interactive 3D particle system using Three.js controlled by hand gestures via MediaPipe.

## Features

- **4500 particles** with smooth animation and additive blending
- **Shape morphing** between Sphere and Box shapes
- **Gesture control** via webcam hand tracking:
  - **Pinch** (close thumb & index finger): Contract particles
  - **Release** (open fingers): Expand particles
- **Customizable** via lil-gui control panel:
  - Particle color picker
  - Shape selector (Sphere/Box)
  - Particle size slider
  - Rotation speed control
  - Webcam visibility toggle

## Technology Stack

- **Three.js** - 3D rendering
- **MediaPipe Hands** - Hand tracking and gesture recognition
- **lil-gui** - User interface controls

## Usage

1. Open `index.html` in a modern web browser
2. Allow camera access when prompted
3. Show your hand to the camera
4. Pinch your thumb and index finger together to contract particles
5. Spread your fingers apart to expand particles
6. Use the control panel (top right) to customize appearance

## File Structure

```
├── index.html   # Main HTML file with CDN scripts
├── style.css    # Styles for full-screen layout and UI
├── script.js    # Main application logic
└── README.md    # This file
```

## Browser Requirements

- Modern browser with WebGL support
- Camera/webcam access
- Internet connection (for CDN scripts)