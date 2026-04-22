# Rapippay - Zinli Recargas & Gift Cards

Sistema completo de recargas Zinli y venta de Gift Cards con panel de administración.

## ✅ Checklist de Despliegue Docker

| Requisito | Estado | Descripción |
|-----------|--------|-------------|
| `docker-compose.yml` | ✅ | Orquestación de servicios |
| `Dockerfile` (backend) | ✅ | Imagen Python/FastAPI |
| `Dockerfile` (frontend) | ✅ | Imagen Node/Expo |
| `.env.example` | ✅ | Plantilla de variables |
| `.env` (backend) | ✅ | Variables configuradas |
| `README.md` | ✅ | Documentación |
| Puertos definidos | ✅ | 3001 (frontend), 8001 (backend), 27017 (MongoDB) |
| Volúmenes | ✅ | `mongodb_data` para persistencia |
| Dependencias | ✅ | `requirements.txt` y `package.json` |
| Healthcheck | ✅ | Backend y Frontend |
| `restart: unless-stopped` | ✅ | Reinicio automático |
| Redes Docker | ✅ | `zinli-network` |
| Logs | ✅ | `docker compose logs -f` |

## 🚀 Instalación Rápida

```bash
cd /docker
git clone https://github.com/TecnologyGaming/Rapippay.git rapippay
cd rapippay
docker compose up -d --build
```

## 📡 Puertos

| Puerto | Servicio | URL |
|--------|----------|-----|
| **3001** | Frontend (App Web) | `http://TU-IP:3001` |
| **8001** | Backend (API) | `http://TU-IP:8001` |
| **27017** | MongoDB | Solo interno |

## 🔐 Credenciales Admin

- **URL Admin:** `http://TU-IP:3001/admin`
- **Usuario:** `admin`
- **Contraseña:** `admin123`

## 📁 Estructura del Proyecto

```
rapippay/
├── docker-compose.yml          # Orquestación Docker
├── README.md                   # Esta documentación
├── backend/
│   ├── Dockerfile              # Imagen del backend
│   ├── server.py               # API FastAPI (65KB)
│   ├── requirements.txt        # Dependencias Python
│   ├── .env                    # Variables de entorno
│   └── .env.example            # Plantilla de variables
├── frontend/
│   ├── Dockerfile              # Imagen del frontend
│   ├── package.json            # Dependencias Node
│   ├── .env.example            # Plantilla de variables
│   └── app/                    # Código de la app
└── docs/
    └── DEPLOY_HOSTINGER.md     # Guía detallada
```

## 🐳 Comandos Docker

```bash
# Ver estado
docker compose ps

# Ver logs
docker compose logs -f

# Reiniciar
docker compose restart

# Detener
docker compose down

# Reconstruir
docker compose up -d --build

# Limpiar todo
docker compose down -v
```

## 🔧 Variables de Entorno

### Backend (`backend/.env`)
```env
MONGO_URL=mongodb://mongodb:27017/zinli_recargas
DB_NAME=zinli_recargas
JWT_SECRET_KEY=tu-clave-secreta
ADMIN_SECRET=zinli-admin-2024
```

### Frontend (en `docker-compose.yml`)
```env
EXPO_PUBLIC_BACKEND_URL=http://backend:8001
NODE_ENV=production
PORT=3001
```

## 🌐 Configurar Dominio (Opcional)

### Con Nginx Proxy Inverso

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL con Certbot
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d tudominio.com
```

## 📱 Características

### Para Usuarios
- ✅ Registro e inicio de sesión
- ✅ Calculadora de recargas Zinli
- ✅ Múltiples métodos de pago
- ✅ Tienda de Gift Cards
- ✅ Historial de pedidos
- ✅ Perfil editable

### Panel Admin
- ✅ Gestión de pedidos
- ✅ Gestión de usuarios
- ✅ Banners rotativos
- ✅ Métodos de pago
- ✅ Branding (logo/favicon)
- ✅ CRUD de Gift Cards
- ✅ Push Notifications
- ✅ Configuración de tasas

## 📞 Soporte

Documentación adicional en `docs/DEPLOY_HOSTINGER.md`
