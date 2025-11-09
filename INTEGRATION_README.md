# Face Centering Integration

This integration adds automated face centering with alert-triggered servo control to the "Stop! Don't Go On" app.

## How It Works

### Normal Operation

- **Port 9 Servo**: Continuously tracks and centers your face using the camera
- **Python Backend**: Runs face detection using OpenCV and sends positioning commands to Arduino
- **React Frontend**: Shows the original app interface with integrated face centering status

### Alert Mode (Math Challenge)

- **When math challenge appears**: Automatically triggers continuous servo looping on **Port 10**
- **Servo 10 loops continuously** until the math challenge is solved or dismissed
- **Port 9 continues face tracking** in the background (paused during alert)
- **When alert ends**: Port 10 stops looping, Port 9 resumes normal face centering

## Quick Start

### 1. Setup (First Time Only)

```bash
./setup.sh
```

### 2. Start the System

**Terminal 1 - Backend:**

```bash
./start_backend.sh
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

### 3. Open Browser

Navigate to `http://localhost:3000`

## Hardware Setup

### Arduino Connections

```
Arduino:
├── Pin 9  → Main Servo (face centering)
├── Pin 10 → Alert Servo (loops during math challenges)
├── GND    → Both servo grounds
└── 5V     → Both servo power
```

### Upload Arduino Code

Upload `arduino_code.ino` to your Arduino using Arduino IDE.

## System Behavior

### Face Centering (Pin 9)

- ✅ **Always active** when system is running
- 🎯 **Smoothly centers** your face in the camera view
- 📊 **Adjustable smoothing** factor for stable tracking
- 🔄 **Automatically resumes** after alerts

### Alert Mode (Pin 10)

- 🚨 **Triggered automatically** when math challenge appears
- 🌀 **Continuous spinning/movement** until challenge is solved
- ⏹️ **Stops immediately** when alert is dismissed
- 🔁 **No manual intervention** required

### Demo Mode

- 🖥️ **Works without Arduino** connected
- 📝 **Logs all commands** to console for testing
- 📹 **Face detection still active** for development

## Technical Details

### Architecture

```
React App (Port 3000)
    ↕️ HTTP/REST API
Python Backend (Port 5000)
    ↕️ Serial Communication
Arduino (USB Serial)
    ↕️ PWM Signals
Servo Motors (Pin 9 & 10)
```

### API Endpoints

- `GET /api/status` - System status
- `POST /api/start_tracking` - Start face tracking
- `POST /api/start_alert` - Start alert mode (auto-triggered)
- `POST /api/stop_alert` - Stop alert mode (auto-triggered)

### Key Integration Points

1. **Math Challenge Detection**: React app watches `mathChallenge` state
2. **Automatic Alert Trigger**: When `mathChallenge` becomes active → API call to start alert mode
3. **Automatic Alert Stop**: When `mathChallenge` is resolved → API call to stop alert mode
4. **Background Tracking**: Pin 9 servo continues normal operation throughout

## Troubleshooting

### Backend Issues

- **"No camera found"**: Check camera permissions and connections
- **"Arduino not found"**: System runs in demo mode, check USB connection
- **"Port already in use"**: Make sure no other Python processes are running on port 5000

### Frontend Issues

- **"Cannot connect to backend"**: Make sure `./start_backend.sh` is running
- **Math challenge not triggering servos**: Check browser console for API errors

### Arduino Issues

- **Servos not moving**: Check power supply (5V) and ground connections
- **Erratic movement**: Ensure proper PWM connections to pins 9 and 10
- **Communication errors**: Verify baud rate (9600) and USB cable

## Features

- 🎯 **Automatic face centering** during normal use
- 🚨 **Alert-triggered servo control** during math challenges
- 🔄 **Seamless integration** with existing app functionality
- 📱 **No additional UI** required - works in background
- 🖥️ **Demo mode support** for development without hardware
- ⚙️ **Configurable smoothing** for optimal tracking
- 📊 **Real-time status monitoring** and logging

## Files

- `backend/face_centering_api.py` - Python Flask API server
- `backend/requirements.txt` - Python dependencies
- `arduino_code.ino` - Arduino sketch for servo control
- `setup.sh` - One-time setup script
- `start_backend.sh` - Backend startup script
- `App.tsx` - Modified React app with integration

The system is designed to work seamlessly with your existing app - just start both servers and the face centering will automatically integrate with your math challenge alerts!
