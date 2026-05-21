# SafeEntry — Sistema de Administración Residencial

Sistema integral de gestión residencial con control de acceso vehicular (LPR), escáner QR, arquitectura **multitenant** y asistente de IA.

> **Demo en producción:** [safe-entry-neon.vercel.app](https://safe-entry-neon.vercel.app) · Backend: [safeentry-backend.onrender.com](https://safeentry-backend.onrender.com)

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 18+ · Express · MongoDB + Mongoose |
| Frontend | React 19 · Vite · Tailwind CSS 4 |
| Auth | JWT (access + refresh token) · bcryptjs |
| Visión | Python · YOLOv8 · OpenCV (LPR) |
| IA | Groq API (chatbot contextual) |
| Despliegue | Docker · Render (backend) · Vercel (frontend) |

---

## Requisitos Previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js | 18+ |
| MongoDB | 5+ (local o Atlas) |
| Python | 3.9+ (solo para LPR/QR scanner) |
| Docker | 20+ (opcional) |

---

## Instalación Rápida

### Desarrollo local

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd admin_residencial

# 2. Instalar dependencias backend
npm install

# 3. Instalar dependencias frontend
cd frontend && npm install && cd ..

# 4. Configurar variables de entorno
cp .env.example .env          # Editar con tus valores
cp frontend/.env.example frontend/.env

# 5. Iniciar backend (puerto 5000)
npm run dev

# 6. Iniciar frontend en otra terminal (puerto 5173)
cd frontend && npm run dev
```

### Con Docker (stack completo)

```bash
# Demo local — backend + frontend + MongoDB
docker compose --env-file .env.docker -f docker-compose.demo.yml up -d --build

# Solo backend + MongoDB (apunta al frontend de Vercel)
docker compose -f docker-compose.yml up -d

# Detener y borrar volúmenes
docker compose -f docker-compose.demo.yml down -v
```

> ⚠️ Si el puerto 80 está ocupado (XAMPP), el frontend se mapea a `8080:80` en `docker-compose.demo.yml`.

---

## Variables de Entorno

### Backend (`.env`)

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/adminResidencial
JWT_SECRET=<mínimo 32 chars — generar con: npm run generate-secret>
FRONTEND_URL_LOCAL=http://localhost:5173
FRONTEND_URL_PROD=https://safe-entry-neon.vercel.app
ADMIN_CEDULA=99999999
ADMIN_PASSWORD=<contraseña superadmin inicial>
GROQ_API_KEY=<opcional — habilita el chatbot IA>
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...   # opcional
```

> ⚠️ Las variables `VITE_*` se incrustan en el build. Después de cambiarlas en Vercel **redeploy manual obligatorio**.

---

## Scripts Disponibles

### Backend
```bash
npm run dev              # Modo desarrollo (NODE_ENV=development)
npm run prod             # Modo producción
npm start                # Inicio estándar
npm run generate-secret  # Genera JWT_SECRET de 64 bytes hex
```

### Frontend
```bash
cd frontend
npm run dev      # Servidor desarrollo → http://localhost:5173
npm run build    # Build producción → frontend/dist/
npm run lint     # ESLint
```

### Scripts de mantenimiento
```bash
node scripts/fix-plazas-atascadas.js   # Libera plazas bloqueadas
node scripts/seed-database.js          # Datos de prueba
node scripts/migrate-multitenant.js    # Migración a multi-tenant
```

### Servicios Python (corren fuera de Docker en Windows)
```bash
# Reconocimiento de placas — puerto 5001
cd Reconocimiento && pip install -r requirements.txt
python Placascolombianas.py

# Escáner QR
cd qr-scanner && pip install -r requirements.txt
python test_qr_opencv.py
```

---

## Estructura del Proyecto

```
admin_residencial/
│
├── src/                            # Backend — arquitectura modular
│   ├── modules/
│   │   ├── usuarios/               # CRUD + login + impersonación
│   │   ├── visitantes/             # Visitantes + códigos QR
│   │   ├── parqueaderos/           # Plazas + asignación
│   │   ├── conjuntos/              # Tenants (multitenant)
│   │   ├── modelo/                 # Programación Lineal (I/O académico)
│   │   ├── telemetria/             # Monitoreo + scripts Python
│   │   └── chatbot/                # Asistente Groq IA
│   ├── shared/
│   │   ├── config/                 # database, logger, cache
│   │   ├── middlewares/            # auth, audit, rate-limit, planLimits
│   │   └── models/                 # HistorialAcceso, AuditLog
│   └── index.js                    # Barrel: exporta { config, logger, middlewares, models }
│
├── frontend/                       # React 19 + Vite + Tailwind CSS 4
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── ResidenteDashboard.jsx
│   │   │   ├── PorteroDashboard.jsx
│   │   │   ├── VisitanteAcceso.jsx
│   │   │   └── admin/              # Vistas modulares del admin
│   │   ├── components/
│   │   │   ├── Chatbot/ChatbotUI.jsx
│   │   │   ├── ui/                 # ConfirmDialog, Toast, Pagination
│   │   │   ├── Logo.jsx
│   │   │   ├── ModeloMatematico.jsx
│   │   │   └── QRScannerComponent.jsx
│   │   ├── styles/
│   │   │   └── design-system.css   # Tokens CSS + componentes globales
│   │   ├── services/api.js         # Axios con interceptor auth
│   │   └── App.jsx                 # Routing por rol
│   └── public/
│       └── safeentry-logo.png
│
├── Reconocimiento/                 # LPR — YOLOv8 + OpenCV (Python)
├── qr-scanner/                     # Escáner QR (Python)
├── scripts/                        # Utilidades de mantenimiento
├── server.js                       # Punto de entrada Express
├── Dockerfile
├── docker-compose.yml              # Producción
├── docker-compose.demo.yml         # Demo local completo
├── .env.example                    # Plantilla de variables de entorno
└── CLAUDE.md                       # Guía de arquitectura para IA
```

---

## Arquitectura Multitenant

Cada **Conjunto** residencial es un tenant aislado:

- Todas las colecciones llevan campo `conjunto: ObjectId`
- `getConjuntoId(req)` extrae el tenant del JWT
- `getTenantFilter(req)` aplica el filtro automáticamente
- El **superadmin** puede impersonar cualquier rol vía `POST /api/usuarios/impersonar`

---

## Roles y Permisos

| Rol | Dashboard | Permisos principales |
|-----|-----------|---------------------|
| `superadmin` | AdminDashboard (badge morado) | Acceso global, gestión de conjuntos, telemetría, impersonación |
| `admin` | AdminDashboard (badge azul) | Su conjunto: usuarios, visitantes, parqueaderos, auditoría, modelo PL |
| `residente` | ResidenteDashboard | Ver sus datos, registrar visitantes, generar QR, gestionar vehículo |
| `porteria` | PorteroDashboard | Control de acceso, validar QR, registrar ingreso/salida |

---

## API — Endpoints Principales

### Autenticación
```
POST /api/usuarios/login                          → { token, refreshToken, usuario }
POST /api/usuarios/impersonar                     → JWT del rol impersonado (solo superadmin)
```

### Visitantes
```
POST /api/visitantes/qr/ingresar/:token           → Valida QR y registra entrada (público)
GET  /api/visitantes/qr/verificar/:token          → Solo verifica sin registrar (público)
POST /api/visitantes/:id/registrar-ingreso        → Entrada manual (portero/admin)
POST /api/visitantes/:id/registrar-salida         → Salida + libera plaza (portero/admin)
```

### Parqueaderos
```
GET  /api/parqueaderos/estadisticas               → Conteos por estado y categoría
GET  /api/parqueaderos/historial                  → Accesos paginados con filtros
```

### Modelo PL (académico)
```
GET  /api/modelo/parametros/:conjuntoId           → Parámetros calculados desde BD real
```

---

## Flujo de Acceso de Visitante

```
Residente registra visitante  →  Se genera QR (token + 10 min expiración)
                              →  Residente comparte QR al visitante

Visitante llega a portería    →  Muestra QR en VisitanteAcceso

Portero escanea QR            →  POST /api/visitantes/qr/ingresar/:token
                              →  Sistema valida, registra entrada y cambia estado → "ingresado"

Portero registra salida       →  POST /api/visitantes/:id/registrar-salida
                              →  Estado → "salido" + plaza de parqueadero liberada
```

---

## Despliegue en Producción

| Servicio | Plataforma | URL |
|----------|-----------|-----|
| Frontend | Vercel | [safe-entry-neon.vercel.app](https://safe-entry-neon.vercel.app) |
| Backend  | Render (free) | [safeentry-backend.onrender.com](https://safeentry-backend.onrender.com) |
| Base de datos | MongoDB Atlas | Free tier M0 |

> **Nota Render free tier:** El backend duerme tras 15 min de inactividad. El primer request tarda ~50 segundos en despertar.

---

## Licencia

ISC — Proyecto académico SafeEntry · 2024-2026
