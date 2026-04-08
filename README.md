# Admin Residencial

Sistema integral de administración residencial con arquitectura moderna, control de acceso vehicular (LPR - Reconocimiento de Placas), escáner de QR, soporte Multitenant y modelos predictivos.

## Características y Tecnologías

### Backend (Node.js)
- **Express.js** - API REST para administración y control
- **Mongoose / MongoDB** - Base de datos NoSQL con arquitectura *Multitenant*
- **Autenticación JWT** - Control de roles (Superadmin, Admin, Residente, Portero)
- **Seguridad** - Helmet, rate limiters, validación de datos, audit logs
- **Logging** - Winston para registro de eventos
- **Telemetría** - Sistema de monitoreo on-premise desde Azure

### Frontend (React + Vite)
- **React 19** - UI moderna con componentes funcionales
- **Vite** - Build tool rápido con HMR
- **Tailwind CSS 4** - Estilos utilitarios
- **Lucide React** - Iconografía
- **QR Code** - Generación de códigos QR para acceso

### Frontend PWA (HTML/CSS/JS)
- Service Worker para funcionamiento offline
- Manifest.json para instalación como app
- Interfaces para todos los roles de usuario

### Visión por Computadora (Python)
- **Reconocimiento de Placas (LPR)** - YOLOv8 + OpenCV
- **Escáner QR** - Validación rápida de acceso con cámara
- **Modelo Predictivo** - Weka + procesamiento de datos

### Despliegue
- **Docker** - Contenedores para todos los servicios
- **Docker Compose** - Orquestación local y producción
- **CI/CD** - GitHub Actions para despliegue automatizado

---

## Requisitos Previos

| Componente | Versión |
|-------------|---------|
| Node.js | 18+ |
| MongoDB | 5+ (local o Atlas) |
| Python | 3.9+ |
| Docker | 20+ (opcional) |

---

## Instalación Rápida

### Desarrollo Local

```bash
# Clonar repositorio
git clone <repo-url>
cd admin_residencial

# Instalar dependencias backend
npm install

# Instalar dependencias frontend
cd frontend && npm install && cd ..

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Iniciar servidor
npm run dev
```

### Con Docker

```bash
# Desarrollo (build local)
docker-compose -f docker-compose-local.yml up -d

# Producción
docker-compose up -d --build

# Detener servicios
docker-compose down
```

---

## Scripts Disponibles

### Backend (raíz)
```bash
npm run dev              # Desarrollo (NODE_ENV=development)
npm run prod             # Producción (NODE_ENV=production)
npm start                # Iniciar estándar
npm run generate-secret  # Generar JWT_SECRET seguro
```

### Frontend
```bash
cd frontend
npm run dev     # Servidor desarrollo (puerto 5173)
npm run build   # Build producción
npm run preview # Preview del build
```

### Scripts de Utilidad (Windows)
| Archivo | Función |
|---------|---------|
| `scripts/instalar.bat` | Instalar dependencias |
| `scripts/iniciar.bat` | Iniciar servicios |
| `scripts/detener.bat` | Detener servicios |
| `scripts/backup.bat` | Crear respaldos |
| `scripts/publicar-imagenes.bat` | Gestión de imágenes |

---

## Estructura del Proyecto

```
admin_residencial/
├── config/                      # Configuración de la aplicación
│   ├── app.config.js           # Configuración general
│   ├── cache.js                # Sistema de caché
│   ├── database.js             # Conexión MongoDB
│   └── logger.js               # Sistema de logging (Winston)
│
├── controllers/                 # Lógica de negocio (API)
│   ├── conjuntoController.js   # Gestión de conjuntos
│   ├── parqueaderoController.js # Gestión de parqueaderos
│   ├── usuariocontroller.js    # Gestión de usuarios
│   └── visitanteController.js  # Gestión de visitantes
│
├── models/                       # Modelos Mongoose (MongoDB)
│   ├── auditLog.js             # Log de auditoría
│   ├── conjunto.js             # Conjuntos residenciales (multi-tenant)
│   ├── historialAcceso.js      # Historial de accesos
│   ├── Instalacion.js          # Instalaciones (telemetría)
│   ├── parqueadero.js          # Parqueaderos
│   ├── usuario.js              # Usuarios
│   └── visitante.js            # Visitantes
│
├── middlewares/                  # Middlewares Express
│   ├── audit.middleware.js     # Auditoría de acciones
│   ├── auth.middleware.js     # Autenticación JWT
│   ├── planLimits.middleware.js # Límites por plan
│   ├── rateLimit.middleware.js  # Control de tasa de requests
│   └── validation.middleware.js # Validación de datos
│
├── routes/                        # Rutas de la API
│   ├── conjunto.routes.js       # /api/conjunto
│   ├── parqueadero.routes.js    # /api/parqueadero
│   ├── scripts.routes.js        # /api/scripts
│   ├── telemetria.routes.js     # /api/telemetria
│   ├── usuario.routes.js        # /api/usuario
│   └── visitante.routes.js      # /api/visitante
│
├── services/                      # Servicios de negocio
│   ├── conjuntoService.js       # Lógica de conjuntos
│   ├── parqueaderoService.js    # Lógica de parqueaderos
│   └── visitanteService.js      # Lógica de visitantes
│
├── frontend/                      # Frontend React + Vite
│   ├── src/
│   │   ├── pages/               # Páginas principales
│   │   │   ├── Login.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── ResidenteDashboard.jsx
│   │   │   ├── PorteroDashboard.jsx
│   │   │   └── VisitanteAcceso.jsx
│   │   ├── services/
│   │   │   └── api.js           # Cliente Axios
│   │   ├── App.jsx              # Componente principal
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── dist/                     # Build producción
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
│
├── public/                        # Frontend PWA (HTML/CSS/JS)
│   ├── LandingPage/
│   │   └── Landing.html          # Página de inicio
│   ├── Vista.html                # Dashboard principal
│   ├── Vistaadmin.html           # Dashboard admin
│   ├── VistaSuperadmin.html      # Dashboard superadmin
│   ├── Vistaporteria.html        # Dashboard portería
│   ├── Vistaporteriaregistrar.html
│   ├── Vistaporteriaactualizar.html
│   ├── Vistaresidente.html       # Dashboard residente
│   ├── ReconocimientoPlacas.html # UI reconocimiento LPR
│   ├── Weka.html                 # UI modelo predictivo
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   ├── script.js                 # Scripts globales
│   └── Style.css                 # Estilos globales
│
├── Reconocimiento/                # Motor LPR (Python)
│   ├── Placascolombianas.py      # Detección de placas (YOLOv8)
│   ├── yolov8n.pt                # Modelo YOLOv8
│   ├── requirements.txt
│   ├── Dockerfile.local
│   └── README.md
│
├── qr-scanner/                    # Escáner QR (Python)
│   ├── qr_scanner.py             # Escáner principal
│   ├── test_qr.py                # Tests
│   ├── test_qr_opencv.py         # Tests OpenCV
│   ├── requirements.txt
│   ├── Dockerfile.local
│   └── README.md
│
├── ml_services/                   # Machine Learning
│   ├── predict.js                # Predicciones Node.js
│   ├── convert_to_word.py        # Conversión a Word
│   ├── pruebamodelopredictivo.arff # Datos Weka
│   └── yolov8n.pt                # Modelo YOLO
│
├── scripts/                       # Scripts de utilidad
│   ├── instalar.bat              # Instalación
│   ├── iniciar.bat               # Iniciar servicios
│   ├── detener.bat               # Detener servicios
│   ├── backup.bat                # Respaldos
│   ├── publicar-imagenes.bat     # Gestión imágenes
│   ├── migrate-multitenant.js    # Migración multi-tenant
│   ├── diagnostico-multitenant.js # Diagnóstico
│   └── fix-visitantes.js         # Reparación visitantes
│
├── cliente/                       # Cliente alternativo
│   ├── docker-compose.yml
│   ├── iniciar.bat
│   ├── detener.bat
│   ├── instalar.bat
│   └── README.md
│
├── docs/                          # Documentación
│   ├── Especificaciones_LPR_Comercial.docx
│   └── Safe-final.png
│
├── .github/workflows/             # CI/CD
│   └── master_safe-entry.yml     # Deploy automático
│
├── server.js                      # Punto de entrada Express
├── package.json                   # Dependencias backend
├── Dockerfile                     # Imagen Docker principal
├── docker-compose.yml             # Orquestación producción
├── docker-compose-local.yml       # Orquestación desarrollo
├── .env.example                   # Variables de entorno ejemplo
├── .env.local.example             # Variables locales ejemplo
├── MANUAL_NUBE_MONGODB.md         # Guía MongoDB Atlas
├── MongoAtlas-PowerBI-Setup.md   # Guía PowerBI
└── INSTALACION_LOCAL.md          # Guía instalación local
```

---

## Variables de Entorno

Crear archivo `.env` basado en `.env.example`:

```env
# Servidor
NODE_ENV=development
PORT=5000

# Base de datos
MONGODB_URI=mongodb://localhost:27017/admin_residencial

# JWT
JWT_SECRET=tu_secreto_muy_seguro

# Frontend
FRONTEND_URL_LOCAL=http://localhost:5173
FRONTEND_URL_PROD=https://tu-dominio.com
```

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Superadmin** | Acceso total, gestión de conjuntos, telemetría |
| **Admin** | Gestión de su conjunto, usuarios, visitantes |
| **Residente** | Ver sus datos, registrar visitantes, parqueaderos |
| **Portero** | Control de acceso, validar visitantes, escaneo QR |

---

## API Endpoints

### Autenticación
- `POST /api/usuario/login` - Iniciar sesión
- `POST /api/usuario/register` - Registrar usuario

### Conjuntos
- `GET /api/conjunto` - Listar conjuntos
- `POST /api/conjunto` - Crear conjunto
- `PUT /api/conjunto/:id` - Actualizar conjunto

### Usuarios
- `GET /api/usuario` - Listar usuarios
- `PUT /api/usuario/:id` - Actualizar usuario
- `DELETE /api/usuario/:id` - Eliminar usuario

### Visitantes
- `GET /api/visitante` - Listar visitantes
- `POST /api/visitante` - Registrar visitante
- `PUT /api/visitante/:id` - Actualizar visitante

### Parqueaderos
- `GET /api/parqueadero` - Listar parqueaderos
- `POST /api/parqueadero` - Asignar parqueadero

### Telemetría
- `POST /api/telemetria/heartbeat` - Heartbeat de instalación
- `GET /api/telemetria/instalaciones` - Listar instalaciones

---

## Puertos por Defecto

| Servicio | Puerto |
|----------|--------|
| Backend API | 5000 |
| Frontend Dev | 5173 |
| MongoDB | 27017 |

---

## Arquitectura Modular (Nueva Estructura)

El proyecto está migrando a una **arquitectura modular por features**. Ver [MIGRACION.md](./MIGRACION.md) para detalles.

### Nueva Estructura `src/`

```
src/
├── modules/                    # Módulos de negocio
│   ├── usuarios/
│   │   ├── usuario.model.js
│   │   └── index.js
│   ├── visitantes/
│   │   ├── visitante.model.js
│   │   ├── visitante.service.js
│   │   └── index.js
│   ├── parqueaderos/
│   │   ├── parqueadero.model.js
│   │   ├── parqueadero.service.js
│   │   └── index.js
│   ├── conjuntos/
│   │   ├── conjunto.model.js
│   │   ├── conjunto.service.js
│   │   └── index.js
│   └── telemetria/
│       ├── instalacion.model.js
│       └── index.js
│
├── shared/                     # Código compartido
│   ├── config/
│   │   ├── database.js
│   │   ├── logger.js
│   │   ├── cache.js
│   │   └── app.config.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── audit.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   ├── planLimits.middleware.js
│   │   └── validation.middleware.js
│   ├── models/
│   │   ├── auditLog.js
│   │   └── historialAcceso.js
│   └── index.js
│
└── index.js                    # Punto de entrada principal
```

### Cómo Importar (Nuevo)

```javascript
// Método recomendado
const { models, middlewares, logger } = require('./src');

// O importar específicamente
const Usuario = require('./src/modules/usuarios/usuario.model');
const { verificarToken } = require('./src/shared/middlewares/auth.middleware');
```

---

## Licencia

ISC