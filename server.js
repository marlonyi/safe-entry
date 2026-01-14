require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const conectarDB = require('./config/database');
const usuarioRoutes = require('./routes/usuario.routes');
const visitanteRoutes = require('./routes/visitante.routes');
const parqueaderoRoutes = require('./routes/parqueadero.routes');
const Usuario = require('./config/models/usuario');
const bcrypt = require('bcryptjs');
const { rateLimiter } = require('./middlewares/rateLimit.middleware');
const AuditLog = require('./config/models/auditLog');

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ========================================
// 📌 Configuración de CORS
// ========================================
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origin (apps móviles, Postman, etc)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:5000',
            'http://localhost:3000',
            'http://127.0.0.1:5000',
            process.env.FRONTEND_URL_LOCAL,
            process.env.FRONTEND_URL_PROD
        ].filter(Boolean); // Eliminar valores undefined

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS bloqueó origen: ${origin}`);
            callback(null, true); // En desarrollo permitir todo, en prod cambiar a callback(new Error('CORS'))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));  // Aumentado para permitir fotos de perfil en base64
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Rate limiting global
app.use(rateLimiter);

// ========================================
// 📌 Endpoint de configuración para frontend
// ========================================
app.get('/api/config', (req, res) => {
    res.json({
        apiUrl: isProduction
            ? process.env.FRONTEND_URL_PROD
            : `http://localhost:${port}`,
        environment: process.env.NODE_ENV || 'development'
    });
});

// ========================================
// 📌 Conexión a Base de Datos
// ========================================
(async () => {
    try {
        await conectarDB();
        console.log("✅ Conectado a MongoDB");
        await crearAdminSiNoExiste();
    } catch (err) {
        console.error("❌ Error conectando a MongoDB:", err);
    }
})();

// ========================================
// 📌 Rutas API
// ========================================
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/visitantes', visitanteRoutes);
app.use('/api/parqueaderos', parqueaderoRoutes);

// ========================================
// 📌 Rutas de Auditoría y Seguridad
// ========================================
const { getRateLimitStatus } = require('./middlewares/rateLimit.middleware');
const { verificarToken, esAdmin } = require('./middlewares/auth.middleware');

// Obtener logs de auditoría (solo admin)
app.get('/api/audit/logs', verificarToken, esAdmin, async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 50;
        const logs = await AuditLog.obtenerRecientes(limite);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo logs', mensaje: error.message });
    }
});

// Obtener estadísticas de auditoría
app.get('/api/audit/stats', verificarToken, esAdmin, async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 7;
        const stats = await AuditLog.obtenerEstadisticas(dias);
        const rateLimitStatus = getRateLimitStatus();
        res.json({ ...stats, rateLimiting: rateLimitStatus });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo estadísticas', mensaje: error.message });
    }
});

// Obtener logs por IP específica
app.get('/api/audit/ip/:ip', verificarToken, esAdmin, async (req, res) => {
    try {
        const logs = await AuditLog.obtenerPorIP(req.params.ip);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo logs por IP', mensaje: error.message });
    }
});

// ========================================
// 📌 Supervisión de Movimientos (solo admin)
// ========================================
app.get('/api/supervision/movimientos', verificarToken, esAdmin, async (req, res) => {
    try {
        const { rol, accion, fechaInicio, fechaFin, page, limit } = req.query;

        const resultado = await AuditLog.obtenerMovimientosSupervision({
            rol,
            accion,
            fechaInicio,
            fechaFin,
            page: page || 1,
            limit: limit || 20
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error obteniendo movimientos de supervisión:', error);
        res.status(500).json({
            error: 'Error obteniendo movimientos',
            mensaje: error.message
        });
    }
});

// Obtener detalle de un movimiento específico
app.get('/api/supervision/movimientos/:id', verificarToken, esAdmin, async (req, res) => {
    try {
        const movimiento = await AuditLog.findById(req.params.id).lean();
        if (!movimiento) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        res.json(movimiento);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo detalle', mensaje: error.message });
    }
});

// ========================================
// 📌 Archivos estáticos (Frontend)
// ========================================
app.use(express.static(path.join(__dirname, 'Vista')));

// ========================================
// 📌 Rutas de vistas
// ========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'LandingPage', 'Landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vista.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaadmin.html')));
app.get('/residente', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaresidente.html')));
app.get('/porteria', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteria.html')));
app.get('/porteriaactualizar', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteriaactualizar.html')));
app.get('/porteriaregistrar', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteriaregistrar.html')));
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'mapa.html')));
app.get('/hola', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'holamundo.html')));

// ========================================
// 📌 Crear usuario admin si no existe
// ========================================
async function crearAdminSiNoExiste() {
    try {
        const adminCedula = process.env.ADMIN_CEDULA || "123456789";
        const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

        const adminExistente = await Usuario.findOne({ cedula: adminCedula });
        if (!adminExistente) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const nuevoAdmin = new Usuario({
                nombre: "Admin",
                apellido: "Principal",
                cedula: adminCedula,
                apartamento: "N/A",
                torre: "N/A",
                password: hashedPassword,
                rol: "admin"
            });
            await nuevoAdmin.save();
            console.log("✅ Usuario administrador creado con éxito");
        } else {
            console.log("👤 Usuario administrador ya existe");
        }
    } catch (error) {
        console.error("❌ Error al crear el usuario administrador:", error);
    }
}

// ========================================
// 📌 Manejo de errores global
// ========================================
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err.stack);
    res.status(500).json({
        error: 'Error interno del servidor',
        mensaje: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

// ========================================
// 🚀 Iniciar servidor
// ========================================
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
    console.log(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API URL: http://localhost:${port}/api`);
});
