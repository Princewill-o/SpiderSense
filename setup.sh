#!/bin/bash

echo "🕷️  SpiderSense Setup Script"
echo "=============================="

# Backend setup
echo "📦 Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn opencv-python numpy ultralytics websockets python-multipart
cd ..

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "To run the application:"
echo "1. Terminal 1: cd backend && source venv/bin/activate && python main.py"
echo "2. Terminal 2: cd frontend && npm run dev"
echo "3. Open http://localhost:3000"
