# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen del Proyecto

SafeEntry / Admin Residencial es un sistema integral de administración residencial con:
- **Backend**: Node.js + Express + MongoDB (arquitectura multitenant)
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Servicios Python**: LPR (Reconocimiento de Placas) con YOLOv8, Escáner QR para control de acceso
- **Módulo académico**: Modelo de Programación Lineal con método gráfico (curso Investigación de Operaciones)

## Comandos de Desarrollo

### Backend (directorio raíz)
```bash
npm run dev              # Modo desarrollo (NODE_ENV=development)
npm run prod             # Modo producción
npm start                # Inicio estándar
npm run generate-secret  # Generar JWT_SECRET de 64 bytes hex
```

### Frontend (directorio frontend/)
```bash
cd frontend
npm run dev              # Servidor desarrollo (puerto 5173)
npm run build            # Build producción → frontend/dist
npm run lint             # Ejecutar ESLint
```

### Docker
```bash
# Stack completo (backend + frontend + mongo) — para demo local
docker compose --env-file .env.docker -f docker-compose.demo.yml up -d --build

# Sólo backend + mongo (apunta al frontend de Vercel)
docker compose -f docker-compose.yml up -d

# Backend + mongo + LPR (Python con cámara — solo Linux con USB passthrough)
docker compose -f docker-compose-local.yml up -d

# Detener todo y borrar datos
docker compose -f docker-compose.demo.yml down -v

# Reconstruir SIN caché (cuando cambias código backend y no se refleja)
docker compose -f docker-compose.demo.yml down
docker rmi admin_residencial-backend
docker compose --env-file .env.docker -f docker-compose.demo.yml up -d --build
```

⚠️ Si el puerto 80 está ocupado (XAMPP), `docker-compose.demo.yml` mapea el frontend a `8080:80`.

### Servicios Python (corren localmente, NO en Docker en Windows)
```bash
# Reconocimiento de placas
cd Reconocimiento && pip install -r requirements.txt && python Placascolombianas.py  # :5001

# Escáner QR (lee cámara → POST a /api/visitantes/qr/ingresar/:token)
cd qr-scanner && pip install -r requirements.txt && python test_qr_opencv.py
```

Limitación conocida: Docker Desktop en Windows no soporta passthrough de cámara USB. Los scripts Python deben correr nativamente fuera de Docker.

### Scripts de mantenimiento (carpeta `scripts/`)
```bash
node scripts/fix-plazas-atascadas.js   # Libera plazas OCUPADO de visitantes ya salidos
node scripts/seed-database.js          # Datos de prueba
node scripts/migrate-multitenant.js    # Migración a multi-tenant
```

## Arquitectura

### Estructura Modular del Backend (`src/`)

```
src/
├── modules/                # Módulos de negocio (cada uno autocontenido)
│   ├── usuarios/           # CRUD + login + impersonación
│   ├── visitantes/         # Visitantes + QR
│   ├── parqueaderos/       # Plazas + asignación
│   ├── conjuntos/          # Tenants (multitenant)
│   ├── modelo/             # 📐 Programación Lineal (datos reales de BD)
│   ├── telemetria/         # Monitoreo + scripts Python
│   └── chatbot/            # Chatbot Groq AI
├── shared/
│   ├── config/             # Database, logger, cache
│   ├── middlewares/        # auth, audit, rate-limit, planLimits, validation
│   └── models/             # HistorialAcceso, AuditLog
└── index.js                # Barrel: exporta { config, logger, middlewares, models }
```

### Patrón de cada módulo
```
src/modules/<modulo>/
├── <modulo>.routes.js      # Express router
├── <modulo>.controller.js  # Manejadores HTTP
├── <modulo>.service.js     # Lógica de negocio
└── <modulo>.model.js       # Esquema Mongoose
```

### Patrón de Importación
```javascript
const { config, logger, middlewares, models } = require('./src');
const { Usuario, Conjunto, Parqueadero, HistorialAcceso, Visitante } = models;
const { verificarToken, esAdmin, esPorteriaOAdmin, esSuperAdmin } = middlewares.auth;
```

### Roles de Usuario
| Rol | Permisos | Dashboard |
|-----|----------|-----------|
| `superadmin` | Acceso global, gestiona todos los conjuntos, ve telemetría | AdminDashboard (badge morado) |
| `admin` | Gestiona su conjunto, usuarios, visitantes, parqueaderos | AdminDashboard (badge azul) |
| `residente` | Ver sus datos, registrar visitantes, generar QR | ResidenteDashboard |
| `porteria` | Control de acceso, validar QR, registrar ingreso/salida | PorteroDashboard |

### Multitenancy
- Cada `Conjunto` (conjunto residencial) es un tenant
- Todas las colecciones (excepto `conjuntos`) tienen campo `conjunto: ObjectId` para aislamiento
- Middleware `getConjuntoId(req)` extrae el conjunto del JWT
- Middleware `getTenantFilter(req)` retorna `{ conjunto: ObjectId }` o `{}` para superadmin
- El superadmin puede impersonar a admin/portero/residente de un conjunto vía `POST /api/usuarios/impersonar`

### Flujo de autenticación
1. `POST /api/usuarios/login` → devuelve `{ token, refreshToken, usuario }`
2. Si hay múltiples usuarios con la misma cédula y uno es superadmin con password match, entra directo como superadmin
3. Frontend guarda token en `localStorage`; `api.js` lo inyecta como `Authorization: Bearer`
4. El interceptor de `api.js` desempaca automáticamente `{ success, data, message }` → `resp.data` ES la data directamente

## Flujo end-to-end del sistema

```
RESIDENTE crea visitante  →  Se genera QR (qrToken + expiración)
                          →  Comparte QR al visitante

VISITANTE llega a portería con QR

PORTERO escanea QR (script Python o componente html5-qrcode en navegador)
                          →  POST /api/visitantes/qr/ingresar/:token
                          →  Valida token, registra entrada en historialaccesos
                          →  Cambia estado del visitante a 'ingresado'

PORTERO da salida desde dashboard
                          →  POST /api/visitantes/:id/registrar-salida
                          →  Cambia estado a 'salido' Y LIBERA la plaza

ADMIN consulta dashboard
                          →  Ve plazas, visitantes, accesos, auditoría
                          →  Vista "Modelo Matemático" con optimización de PL
```

## Archivos Principales

- `server.js` — Punto de entrada Express, CORS, registro de rutas (`/api/usuarios`, `/api/visitantes`, `/api/parqueaderos`, `/api/conjuntos`, `/api/telemetria`, `/api/chat`, `/api/modelo`)
- `src/index.js` — Barrel de exportación de módulos
- `src/shared/config/database.js` — Conexión MongoDB
- `src/shared/middlewares/auth.middleware.js` — JWT, `getConjuntoId`, `isSuperAdmin`, `getTenantFilter`
- `frontend/src/services/api.js` — Cliente axios con interceptor de auth y desempaquetado de respuestas
- `frontend/src/App.jsx` — Routing por rol; selector visual de simulación (solo superadmin) para alternar entre dashboards

## Variables de Entorno

### Backend (`.env` o `.env.docker`)
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/adminResidencial   # o Atlas mongodb+srv://...
JWT_SECRET=<mínimo 32 caracteres — usar npm run generate-secret>
FRONTEND_URL_LOCAL=http://localhost:5173
FRONTEND_URL_PROD=https://safe-entry-neon.vercel.app
ADMIN_CEDULA=99999999
ADMIN_PASSWORD=<contraseña del superadmin inicial>
GROQ_API_KEY=<opcional, para chatbot>
```

### Frontend (`frontend/.env` o `.env.local`)
```
VITE_API_URL=http://localhost:5000/api          # o https://safeentry-backend.onrender.com/api
VITE_POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...   # opcional
```

⚠️ Las variables `VITE_*` se incrustan en el build. Después de cambiarlas en Vercel **siempre redeployar manualmente**.

## Colecciones de Base de Datos

| Colección | Campos clave |
|-----------|--------------|
| `usuarios` | `cedula`, `rol`, `conjunto`, `tieneVehiculo`, `placaVehiculo`, `apartamento`, `torre` |
| `visitantes` | `cedula`, `placaVehiculo` (único por conjunto), `tipoVehiculo` (CARRO/MOTO/NINGUNO), `estado` (pendiente/ingresado/salido), `qrToken`, `qrExpiracion`, `parqueadero` |
| `parqueaderos` | `numero`, `categoria` (PRIVADO/VISITANTE), `tipoVehiculo` (CARRO/MOTO), `estado` (DISPONIBLE/OCUPADO/RESERVADO), `torre`, `apartamento`, `residenteAsignado`, `visitante` |
| `conjuntos` | `nombre`, `estado` (activo/suspendido/inactivo), `plan.limites`, `configuracion` |
| `historialaccesos` | `placa`, `tipoAcceso` (entrada/salida), `tipoUsuario` (residente/visitante), `nombreUsuario`, `metodo` (qr_scan/manual_porteria/LPR_CAMERA), `fechaHora`, `conjunto` |
| `auditlogs` | `usuario`, `accion`, `descripcion`, `recurso`, `requestInfo`, `conjunto` |

## Endpoints API destacados

### Visitantes (módulo `src/modules/visitantes/visitante.routes.js`)
- `POST /api/visitantes/qr/ingresar/:token` — **público** — Verifica QR y registra entrada en un solo paso (usado por script Python QR scanner)
- `GET /api/visitantes/qr/verificar/:token` — público — Solo verifica sin registrar
- `POST /api/visitantes/:id/registrar-ingreso` — portero/admin — Entrada manual desde dashboard
- `POST /api/visitantes/:id/registrar-salida` — portero/admin — Salida; **libera la plaza automáticamente**

### Modelo PL (módulo `src/modules/modelo/modelo.routes.js`)
- `GET /api/modelo/conjuntos` — Lista conjuntos activos para el selector
- `GET /api/modelo/parametros/:conjuntoId` — Calcula parámetros del modelo (área, rotación r1/r2 desde historialaccesos JOIN visitantes, horas-portero, etc.)

### Impersonación (solo superadmin)
- `POST /api/usuarios/impersonar` — Body `{ conjuntoId, rol, usuarioId? }` — Devuelve un JWT con el contexto del usuario impersonado
- `GET /api/usuarios/conjunto/:conjuntoId/agrupados-por-rol` — Lista usuarios por rol para el picker

## Frontend — Estructura y patrones

### Páginas (`frontend/src/pages/`)
- `Login.jsx` — Autenticación con selector de conjunto si hay múltiples matches
- `AdminDashboard.jsx` — Panel admin/superadmin con menú: Dashboard, Conjuntos (solo super), Usuarios, Visitantes, Parqueaderos, Auditoría, **Modelo Matemático**, Simulador Cámaras
- `ResidenteDashboard.jsx` — Mi Hogar, Mis Visitantes (con selector Carro/Moto), Mi Vehículo
- `PorteroDashboard.jsx` — Panel Principal (con escáner QR navegador + auto-refresh cada 3s), Visitantes, Parqueaderos
- `VisitanteAcceso.jsx` — Vista pública del visitante con su QR

### Componentes compartidos (`frontend/src/components/`)
- `Pagination.jsx` — Componente de paginación reutilizable (usado en Usuarios, Visitantes, Auditoría)
- `ModeloMatematico.jsx` — Vista interactiva del modelo PL con SVG del método gráfico
- `QRScannerComponent.jsx` — Escáner QR usando `html5-qrcode` con cámara del navegador
- `Logo.jsx` — Logo con variantes (theme dark/light, subtitle dinámico por rol)
- `Chatbot/ChatbotUI.jsx` — Botón flotante de asistente AI (Groq)

### Convenciones del frontend
- Las respuestas del backend con formato `{ success, data }` se desempacan automáticamente en el interceptor de `api.js` — siempre acceder a `resp.data` directamente
- Los modales globales se montan al nivel raíz del componente con `fixed inset-0 z-50`
- El sidebar muestra el avatar y rol del usuario al fondo (consistente entre Admin/Portero/Residente)

## Despliegue en producción

### Stack gratuito actual
- **MongoDB Atlas** (cloud, free tier) — Network Access debe permitir `0.0.0.0/0`
- **Render** (free) — Backend en `https://safeentry-backend.onrender.com` (puerto interno 10000)
  - Tarda ~50 segundos en despertar tras inactividad (limitación del free tier)
- **Vercel** (free) — Frontend en `https://safe-entry-neon.vercel.app`
  - Root Directory: `frontend`
  - Variables `VITE_*` se incrustan en build; redeployar al cambiar

### CI/CD
- GitHub Actions: push a `master` despliega a Azure Web App (configuración legacy)
- Vercel/Render: redespliegue automático al hacer push (Vercel a cualquier rama, Render a `develop/Marlon` o `master`)

## Modelo Matemático (módulo académico)

El módulo `src/modules/modelo/` implementa un modelo de **Programación Lineal** para el curso de Investigación de Operaciones:

- **Variables**: `x₁` = plazas visitante carro, `x₂` = plazas visitante moto
- **Función objetivo**: `Max Z = r₁·x₁ + r₂·x₂` (visitantes/día)
- **Restricciones**: área física, horas-portero, mínimo carros, máximo motos, no negatividad
- **Resolución**: método gráfico (frontend calcula vértices y dibuja SVG)
- **Parámetros calculados desde BD real**:
  - `r₁`, `r₂` (rotación): aggregation pipeline `historialaccesos` JOIN `visitantes` por placa
  - `H` (horas-portero): `count(usuarios.rol='porteria') × 8 × 0.5`
  - `A` (área): suma de plazas actuales × estándar urbanístico

Ver `MODELO_MATEMATICO.md` para la explicación completa del modelo.

## Limitaciones conocidas

- **Cámara USB en Docker Windows**: no soportada. Los scripts Python (LPR, QR) corren nativamente.
- **Free tier de Render**: backend duerme después de 15 min de inactividad; ~50s para despertar.
- **Variables `VITE_*` en Vercel**: requieren redeploy manual al cambiarlas (se incrustan en build).
- **Visitantes sin vehículo**: por restricción única `(conjunto, placaVehiculo)`, no se pueden tener múltiples visitantes con `placaVehiculo='N/A'` en el mismo conjunto. Usar placa única o `null`.
- **Modelo de turnos no implementado**: solo está el modelo de distribución de plazas. Si se requiere optimización de turnos de portero, ver `MODELO_MATEMATICO.md` sección Mejoras.
