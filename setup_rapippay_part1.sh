#!/bin/bash
# Script de instalación completo para Rapippay
# Ejecutar en el VPS: bash setup_rapippay.sh

set -e

echo "=== Creando estructura de directorios ==="
mkdir -p /docker/rapippay/backend /docker/rapippay/frontend

echo "=== Creando docker-compose.yml ==="
cat > /docker/rapippay/docker-compose.yml <<'EOF'
services:
  mongodb:
    image: mongo:7.0
    container_name: rapippay-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - rapippay-network

  backend:
    build:
      context: ./backend
    container_name: rapippay-backend
    restart: unless-stopped
    depends_on:
      - mongodb
    env_file:
      - ./backend/.env
    ports:
      - "8001:8001"
    networks:
      - rapippay-network

  frontend:
    build:
      context: ./frontend
    container_name: rapippay-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "3000:3000"
    networks:
      - rapippay-network

volumes:
  mongodb_data:

networks:
  rapippay-network:
    driver: bridge
EOF

echo "=== Creando backend/requirements.txt ==="
cat > /docker/rapippay/backend/requirements.txt <<'EOF'
fastapi==0.110.1
uvicorn==0.25.0
motor==3.3.1
pymongo==4.5.0
python-dotenv==1.2.1
pydantic==2.12.5
passlib==1.7.4
bcrypt==4.1.3
python-jose==3.5.0
PyJWT==2.11.0
httpx==0.28.1
python-multipart==0.0.22
cryptography==46.0.5
email-validator==2.1.0
EOF

echo "=== Creando backend/.env ==="
cat > /docker/rapippay/backend/.env <<'EOF'
MONGO_URL=mongodb://mongodb:27017
DB_NAME=zinli_recargas
EOF

echo "=== Creando backend/Dockerfile ==="
cat > /docker/rapippay/backend/Dockerfile <<'EOF'
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
EOF

echo "=== Creando frontend/Dockerfile ==="
cat > /docker/rapippay/frontend/Dockerfile <<'EOF'
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
COPY yarn.lock* package-lock.json* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY . .

RUN npx expo export --platform web

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
EOF

echo "=== Creando backend/server.py ==="
echo "Este archivo es muy grande, se creará a continuación..."
