#!/bin/bash
# Spider-Sense AI — start both backend and frontend

echo "🕷 Starting Spider-Sense AI..."

# Install backend deps if needed
cd backend
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "Installing backend dependencies..."
  pip install fastapi "uvicorn[standard]" ultralytics opencv-python-headless "pydantic>=2.7" python-multipart websockets aiofiles
fi

# Start backend in background
echo "Starting backend on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Start frontend
cd ../frontend
echo "Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Spider-Sense AI running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both services."

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
