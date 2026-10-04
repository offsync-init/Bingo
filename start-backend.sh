#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    venv/bin/pip install -r requirements.txt
fi

echo "Starting Nepali Bingo FastAPI Backend on http://0.0.0.0:8000..."
source venv/bin/activate
export PYTHONPATH=.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
