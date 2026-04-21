# Rapippay - Zinli Recargas & Gift Cards

Sistema completo de recargas Zinli y venta de Gift Cards con panel de administración.

## 🚀 Despliegue en Hostinger (VPS con Docker)

### Requisitos previos
- VPS con Ubuntu 22.04+ 
- Docker y Docker Compose instalados
- Dominio apuntando al VPS (opcional)

### Instalación rápida

1. **Conectar al VPS por SSH:**
```bash
ssh root@tu-ip-del-vps
```

2. **Ejecutar el script de instalación:**
```bash
cd /docker
git clone https://github.com/TecnologyGaming/Rapippay.git rapippay
cd rapippay
docker-compose up -d --build
```

3. **Verificar que todo esté funcionando:**
```bash
docker-compose ps
```

### Estructura del proyecto
```
rapippay/
├── docker-compose.yml      # Orquestación de contenedores
├── backend/
│   ├── Dockerfile          # Imagen del backend
│   ├── server.py           # API FastAPI
│   ├── requirements.txt    # Dependencias Python
│   └── .env               # Variables de entorno
└── frontend/
    ├── Dockerfile          # Imagen del frontend
    ├── app/               # Pantallas de la app
    ├── src/               # Código fuente
    └── package.json       # Dependencias Node
```

### URLs de acceso

| Servicio | URL | Puerto |
|----------|-----|--------|
| Frontend (App) | http://tu-dominio:3000 | 3000 |
| Backend (API) | http://tu-dominio:8001 | 8001 |
| Admin Panel | http://tu-dominio:3000/admin | 3000 |
| MongoDB | localhost:27017 | 27017 |

### Credenciales por defecto

**Admin Panel:**
- URL: `/admin`
- Usuario: `admin`
- Contraseña: `admin123`

**API Admin Header:**
```
admin-secret: zinli-admin-2024
```

## 📱 Características

### Para Usuarios
- ✅ Registro e inicio de sesión
- ✅ Calculadora de recargas Zinli
- ✅ Múltiples métodos de pago (Pago Móvil, Transferencia, Binance, PayPal)
- ✅ Pago con tarjeta de crédito (Ubii Pago)
- ✅ Tienda de Gift Cards
- ✅ Historial de pedidos
- ✅ Perfil editable

### Panel de Administración
- ✅ Gestión de pedidos (aprobar/rechazar)
- ✅ Gestión de usuarios
- ✅ Banners rotativos
- ✅ Métodos de pago configurables
- ✅ Branding (logo y favicon)
- ✅ Información de contacto
- ✅ CRUD de Gift Cards
- ✅ Push Notifications
- ✅ Configuración de tasas de cambio

## 🔧 Configuración

### Variables de entorno del Backend (.env)
```env
MONGO_URL=mongodb://mongodb:27017
DB_NAME=zinli_recargas
JWT_SECRET_KEY=tu-clave-secreta-jwt
```

### Configurar Ubii Pago (Tarjeta de Crédito)
1. Ir a Admin Panel → Pagos
2. En "Tarjeta de Crédito (Ubii Pago)"
3. Ingresar el Client ID proporcionado por Ubii
4. Activar el método de pago

## 🐳 Comandos Docker útiles

```bash
# Ver logs del backend
docker-compose logs -f backend

# Ver logs del frontend
docker-compose logs -f frontend

# Reiniciar servicios
docker-compose restart

# Detener todo
docker-compose down

# Reconstruir e iniciar
docker-compose up -d --build

# Ver estado de contenedores
docker-compose ps
```

## 🔒 Seguridad

- Cambiar `JWT_SECRET_KEY` en producción
- Cambiar `admin-secret` en el código
- Configurar HTTPS con certificado SSL
- Usar firewall (ufw) para limitar puertos

## 📞 Soporte

Para soporte técnico, contactar al desarrollador.
