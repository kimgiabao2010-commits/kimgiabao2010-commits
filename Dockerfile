# ======================================================================
# SWG Shield — Dockerfile (multi-service, single base image)
# Usage: docker-compose.yml passes CMD via `command:` override per service
# Base: python:3.10-slim (minimal footprint)
# ======================================================================

FROM python:3.10-slim

# System deps for torch / transformers / scipy (LIME requires scipy)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first (layer cache optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project (excluding large model binaries handled via volume)
COPY . .

# Default CMD — overridden by docker-compose per service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
