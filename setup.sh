#!/bin/bash

# Setup script for Face Centering Integration
echo "🚀 Setting up Face Centering Integration..."

# Navigate to the project directory
cd "$(dirname "$0")"

# Create backend directory if it doesn't exist
mkdir -p backend

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3 and try again."
    exit 1
fi

echo "✅ Python 3 found"

# Navigate to backend directory
cd backend

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating Python virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Python backend setup complete!"

# Navigate back to project root
cd ..

# Install Node.js dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

echo "✅ Node.js frontend setup complete!"

echo ""
echo "🎉 Setup complete! Ready to start the face centering system."
echo ""
echo "To start the system:"
echo "1. In one terminal, run: ./start_backend.sh"
echo "2. In another terminal, run: npm run dev"
echo ""
echo "The system will be available at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
echo ""
echo "⚠️ Make sure your camera and Arduino are connected!"
echo "   The system will work in demo mode without Arduino."
