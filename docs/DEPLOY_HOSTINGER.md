# 🚀 Guía de Despliegue en Hostinger VPS

## Paso 1: Preparar el VPS

### Conectar por SSH
```bash
ssh root@TU_IP_DEL_VPS
```

### Instalar Docker (si no está instalado)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Instalar Docker Compose
```bash
apt-get update
apt-get install -y docker-compose-plugin
```

## Paso 2: Descargar el proyecto

### Opción A: Clonar desde GitHub
```bash
cd /docker
git clone https://github.com/TecnologyGaming/Rapippay.git rapippay
cd rapippay
```

### Opción B: Subir archivos manualmente
Si el repositorio no tiene todos los archivos, sube manualmente:
- `docker-compose.yml`
- `backend/Dockerfile`
- `backend/server.py`
- `backend/requirements.txt`
- `backend/.env`
- `frontend/` (toda la carpeta)

## Paso 3: Configurar variables de entorno

### Backend (.env)
```bash
nano /docker/rapippay/backend/.env
```

Contenido:
```env
MONGO_URL=mongodb://mongodb:27017
DB_NAME=zinli_recargas
```

## Paso 4: Iniciar los contenedores

```bash
cd /docker/rapippay
docker compose up -d --build
```

## Paso 5: Verificar que todo funciona

```bash
# Ver estado de contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Probar el backend
curl http://localhost:8001/api/config
```

## Paso 6: Configurar dominio (opcional)

### Con Nginx como proxy reverso

1. Instalar Nginx:
```bash
apt-get install nginx
```

2. Crear configuración:
```bash
nano /etc/nginx/sites-available/rapippay
```

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. Activar y reiniciar:
```bash
ln -s /etc/nginx/sites-available/rapippay /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Instalar SSL con Certbot
```bash
apt-get install certbot python3-certbot-nginx
certbot --nginx -d tudominio.com
```

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose ps` | Ver estado de contenedores |
| `docker compose logs -f` | Ver logs en tiempo real |
| `docker compose logs backend` | Ver solo logs del backend |
| `docker compose restart` | Reiniciar todos los servicios |
| `docker compose down` | Detener todo |
| `docker compose up -d --build` | Reconstruir e iniciar |
| `docker compose exec backend bash` | Entrar al contenedor del backend |
| `docker compose exec mongodb mongosh` | Conectar a MongoDB |

## Solución de problemas

### El backend no inicia
```bash
# Ver logs del backend
docker compose logs backend

# Verificar que MongoDB esté corriendo
docker compose ps mongodb
```

### Error de conexión a MongoDB
```bash
# Reiniciar MongoDB
docker compose restart mongodb

# Esperar 10 segundos y reiniciar backend
sleep 10
docker compose restart backend
```

### El frontend no carga
```bash
# Reconstruir frontend
docker compose build frontend
docker compose up -d frontend
```

### Limpiar todo y empezar de nuevo
```bash
docker compose down -v
docker compose up -d --build
```

## Puertos utilizados

| Puerto | Servicio |
|--------|----------|
| 3000 | Frontend (Expo Web) |
| 8001 | Backend (FastAPI) |
| 27017 | MongoDB |

Asegúrate de que estos puertos estén abiertos en el firewall de Hostinger.

## Credenciales por defecto

- **Admin Panel URL:** `/admin`
- **Usuario:** `admin`
- **Contraseña:** `admin123`

⚠️ **IMPORTANTE:** Cambia las credenciales en producción.
