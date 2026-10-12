#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo " Starting Megh Setu AI Nowcasting Platform"
echo "=================================================="

# Check Python venv
if [ ! -d "backend/.venv" ]; then
    echo "Creating Python virtual environment in backend/.venv..."
    python3 -m venv backend/.venv
    ./backend/.venv/bin/pip install -r backend/requirements.txt
fi

# Check frontend node_modules
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo "Starting FastAPI Backend (port 8000)..."
(cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

echo "Starting Vite React Frontend (port 5173)..."
(cd frontend && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "Megh Setu is running locally!"
echo "Dashboard UI : http://localhost:5173"
echo "API Docs     : http://localhost:8000/docs"
echo "Health Check : http://localhost:8000/api/health"
echo "=================================================="
echo "Press Ctrl+C to stop both servers."

wait
