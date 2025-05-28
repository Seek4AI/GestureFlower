# Interactive Flower Blooming Experience

An interactive web application that allows users to control flower blooming animations through hand gestures. By opening and closing your hand in front of your camera, you can control the blooming progress of various flowers, creating a natural and engaging human-computer interaction experience.

*[中文版说明](README_zh.md)*

## Features

- Hand gesture control of flower blooming animations
- WebGL-based high-performance rendering
- Frame extraction for smooth interaction
- Multiple flower videos to choose from
- Fullscreen mode support
- Camera toggle option
- Mouse control fallback when camera is unavailable
- Pure frontend implementation, deployable to GitHub Pages

## How It Works

1. Open the application in a browser and allow camera access
2. Hold your hand in front of the camera for detection
3. Open your hand fully to see the flower fully bloom
4. Close your hand partially to see intermediate blooming stages
5. Choose different flowers from the dropdown menu
6. Use fullscreen button for an immersive experience
7. Toggle camera visibility as needed

## Technical Implementation

### Core Technologies

- **MediaPipe Hands API**: For real-time hand tracking and gesture recognition
- **WebGL**: For high-performance video rendering as textures
- **Frame Extraction**: Preprocesses videos into image sequences for smoother interaction
- **Vanilla JavaScript**: No frameworks required, built with pure JavaScript

### Architecture

The application consists of several key components:

1. **Frame Extractor**: Converts videos into memory-cached image sequences
   - Extracts frames at specific intervals from the source video
   - Stores frames in memory for immediate access
   - Enables smooth transitions between frames without video seeking

2. **Image Sequence Renderer**: WebGL-based renderer for the extracted frames
   - Uses WebGL for hardware-accelerated rendering
   - Renders images directly as textures for optimal performance
   - Maintains smooth frame rate regardless of interaction speed

3. **Hand Tracking System**: Processes camera input for gesture detection
   - Calculates hand openness based on finger positions
   - Uses the middle finger's extension as primary measurement
   - Implements smoothing to prevent jittering

4. **Mouse Control Fallback**: Alternative interaction method
   - Automatically activates when camera access is unavailable
   - Uses mouse Y-position to simulate hand openness
   - Provides comparable experience without requiring camera permissions

### Performance Optimizations

- Pre-extracting video frames eliminates seeking latency
- WebGL rendering for hardware acceleration
- Debounced hand position updates to reduce unnecessary processing
- Progressive loading with visual feedback
- Smooth interpolation of hand openness values

## Running Locally

Due to browser security policies, accessing the camera requires serving the files through a web server:

```bash
# Using Python 3.x
python -m http.server 8000

# Or using Node.js (with http-server package)
npx http-server -p 8000
```
Then visit http://localhost:8000 in your browser.

Note: Camera access typically only works on secure contexts (HTTPS) or localhost. When accessing via local network IP, the application will automatically fall back to mouse control mode.

# Media Sources
The flower videos are sourced from the Bilibili video: https://www.bilibili.com/video/BV1wg411g7xL/

