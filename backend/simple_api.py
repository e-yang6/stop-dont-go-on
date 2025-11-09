#!/usr/bin/env python3
"""
Simple Face Centering API Server
Minimal version for testing and troubleshooting
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow all origins

# Simple state tracking
server_state = {
    'tracking_active': False,
    'alert_mode': False,
    'arduino_connected': False,
    'camera_available': False
}

@app.route('/', methods=['GET'])
def home():
    """Home page"""
    return jsonify({
        'message': 'Face Centering API Server - Simple Mode',
        'status': 'running',
        'timestamp': time.time(),
        'endpoints': {
            'GET /': 'This page',
            'GET /api/status': 'Get system status',
            'POST /api/start_tracking': 'Start face tracking',
            'POST /api/stop_tracking': 'Stop face tracking',
            'POST /api/start_alert': 'Start alert mode',
            'POST /api/stop_alert': 'Stop alert mode',
            'POST /api/spin_once': 'Single spin command'
        }
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status"""
    return jsonify({
        'camera_available': server_state['camera_available'],
        'arduino_connected': server_state['arduino_connected'],
        'tracking_active': server_state['tracking_active'],
        'alert_mode': server_state['alert_mode'],
        'smoothing_factor': 0.7,
        'timestamp': time.time()
    })

@app.route('/api/start_tracking', methods=['POST'])
def start_tracking():
    """Start face tracking (demo mode)"""
    server_state['tracking_active'] = True
    logger.info("Face tracking started (demo mode)")
    return jsonify({'success': True, 'message': 'Face tracking started'})

@app.route('/api/stop_tracking', methods=['POST'])
def stop_tracking():
    """Stop face tracking"""
    server_state['tracking_active'] = False
    logger.info("Face tracking stopped")
    return jsonify({'success': True, 'message': 'Face tracking stopped'})

@app.route('/api/start_alert', methods=['POST'])
def start_alert():
    """Start alert mode (continuous servo looping)"""
    server_state['alert_mode'] = True
    logger.info("🚨 Alert mode started - servo 10 would be looping continuously")
    return jsonify({'success': True, 'message': 'Alert mode started'})

@app.route('/api/stop_alert', methods=['POST'])
def stop_alert():
    """Stop alert mode (resume normal tracking)"""
    server_state['alert_mode'] = False
    logger.info("✅ Alert mode stopped - resuming normal face tracking")
    return jsonify({'success': True, 'message': 'Alert mode stopped'})

@app.route('/api/spin_once', methods=['POST'])
def spin_once():
    """Trigger single spin sequence"""
    logger.info("🌀 Single spin command triggered (demo mode)")
    return jsonify({'success': True, 'message': 'Spin command sent'})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update face centering settings"""
    try:
        data = request.get_json() or {}
        logger.info(f"Settings update: {data}")
        return jsonify({'success': True, 'message': 'Settings updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found', 'available_endpoints': [
        '/', '/api/status', '/api/start_tracking', '/api/stop_tracking',
        '/api/start_alert', '/api/stop_alert', '/api/spin_once', '/api/settings'
    ]}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error', 'message': str(error)}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting Simple Face Centering API Server...")
    logger.info("📡 Server running on http://0.0.0.0:5002")
    logger.info("🌐 Access via: http://localhost:5002")
    logger.info("🔧 This is demo mode - no hardware required")
    logger.info("")
    logger.info("Available endpoints:")
    logger.info("  GET  /           - Server info")
    logger.info("  GET  /api/status - System status")
    logger.info("  POST /api/start_alert - Start alert mode")
    logger.info("  POST /api/stop_alert  - Stop alert mode")
    logger.info("")

    try:
        app.run(
            host='0.0.0.0',
            port=5002,  # Use port 5002 to avoid conflicts
            debug=False,  # Disable debug mode for cleaner output
            threaded=True
        )
    except Exception as e:
        logger.error(f"❌ Server startup error: {e}")
        logger.info("💡 Try checking if port 5000 is already in use")
        logger.info("   Run: lsof -i :5000  to check for conflicts")
