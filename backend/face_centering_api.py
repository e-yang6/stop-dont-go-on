#!/usr/bin/env python3
"""
Face Centering API with Alert Integration
Extends the original face centering system to support alert-triggered servo looping
"""

import cv2
import serial
import time
import sys
import json
import base64
import threading
import pygame
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app, origins=["*"])  # Allow all origins for development

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FaceCenteringWithAlert:
    def __init__(self, arduino_port='/dev/cu.usbserial-2120'):
        # Arduino connection
        self.arduino = None
        self.connect_arduino(arduino_port)

        # Camera and face detection
        self.camera = self.initialize_camera()
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

        # Tracking state
        self.frame_count = 0
        self.last_face_x = None
        self.smoothing_factor = 0.7
        self.is_tracking = False

        # Alert state
        self.alert_active = False
        self.alert_loop_thread = None
        self.alert_loop_running = False

        # Audio state
        self.audio_thread = None
        self.audio_running = False
        self.audio_file_path = os.path.join(os.path.dirname(__file__), 'alert-audio.mp3')

        # Initialize pygame mixer for audio
        try:
            pygame.mixer.init()
            if os.path.exists(self.audio_file_path):
                logger.info(f"✅ Audio file found: {self.audio_file_path}")
            else:
                logger.warning(f"⚠️  Audio file not found: {self.audio_file_path}")
        except Exception as e:
            logger.warning(f"⚠️  Audio initialization failed: {e}")

        # Threading
        self.tracking_thread = None
        self.tracking_running = False

        logger.info("Face Centering with Alert Integration initialized")

    def connect_arduino(self, port):
        """Connect to Arduino with error handling"""
        try:
            self.arduino = serial.Serial(port, 9600, timeout=1)
            time.sleep(2)
            logger.info(f"Arduino connected on: {port}")
            return True
        except serial.SerialException:
            logger.warning(f"Arduino not found on {port}")
            # Try alternative ports
            alt_ports = ['/dev/cu.usbmodem*', '/dev/ttyUSB0', '/dev/ttyACM0']
            for alt_port in alt_ports:
                try:
                    import glob
                    ports = glob.glob(alt_port)
                    for p in ports:
                        self.arduino = serial.Serial(p, 9600, timeout=1)
                        time.sleep(2)
                        logger.info(f"Arduino connected on: {p}")
                        return True
                except:
                    continue

            logger.info("Running in demo mode (no Arduino)")
            return False

    def initialize_camera(self):
        """Initialize camera with optimal settings and conflict detection"""
        logger.info("🔍 Checking camera availability...")

        # Check for common apps that might be using camera
        import subprocess
        try:
            # Check for processes that commonly use camera
            result = subprocess.run(['pgrep', '-f', '(FaceTime|Photo Booth|Zoom|Teams|Skype)'],
                                   capture_output=True, text=True)
            if result.stdout.strip():
                logger.warning("⚠️  Camera may be in use by another application")
                logger.info("💡 Try closing FaceTime, Photo Booth, Zoom, or other camera apps")
        except:
            pass

        for cam_id in [0, 1, 2]:
            logger.info(f"🎥 Trying camera {cam_id}...")
            try:
                cap = cv2.VideoCapture(cam_id)

                if cap.isOpened():
                    # Test if camera is actually available (not just opened)
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    cap.set(cv2.CAP_PROP_FPS, 30)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                    # Try to read a frame to verify camera works
                    for attempt in range(3):  # Try 3 times
                        ret, frame = cap.read()
                        if ret and frame is not None and frame.size > 0:
                            logger.info(f"✅ Camera {cam_id} initialized successfully")
                            logger.info(f"📏 Resolution: {frame.shape[1]}x{frame.shape[0]}")
                            return cap
                        time.sleep(0.1)

                    logger.warning(f"⚠️  Camera {cam_id} opened but can't read frames (may be in use)")
                    cap.release()
                else:
                    logger.warning(f"❌ Camera {cam_id} could not be opened")

            except Exception as e:
                logger.warning(f"❌ Camera {cam_id} error: {e}")
                try:
                    cap.release()
                except:
                    pass

        logger.error("❌ No camera available!")
        logger.info("💡 Troubleshooting tips:")
        logger.info("   • Close other apps using camera (FaceTime, Photo Booth, etc.)")
        logger.info("   • Check camera permissions in System Preferences")
        logger.info("   • Try running: sudo pkill -f 'VDCAssistant|AppleCameraAssistant'")
        logger.info("   • System will continue in demo mode")
        return None

    def detect_face(self, frame):
        """Detect face and return center X coordinate"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
            maxSize=(300, 300)
        )

        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
            face_center_x = x + w // 2
            return face_center_x

        return None

    def send_to_arduino(self, command):
        """Send command to Arduino"""
        if self.arduino:
            try:
                if isinstance(command, str):
                    self.arduino.write(f"{command}\r".encode())
                else:
                    self.arduino.write(f"{command}\r".encode())
                return True
            except serial.SerialException as e:
                logger.error(f"Arduino communication error: {e}")
                return False
        else:
            logger.info(f"Demo mode: Command={command}")
            return True

    def smooth_coordinate(self, new_x):
        """Apply smoothing to reduce jitter"""
        if self.last_face_x is None:
            self.last_face_x = new_x
            return new_x

        smoothed = int(self.smoothing_factor * self.last_face_x +
                     (1 - self.smoothing_factor) * new_x)
        self.last_face_x = smoothed
        return smoothed

    def face_tracking_loop(self):
        """Continuous face tracking loop"""
        logger.info("Starting face tracking loop")

        while self.tracking_running:
            if not self.camera:
                time.sleep(0.1)
                continue

            ret, frame = self.camera.read()
            if not ret:
                time.sleep(0.1)
                continue

            self.frame_count += 1
            frame = cv2.flip(frame, 1)  # Mirror effect

            # Only do face tracking if not in alert mode
            if not self.alert_active:
                face_x = self.detect_face(frame)

                if face_x is not None:
                    smooth_x = self.smooth_coordinate(face_x)

                    # Send to Arduino every few frames
                    if self.frame_count % 2 == 0:
                        self.send_to_arduino(smooth_x)

            time.sleep(0.033)  # ~30 FPS

        logger.info("Face tracking loop stopped")

    def alert_servo_loop(self):
        """Continuous servo looping during alert"""
        logger.info("Starting alert servo loop on pin 10")

        while self.alert_loop_running:
            # Send SPIN command to trigger servo 10 movement
            self.send_to_arduino("SPIN")

            # Wait a bit before next spin (adjust timing as needed)
            time.sleep(2)  # 2 second delay between spins

        logger.info("Alert servo loop stopped")

    def audio_loop(self):
        """Continuous audio looping during alert"""
        logger.info("🔊 Starting audio alert loop")

        if not os.path.exists(self.audio_file_path):
            logger.error(f"❌ Audio file not found: {self.audio_file_path}")
            return

        try:
            # Load and play the audio file with infinite looping
            pygame.mixer.music.load(self.audio_file_path)
            pygame.mixer.music.play(-1)  # -1 means loop indefinitely

            # Just wait while audio should be running
            while self.audio_running:
                time.sleep(0.1)

            # Stop audio when loop ends
            pygame.mixer.music.stop()
            logger.info("🔇 Audio alert loop stopped")

        except Exception as e:
            logger.error(f"❌ Audio playback error: {e}")
            pygame.mixer.music.stop()  # Ensure we stop on error

    def start_tracking(self):
        """Start face tracking"""
        if self.tracking_running:
            return False

        self.tracking_running = True
        self.tracking_thread = threading.Thread(target=self.face_tracking_loop)
        self.tracking_thread.daemon = True
        self.tracking_thread.start()

        logger.info("Face tracking started")
        return True

    def stop_tracking(self):
        """Stop face tracking"""
        self.tracking_running = False
        if self.tracking_thread:
            self.tracking_thread.join(timeout=2)
        logger.info("Face tracking stopped")

    def start_alert_mode(self):
        """Start alert mode - triggers continuous servo looping"""
        if self.alert_loop_running:
            return False

        self.alert_active = True
        self.alert_loop_running = True

        # Start the alert servo loop
        self.alert_loop_thread = threading.Thread(target=self.alert_servo_loop)
        self.alert_loop_thread.daemon = True
        self.alert_loop_thread.start()

        # Start the audio loop
        self.audio_running = True
        self.audio_thread = threading.Thread(target=self.audio_loop)
        self.audio_thread.daemon = True
        self.audio_thread.start()

        logger.info("🚨 Alert mode started - servo 10 looping + audio playing")
        return True

    def stop_alert_mode(self):
        """Stop alert mode - stops servo looping, resumes face tracking"""
        self.alert_loop_running = False
        self.alert_active = False

        if self.alert_loop_thread:
            self.alert_loop_thread.join(timeout=3)

        # Stop audio
        self.audio_running = False

        # Force stop pygame music immediately
        try:
            pygame.mixer.music.stop()
        except:
            pass

        if self.audio_thread:
            self.audio_thread.join(timeout=3)

        logger.info("✅ Alert mode stopped - resuming face tracking, audio stopped")
        return True

    def get_status(self):
        """Get current system status"""
        return {
            'camera_available': self.camera is not None,
            'arduino_connected': self.arduino is not None,
            'tracking_active': self.tracking_running,
            'alert_mode': self.alert_active,
            'smoothing_factor': self.smoothing_factor
        }

    def cleanup(self):
        """Clean up resources"""
        self.stop_tracking()
        self.stop_alert_mode()

        # Force stop all audio
        try:
            pygame.mixer.music.stop()
            pygame.mixer.quit()
        except:
            pass

        if self.camera:
            self.camera.release()
        if self.arduino:
            self.arduino.close()

        logger.info("Cleanup complete")

# Global instance
face_system = FaceCenteringWithAlert()

# API Routes

@app.route('/', methods=['GET'])
def home():
    """Basic test endpoint"""
    return jsonify({
        'message': 'Face Centering API Server',
        'status': 'running',
        'endpoints': [
            '/api/status',
            '/api/start_tracking',
            '/api/stop_tracking',
            '/api/start_alert',
            '/api/stop_alert',
            '/api/spin_once',
            '/api/settings'
        ]
    })

@app.route('/api/test', methods=['GET'])
def test():
    """Simple test endpoint"""
    return jsonify({'message': 'API is working!', 'timestamp': time.time()})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status"""
    return jsonify(face_system.get_status())

@app.route('/api/start_tracking', methods=['POST'])
def start_tracking():
    """Start face tracking"""
    success = face_system.start_tracking()
    return jsonify({'success': success})

@app.route('/api/stop_tracking', methods=['POST'])
def stop_tracking():
    """Stop face tracking"""
    face_system.stop_tracking()
    return jsonify({'success': True})

@app.route('/api/start_alert', methods=['POST'])
def start_alert():
    """Start alert mode (continuous servo looping)"""
    success = face_system.start_alert_mode()
    return jsonify({'success': success})

@app.route('/api/stop_alert', methods=['POST'])
def stop_alert():
    """Stop alert mode (resume normal tracking)"""
    success = face_system.stop_alert_mode()
    return jsonify({'success': success})

@app.route('/api/spin_once', methods=['POST'])
def spin_once():
    """Trigger single spin sequence"""
    success = face_system.send_to_arduino("SPIN")
    return jsonify({'success': success})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update face centering settings"""
    try:
        data = request.get_json()

        if 'smoothing_factor' in data:
            smoothing = float(data['smoothing_factor'])
            if 0.0 <= smoothing <= 1.0:
                face_system.smoothing_factor = smoothing
            else:
                return jsonify({'error': 'Smoothing factor must be between 0.0 and 1.0'}), 400

        return jsonify({
            'success': True,
            'smoothing_factor': face_system.smoothing_factor
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    try:
        logger.info("Starting Face Centering API with Alert Integration...")
        logger.info("Server will run on http://0.0.0.0:5007")
        logger.info("Access via: http://localhost:5007")

        # Start the server with more permissive settings
        app.run(
            host='0.0.0.0',  # Accept connections from any IP
            port=5007,  # Use port 5007 to avoid conflicts
            debug=True,
            threaded=True,
            use_reloader=False  # Prevent double initialization in debug mode
        )

    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
    finally:
        face_system.cleanup()
