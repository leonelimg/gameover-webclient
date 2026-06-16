# Guia Rapida de Despliegue en Debian (Frontend + Backend)

Esta guia te permite publicar GameOver en un servidor Debian con dos caminos:

1. Opcion recomendada: Docker Compose (mas simple y reproducible).
2. Opcion alternativa: sin Docker (Node.js + systemd + Nginx).

## 1) Opcion Recomendada: Docker Compose

### Requisitos

- Debian 12 (o similar)
- Usuario con permisos sudo
- Dominio apuntando al servidor (opcional, recomendado)

### 1.1 Instalar Docker y Compose

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 1.2 Clonar proyecto y preparar entorno

```bash
cd /opt
sudo git clone <URL_DEL_REPO> gameover-webclient
sudo chown -R $USER:$USER /opt/gameover-webclient
cd /opt/gameover-webclient

cp server/.env.example server/.env
```

Edita `server/.env` y cambia como minimo:

- `NODE_ENV=production`
- `JWT_SECRET` y `JWT_REFRESH_SECRET` con valores largos y unicos
- `CORS_ORIGIN` con tu dominio real (ejemplo: `https://app.tudominio.com`)

Si el frontend sera servido en el mismo dominio, tambien puedes ajustar CORS al host principal.

### 1.3 Levantar servicios

```bash
docker compose up -d --build
docker compose ps
```

Servicios esperados:

- Frontend (nginx en contenedor): puerto `5173`
- API: puerto `4000`
- PostgreSQL: puerto `5432`

### 1.4 Verificar salud

```bash
curl -I http://127.0.0.1:5173
curl -I http://127.0.0.1:4000/api/auth/me
docker compose logs -f api
```

Nota: el endpoint `/api/auth/me` requiere token y puede responder `401`, lo cual indica que la API esta viva.

### 1.5 Actualizar a una nueva version

```bash
cd /opt/gameover-webclient
git pull
docker compose up -d --build
```

### 1.6 Comandos utiles

```bash
docker compose logs -f frontend
docker compose logs -f api
docker compose logs -f postgres
docker compose restart api
docker compose down
```

## 2) Opcion Alternativa: Sin Docker (systemd + Nginx)

Usa esta opcion si prefieres procesos nativos en Debian.

### 2.1 Instalar dependencias

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.2 Base de datos PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER gameover WITH PASSWORD 'gameover';"
sudo -u postgres psql -c "CREATE DATABASE gameover OWNER gameover;"
```

### 2.3 Backend

```bash
cd /opt
sudo git clone <URL_DEL_REPO> gameover-webclient
sudo chown -R $USER:$USER /opt/gameover-webclient

cd /opt/gameover-webclient/server
cp .env.example .env
```

Configura en `server/.env`:

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://gameover:gameover@localhost:5432/gameover?schema=public`
- `CORS_ORIGIN=https://app.tudominio.com`
- Secrets JWT seguros

Compila y prepara datos:

```bash
npm ci
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run build
```

Crear servicio systemd (`/etc/systemd/system/gameover-api.service`):

```ini
[Unit]
Description=GameOver API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/gameover-webclient/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gameover-api
sudo systemctl status gameover-api
```

### 2.4 Frontend

```bash
cd /opt/gameover-webclient
cp .env.example .env
```

Edita `.env`:

- `VITE_API_URL=https://app.tudominio.com`

Build de frontend:

```bash
npm ci
npm run build
```

Nginx (ejemplo `/etc/nginx/sites-available/gameover`):

```nginx
server {
    listen 80;
    server_name app.tudominio.com;

    root /opt/gameover-webclient/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/gameover /etc/nginx/sites-enabled/gameover
sudo nginx -t
sudo systemctl reload nginx
```

## 3) SSL con Let's Encrypt (Recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.tudominio.com
```

## 4) Checklist Rapido de Produccion

- Cambiar secrets JWT por valores robustos
- Restringir puertos con firewall (`ufw`)
- Configurar dominio y HTTPS
- Verificar backups de PostgreSQL
- Revisar logs (`docker compose logs` o `journalctl -u gameover-api -f`)

## 5) Solucion de Problemas Rapida

- API no inicia: valida `DATABASE_URL` y estado de PostgreSQL
- Front no conecta API: revisa `VITE_API_URL` y `CORS_ORIGIN`
- Error Prisma: ejecuta `npx prisma generate` y `npx prisma db push`
- Error de permisos en `/opt`: corregir con `chown -R`
