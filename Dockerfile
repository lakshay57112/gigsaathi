# Stage 1: build the React frontend
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime serving the API and the built frontend
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
COPY --from=frontend /build/dist frontend/dist

# Run as a non-root user; /data holds the SQLite file.
RUN useradd --create-home appuser && mkdir /data && chown appuser /data
USER appuser
ENV DATABASE_PATH=/data/gigsaathi.db

WORKDIR /app/backend
EXPOSE 8080
# Cloud Run and most hosts pass the port in $PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
