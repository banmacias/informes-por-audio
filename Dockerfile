FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY backend/ ./backend/
COPY tools/ ./tools/

WORKDIR /app/backend

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
