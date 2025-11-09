#!/bin/bash

# Alternative startup script using simple API for testing
echo "🧪 Starting Simple Face Centering API (Demo Mode)..."

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

echo "✅ Using simple API mode for testing"

# Start the simple API server
echo ""
echo "🚀 Starting Simple Face Centering API server..."
echo "🌐 Server will be available at: http://localhost:5001"
echo "🔧 This is demo mode - no camera or Arduino required"
echo ""
echo "🎯 Test the integration:"
echo "   1. Open http://localhost:5001 in browser to verify server"
echo "   2. Start the React app with: npm run dev"
echo "   3. Math challenges will trigger demo alert mode"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python simple_api.py
