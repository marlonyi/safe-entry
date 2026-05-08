# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen del Proyecto

Admin Residencial es un sistema integral de administración residencial con:
- **Backend**: Node.js + Express + MongoDB (arquitectura multitenant)
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Servicios Python**: LPR (Reconocimiento de Placas) con YOLOv8, Escáner QR para control de acceso
- **PWA**: Frontend HTML/CSS/JS con Service Worker para funcionamiento offline

## Comandos de Desarrollo

### Backend (directorio raíz)
```bash
npm run dev          # Modo desarrollo (NODE_ENV=development)
npm run prod        # Modo producción
npm start           # Inicio estándar
npm run generate-secret  # Generar JWT_SECRET seguro
```

### Frontend (directorio frontend/)
```bash
cd frontend
npm run dev         # Servidor desarrollo (puerto 5173)
npm run build       # Build producción
npm run lint        # Ejecutar ESLint
```

### Docker
```bash
docker-compose -f docker-compose-local.yml up -d  # Desarrollo local
docker-compose up -d --build                       # Producción
docker-compose down                                # Detener servicios
```

### Servicio Python LPR
```bash
cd Reconocimiento
pip install -r requirements.txt
python Placascolombianas.py  # Puerto 5001
```

### Escáner QR
```bash
cd qr-scanner
pip install -r requirements.txt
python qr_scanner.py
```

## Arquitectura

### Estructura Modular del Backend (`src/`)
El proyecto está migrando a una arquitectura modular:

```
src/
├── modules/           # Módulos de negocio
│   ├── usuarios/      # Usuarios (model, routes, controller)
│   ├── visitantes/    # Visitantes (model, service, routes)
│   ├── parqueaderos/  # Parqueaderos (model, service, routes)
│   ├── conjuntos/     # Conjuntos residenciales (multitenant)
│   ├── telemetria/    # Telemetría/monitoreo
│   └── chatbot/       # Servicio chatbot IA
├── shared/
│   ├── config/        # Database, logger, cache, app config
│   ├── middlewares/   # Auth, audit, rate limit, validation
│   └── models/        # Modelos compartidos (AuditLog, HistorialAcceso)
└── index.js           # Exportación de módulos
```

### Patrón de Importación
```javascript
// Recomendado: Importar desde índice de src
const { config, logger, middlewares, models } = require('./src');
const { Usuario, Conjunto, Parqueadero } = require('./src/modules').models;

// O importación directa
const Usuario = require('./src/modules/usuarios/usuario.model');
```

### Roles de Usuario
| Rol | Permisos |
|-----|----------|
| Superadmin | Acceso total, gestiona todos los conjuntos, telemetría |
| Admin | Gestiona su conjunto, usuarios, visitantes |
| Residente | Ver sus datos, registrar visitantes, parqueaderos |
| Portero | Control de acceso, validar visitantes, escaneo QR |

### Multitenancy
- Cada `Conjunto` (conjunto residencial) es un tenant
- Los modelos incluyen campo `conjuntoId` para aislamiento de datos
- Middleware `getConjuntoId` extrae el conjunto del token JWT

## Archivos Principales

- `server.js` - Punto de entrada Express, configuración CORS, registro de rutas
- `src/index.js` - Barrel de exportación de módulos
- `src/shared/config/database.js` - Conexión MongoDB
- `src/shared/middlewares/auth.middleware.js` - Autenticación JWT, verificación de roles

## Variables de Entorno

Requeridas en `.env`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/adminResidencial
JWT_SECRET=<mínimo 32 caracteres>
FRONTEND_URL_LOCAL=http://localhost:5173
FRONTEND_URL_PROD=https://tu-dominio.com
```

## Colecciones de Base de Datos

- `usuarios` - Usuarios con roles y asociación a conjunto
- `visitantes` - Visitantes con tokens QR para acceso
- `parqueaderos` - Espacios de parqueadero con seguimiento de estado
- `conjuntos` - Conjuntos residenciales (raíz multitenant)
- `historialaccesos` - Registro de historial de accesos
- `auditlogs` - Trazas de auditoría para operaciones

## Patrón de Rutas API

Las rutas siguen este patrón en `src/modules/<modulo>/`:
- `<modulo>.routes.js` - Definiciones de router Express
- `<modulo>.controller.js` - Manejadores de peticiones
- `<modulo>.service.js` - Lógica de negocio
- `<modulo>.model.js` - Esquema Mongoose

## Páginas del Frontend

Ubicadas en `frontend/src/pages/`:
- `Login.jsx` - Autenticación
- `AdminDashboard.jsx` - Panel de administración
- `ResidenteDashboard.jsx` - Dashboard de residente con generación de QR
- `PorteroDashboard.jsx` - Interfaz de portero/guardia
- `VisitanteAcceso.jsx` - Vista de acceso de visitante

## Servicio Python LPR

La carpeta `Reconocimiento/` contiene el sistema de reconocimiento de placas:
- Usa YOLOv8 + EasyOCR para detección de placas
- Se integra con MongoDB para verificar autorización de vehículos
- Ejecuta en puerto 5001
- Endpoints API bajo `/api/reconocimiento/`

## Despliegue

- **CI/CD**: GitHub Actions despliega a Azure Web App al hacer push a `master`
- **Docker**: Despliegue de producción usa `docker-compose.yml` con contenedor MongoDB
- **Puertos**: Backend 5000, Frontend 5173, MongoDB 27017, LPR 5001