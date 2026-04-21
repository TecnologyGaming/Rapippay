#!/bin/bash
# ===========================================
# Script de instalación Rapippay para Hostinger
# ===========================================
# 
# USO: 
#   chmod +x install_hostinger.sh
#   ./install_hostinger.sh
#
# ===========================================

set -e

echo "=========================================="
echo "  Instalación de Rapippay en Hostinger"
echo "=========================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si es root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Por favor ejecuta como root (sudo)${NC}"
    exit 1
fi

# Directorio de instalación
INSTALL_DIR="/docker/rapippay"

echo -e "${YELLOW}1. Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker no está instalado. Instalando...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose no está instalado. Instalando...${NC}"
    apt-get update
    apt-get install -y docker-compose-plugin
fi

echo -e "${GREEN}✓ Docker instalado${NC}"

echo -e "${YELLOW}2. Creando estructura de directorios...${NC}"
mkdir -p ${INSTALL_DIR}/backend
mkdir -p ${INSTALL_DIR}/frontend
echo -e "${GREEN}✓ Directorios creados${NC}"

echo -e "${YELLOW}3. Verificando archivos...${NC}"

# Verificar que existen los archivos necesarios
if [ ! -f "${INSTALL_DIR}/backend/server.py" ]; then
    echo -e "${RED}ERROR: Falta backend/server.py${NC}"
    echo "Asegúrate de que el repositorio esté completo"
    exit 1
fi

if [ ! -f "${INSTALL_DIR}/backend/requirements.txt" ]; then
    echo -e "${RED}ERROR: Falta backend/requirements.txt${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Archivos verificados${NC}"

echo -e "${YELLOW}4. Construyendo y levantando contenedores...${NC}"
cd ${INSTALL_DIR}
docker-compose down 2>/dev/null || true
docker-compose up -d --build

echo -e "${YELLOW}5. Esperando a que los servicios inicien...${NC}"
sleep 10

echo -e "${YELLOW}6. Verificando servicios...${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}=========================================="
echo "  ✓ Instalación completada!"
echo "==========================================${NC}"
echo ""
echo "URLs de acceso:"
echo "  - Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "  - Backend:  http://$(hostname -I | awk '{print $1}'):8001"
echo "  - Admin:    http://$(hostname -I | awk '{print $1}'):3000/admin"
echo ""
echo "Credenciales Admin:"
echo "  - Usuario: admin"
echo "  - Contraseña: admin123"
echo ""
echo "Comandos útiles:"
echo "  - Ver logs: docker-compose logs -f"
echo "  - Reiniciar: docker-compose restart"
echo "  - Detener: docker-compose down"
echo ""
