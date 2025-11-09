#!/bin/bash

# Start the Python backend server for face centering
echo "🚀 Starting Face Centering Backend Server..."

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run ./setup.sh first to set up the environment."
    exit 1
fi

# Activate virtual environment
echo "🔌 Activating Python virtual environment..."
source venv/bin/activate

# Check if required packages are installed
echo "🔍 Checking dependencies..."
python -c "import cv2, serial, flask, flask_cors" 2>/dev/null || {
    echo "❌ Missing dependencies!"
    echo "Please run ./setup.sh to install required packages."
    exit 1
}

echo "✅ All dependencies found"

# Start the Face Centering API server
echo ""
echo "🚀 Starting Face Centering API server on http://localhost:5000..."
echo "📹 Make sure your camera is connected!"
echo "🔌 Arduino connection is optional - will run in demo mode if not found"
echo ""
echo "🎯 System Features:"
echo "   • Normal face tracking on servo pin 9"
echo "   • Alert mode servo looping on pin 10 (during math challenges)"
echo "   • Automatic integration with React app"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python face_centering_api.py
