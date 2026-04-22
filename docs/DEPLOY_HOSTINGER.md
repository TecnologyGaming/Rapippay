# 🚀 Guía de Despliegue en Hostinger VPS

## ⚠️ IMPORTANTE: Configurar URL del Backend

Antes de hacer deploy, **DEBES** editar el archivo `docker-compose.yml` y cambiar la URL del backend por la de tu servidor:

```yaml
frontend:
  build:
    args:
      - EXPO_PUBLIC_BACKEND_URL=http://TU-DOMINIO-O-IP:8001
```

**Ejemplo:**
- Si tu servidor es `srv1569869.hstgr.cloud`, usa:
  ```yaml
  - EXPO_PUBLIC_BACKEND_URL=http://srv1569869.hstgr.cloud:8001
  ```

## Paso 1: Conectar al VPS

```bash
ssh root@TU_IP_DEL_VPS
```

## Paso 2: Instalar Docker (si no está instalado)

```bash
curl -fsSL https://get.docker.com | sh
```

## Paso 3: Clonar el repositorio

```bash
cd /docker
git clone https://github.com/TecnologyGaming/Rapippay.git rapippay
cd rapippay
```

## Paso 4: ⚠️ EDITAR docker-compose.yml

```bash
nano docker-compose.yml
```

Busca esta línea:
```yaml
- EXPO_PUBLIC_BACKEND_URL=http://srv1569869.hstgr.cloud:8001
```

**Cámbiala por tu dominio o IP real:**
```yaml
- EXPO_PUBLIC_BACKEND_URL=http://TU-DOMINIO:8001
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`

## Paso 5: Levantar los contenedores

```bash
docker compose up -d --build
```

## Paso 6: Verificar

```bash
docker compose ps
```

Todos los servicios deben estar "Up" y "healthy".

## URLs de acceso

| Servicio | URL |
|----------|-----|
| **App** | `http://TU-DOMINIO:3001` |
| **Admin** | `http://TU-DOMINIO:3001/admin` |
| **API** | `http://TU-DOMINIO:8001` |

## Credenciales Admin

- **Usuario:** `admin`
- **Contraseña:** `admin123`

## Comandos útiles

```bash
# Ver logs
docker compose logs -f

# Ver solo logs del backend
docker compose logs -f backend

# Reiniciar todo
docker compose restart

# Reconstruir después de cambios
docker compose up -d --build

# Detener todo
docker compose down
```

## Solución de problemas

### El frontend carga pero se queda en blanco después del login
**Causa:** La URL del backend está mal configurada.
**Solución:** 
1. Edita `docker-compose.yml`
2. Cambia `EXPO_PUBLIC_BACKEND_URL` por tu dominio real
3. Ejecuta: `docker compose up -d --build`

### El backend no arranca
```bash
docker compose logs backend
```

### MongoDB no arranca
```bash
docker compose logs mongodb
```

## Abrir puertos en firewall

Si usas UFW:
```bash
ufw allow 3001
ufw allow 8001
```
