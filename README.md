# 🏢 Admin Residencial

Sistema de administración residencial con control de acceso vehicular, gestión de visitantes y parqueaderos.

## 🚀 Características

- **Autenticación JWT** - Login seguro con tokens
- **Gestión de Usuarios** - Administradores, residentes y porteros
- **Control de Visitantes** - Registro, QR codes, códigos dinámicos TOTP
- **Mapa de Parqueaderos** - Visualización en tiempo real del estado de plazas
- **Reconocimiento de Placas** - Integración con sistema de visión por computadora (Python/YOLO)
- **Auditoría** - Registro completo de acciones del sistema
- **Multi-rol** - Vistas diferenciadas para admin, portería y residentes

## 📋 Requisitos Previos

- Node.js 18+
- MongoDB 5+
- Python 3.9+ (para el módulo de reconocimiento de placas)

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/ZDZ-123-Deep/admin_residencial.git
cd admin-residencial
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Generar JWT_SECRET seguro** (importante para producción)
```bash
npm run generate-secret
# Copiar el resultado a .env
```

5. **Iniciar el servidor**
```bash
npm run dev     # Desarrollo
npm run prod    # Producción
```

## ⚙️ Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `5000` |
| `NODE_ENV` | Ambiente | `development` / `production` |
| `MONGO_URI` | URI de MongoDB | `mongodb://localhost:27017/adminResidencial` |
| `JWT_SECRET` | Clave para firmar tokens | (usar generate-secret) |
| `ADMIN_CEDULA` | Cédula del admin inicial | `123456789` |
| `ADMIN_PASSWORD` | Contraseña del admin | `admin123` |

## 📁 Estructura del Proyecto

```
admin-residencial/
├── config/
│   ├── database.js          # Conexión MongoDB
│   ├── logger.js             # Sistema de logging
│   └── models/               # Modelos Mongoose
├── controllers/              # Lógica de negocio
├── middlewares/
│   ├── auth.middleware.js    # Autenticación JWT
│   ├── rateLimit.middleware.js # Limitación de requests
│   └── audit.middleware.js   # Registro de auditoría
├── routes/                   # Endpoints API
├── Vista/                    # Frontend (HTML/CSS/JS)
├── Reconocimiento/           # Sistema de placas (Python)
├── logs/                     # Archivos de log (auto-generados)
└── server.js                 # Punto de entrada
```

## 🔐 Seguridad

El proyecto implementa:
- ✅ Helmet (headers de seguridad HTTP)
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ JWT con expiración
- ✅ Bcrypt para passwords
- ✅ Auditoría de acciones
- ✅ Compresión gzip

## 📡 API Endpoints

### Autenticación
- `POST /api/usuarios/login` - Iniciar sesión
- `POST /api/usuarios/refresh-token` - Renovar token

### Usuarios
- `GET /api/usuarios` - Listar usuarios
- `POST /api/usuarios/crear` - Crear usuario
- `PUT /api/usuarios/:id` - Actualizar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Visitantes
- `GET /api/visitantes` - Listar visitantes
- `POST /api/visitantes/crear` - Registrar visitante
- `POST /api/visitantes/qr/generar/:id` - Generar QR

### Parqueaderos
- `GET /api/parqueaderos` - Estado de plazas
- `GET /api/parqueaderos/historial` - Historial de accesos

### Sistema
- `GET /api/health` - Health check
- `GET /api/config` - Configuración pública

## 📝 Scripts NPM

```bash
npm start           # Iniciar servidor
npm run dev         # Desarrollo (NODE_ENV=development)
npm run prod        # Producción (NODE_ENV=production)
npm run generate-secret  # Generar JWT_SECRET seguro
```

## 🐳 Docker

### Desarrollo rápido con Docker Compose
```bash
# Inicia la app + MongoDB
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Detener
docker-compose down
```

### Build manual
```bash
# Construir imagen
docker build -t admin-residencial .

# Ejecutar (requiere MongoDB externo)
docker run -p 5000:5000 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/adminResidencial \
  -e JWT_SECRET=tu_clave_secura \
  admin-residencial
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

ISC
