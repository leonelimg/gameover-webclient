# GameOver — Sistema de Lotería 🎟️

Aplicación web completa para gestión de tickets de lotería (loto), con arquitectura escalable, control de usuarios por roles y jerarquía de asociados.

Guía de despliegue en Debian: ver `GUIA_RAPIDA_DESPLIEGUE_DEBIAN.md`.

---

## Arquitectura

```
gameover-webclient/
├── src/                      # Frontend — React + TypeScript + Vite
│   ├── components/           # Componentes reutilizables
│   ├── context/              # AuthContext (JWT + fallback localStorage)
│   ├── pages/                # Módulos de la aplicación
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── Users/
│   │   ├── Roles/
│   │   ├── Plans/
│   │   ├── Draws/
│   │   ├── Sales/
│   │   └── Reports/
│   ├── services/api.ts       # Cliente Axios + interceptores JWT
│   ├── types/                # TypeScript types compartidos
│   └── utils/                # Helpers y mock DB (localStorage)
│
├── server/                   # Backend — Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/           # Configuración, Prisma client, JWT utils
│   │   ├── middleware/       # Autenticación, autorización, validación
│   │   └── routes/           # auth, users, plans, draws, tickets, reports
│   └── prisma/
│       ├── schema.prisma     # Esquema PostgreSQL con Prisma ORM
│       └── seed.ts           # Datos iniciales de ejemplo
│
├── print-bridge/             # Servicio local de impresión ESC/POS (Bluetooth serial)
├── docker-compose.yml        # PostgreSQL + API + Frontend
├── Dockerfile.frontend
└── nginx.conf
```

---

## Stack Tecnológico

### Frontend
| Tecnología | Uso |
|---|---|
| **React 19 + TypeScript** | UI framework |
| **Vite** | Build tool |
| **Tailwind CSS v4** | Estilos |
| **React Router** | Navegación |
| **Axios** | HTTP client con interceptores JWT |

### Backend
| Tecnología | Uso |
|---|---|
| **Node.js + Express** | API REST |
| **TypeScript** | Tipado estático |
| **Prisma ORM** | Acceso a base de datos |
| **PostgreSQL** | Base de datos relacional |
| **JWT** | Autenticación (access + refresh tokens) |
| **bcryptjs** | Hash de contraseñas |
| **Zod** | Validación de esquemas |
| **Helmet + CORS** | Seguridad |

---

## Módulos

| Módulo | Descripción | Roles |
|---|---|---|
| **Login** | Autenticación JWT con refresh automático | Todos |
| **Dashboard** | Estadísticas en tiempo real, top números | Todos |
| **Usuarios** | CRUD completo, bloqueo, archivo, jerarquía | Admin, Asociado |
| **Roles** | Matriz de permisos por rol | Admin |
| **Planes** | Multiplicadores, comisiones, master asociado | Admin |
| **Sorteos** | Creación, horarios, números restringidos | Admin |
| **Ventas** | Registro de apuestas con validaciones | Todos |
| **Reportes** | Estadísticas jerárquicas, top 10 números | Admin, Asociado |

---

## Desarrollo Local

### Opción A — Con Docker (recomendado)

```bash
# Copiar variables de entorno
cp server/.env.example server/.env

# Levantar todos los servicios
docker compose up -d

# Ejecutar migraciones y seed
docker compose exec api npx prisma migrate dev
docker compose exec api npx tsx prisma/seed.ts
```

Accesos:
- Frontend: http://localhost:5173
- API: http://localhost:4000
- Base de datos: localhost:5432

### Opción B — Manual

**1. PostgreSQL** (requiere PostgreSQL instalado):
```bash
createdb gameover
```

**2. Backend:**
```bash
cd server
cp .env.example .env
# Editar DATABASE_URL y JWT secrets en .env
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev
```

**3. Frontend:**
```bash
# En la raíz del proyecto
cp .env.example .env
# Descomentar: VITE_API_URL=http://localhost:4000
npm install
npm run dev
```

### Opción C — Demo offline (sin backend)

El frontend funciona **sin API** usando localStorage como mock:
```bash
npm install
npm run dev
# No configurar VITE_API_URL
```

---

## Impresion Nativa de Tickets (Bluetooth)

El proyecto incluye `print-bridge/`, un servicio local para impresion termica ESC/POS en Windows usando puerto COM (incluye impresoras Bluetooth emparejadas).

Flujo:
1. Frontend envia el ticket al bridge en `http://127.0.0.1:17890/print-ticket`.
2. El bridge encola el trabajo y lo imprime por serial COM.
3. Si falla, reintenta automaticamente y expone estado por API.

Inicio rapido:
```bash
cd print-bridge
cp .env.example .env
npm install
npm run dev
```

Mas detalles en `print-bridge/README.md`.

## Credenciales Demo

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `jperez` | `password123` | Asociado |
| `mlopez` | `password123` | Asociado (hijo de jperez) |
| `cruiz` | `password123` | Vendedor |

---

## API REST

### Autenticación
```
POST /api/auth/login          # Login (devuelve access + refresh token)
POST /api/auth/refresh        # Renovar access token
POST /api/auth/logout         # Cerrar sesión (revoca refresh token)
GET  /api/auth/me             # Usuario autenticado
```

### Usuarios
```
GET    /api/users             # Listar usuarios
GET    /api/users/:id         # Obtener usuario
POST   /api/users             # Crear usuario
PATCH  /api/users/:id         # Editar usuario
PATCH  /api/users/:id/password   # Cambiar contraseña
PATCH  /api/users/:id/status     # Cambiar estado (activo/bloqueado/archivado)
```

### Planes
```
GET    /api/plans             # Listar planes
GET    /api/plans/:id         # Obtener plan
POST   /api/plans             # Crear plan
PATCH  /api/plans/:id         # Editar plan
DELETE /api/plans/:id         # Eliminar plan
```

### Sorteos
```
GET    /api/draws             # Listar sorteos
GET    /api/draws/:id         # Obtener sorteo
POST   /api/draws             # Crear sorteo
PATCH  /api/draws/:id         # Editar sorteo
DELETE /api/draws/:id         # Eliminar sorteo
POST   /api/draws/:id/restricted-numbers          # Agregar número restringido
DELETE /api/draws/:id/restricted-numbers/:number  # Eliminar número restringido
```

### Tickets
```
GET    /api/tickets           # Listar tickets
GET    /api/tickets/:id       # Obtener ticket
POST   /api/tickets           # Crear ticket (con validaciones)
PATCH  /api/tickets/:id/print # Marcar como impreso
```

### Reportes
```
GET /api/reports/summary         # Resumen general
GET /api/reports/top-numbers     # Top 10 números más apostados
GET /api/reports/hierarchy       # Ventas por jerarquía de asociados
GET /api/reports/recent-tickets  # Tickets recientes
```

---

## Seguridad

- **Contraseñas** hasheadas con bcrypt (cost factor 12)
- **JWT access token** de vida corta (15 min)
- **Refresh token** rotativo (7 días), almacenado en BD
- **RBAC** por rol en cada endpoint
- **Helmet** — headers de seguridad HTTP
- **CORS** configurado por origen
- **Zod** — validación de input en el servidor
- **Auditoría** — registro de acciones críticas en `audit_logs`

---

## Jerarquía de Asociados

```
Admin
└── Asociado Master (Plan Premium)
    ├── Asociado Hijo
    │   └── Vendedor
    └── Vendedor
```

Las ventas de todos los niveles hijos se acumulan en los reportes del asociado padre. Los vendedores solo tienen acceso al módulo de ventas.
