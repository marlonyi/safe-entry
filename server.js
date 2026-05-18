require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet'); // 🛡️ Headers de seguridad HTTP
const compression = require('compression'); // 📦 Compresión gzip de respuestas

// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { config, logger, middlewares, models } = require('./src');
const conectarDB = config.database;
const cache = config.cache;

// Modelos
const { Usuario, Conjunto, Parqueadero, HistorialAcceso, AuditLog } = models;

// Middlewares
const { rateLimiter } = middlewares.rateLimit;
const { verificarToken, esAdmin, getConjuntoId, isSuperAdmin } = middlewares.auth;
const { getRateLimitStatus } = middlewares.rateLimit;

// Rutas (aún en ubicación original por ahora)
const usuarioRoutes = require('./src/modules/usuarios/usuario.routes');
const visitanteRoutes = require('./src/modules/visitantes/visitante.routes');
const parqueaderoRoutes = require('./src/modules/parqueaderos/parqueadero.routes');
const conjuntoRoutes = require('./src/modules/conjuntos/conjunto.routes');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ========================================
// 🔒 Validación de seguridad al inicio
// ========================================
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secreto')) {
    console.error('⚠️ ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está configurado correctamente para producción');
}

// ========================================
// 📌 Configuración de CORS
// ========================================

// Función para detectar si un origen es una IP privada (on-premise)
function isPrivateIP(origin) {
    if (!origin) return false;
    const url = origin.replace(/^https?:\/\//, '').split(':')[0];
    return url === 'localhost' ||
        url === '127.0.0.1' ||
        url.startsWith('192.168.') ||
        url.startsWith('10.') ||
        url.startsWith('172.16.') || url.startsWith('172.17.') ||
        url.startsWith('172.18.') || url.startsWith('172.19.') ||
        url.startsWith('172.2') || url.startsWith('172.30.') || url.startsWith('172.31.');
}

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origin (apps móviles, Postman, etc)
        if (!origin) return callback(null, true);

        // Permitir cualquier IP privada (on-premise / desarrollo local)
        if (isPrivateIP(origin)) {
            console.log(`✅ CORS permitió origen local/on-premise: ${origin}`);
            return callback(null, true);
        }

        const allowedOrigins = [
            'http://localhost:5000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:5000',
            'http://127.0.0.1:3000',
            process.env.FRONTEND_URL_LOCAL,
            process.env.FRONTEND_URL_PROD
        ].filter(Boolean); // Eliminar valores undefined

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else if (isProduction) {
            // En producción: bloquear orígenes no autorizados
            console.warn(`🚫 CORS bloqueó origen no autorizado: ${origin}`);
            callback(new Error('No permitido por CORS'));
        } else {
            // En desarrollo: permitir pero registrar advertencia
            console.warn(`⚠️ CORS permitió origen no listado (desarrollo): ${origin}`);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// 🛡️ Headers de seguridad HTTP (Helmet)
// Configuración permisiva para no romper funcionalidad existente
app.use(helmet({
    contentSecurityPolicy: false, // Deshabilitado para no romper scripts inline en HTML
    crossOriginEmbedderPolicy: false, // Permite cargar recursos externos
    crossOriginResourcePolicy: { policy: "cross-origin" } // Permite recursos cross-origin
}));

// 📦 Compresión gzip de respuestas (mejora rendimiento)
app.use(compression());

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
        logger.info('✅ Conectado a MongoDB');
        await crearAdminSiNoExiste();
    } catch (err) {
        logger.error('❌ Error conectando a MongoDB:', { error: err.message });
    }
})();

// ========================================
// 📌 Rutas API
// ========================================
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/visitantes', visitanteRoutes);
app.use('/api/parqueaderos', parqueaderoRoutes);
app.use('/api/conjuntos', conjuntoRoutes); // 🏢 Rutas de gestión de conjuntos (multi-tenant)
app.use('/api/telemetria', require('./src/modules/telemetria/telemetria.routes'));
app.use('/api/scripts', require('./src/modules/telemetria/scripts.routes')); // 📡 Telemetría on-premise
app.use('/api/chat', require('./src/modules/chatbot/chatbot.routes')); // 🤖 Chatbot Groq AI
app.use('/api/modelo', require('./src/modules/modelo/modelo.routes')); // 📐 Modelo de Programación Lineal

// ========================================
// 💓 Health Check (para monitoreo)
// ========================================
app.get('/api/health', async (req, res) => {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus
    });
});

// ========================================
// 📌 Rutas de Auditoría y Seguridad
// ========================================

// Obtener estadísticas del cache (solo admin)
app.get('/api/cache/stats', verificarToken, esAdmin, (req, res) => {
    res.json({
        cache: cache.getStats(),
        timestamp: new Date().toISOString()
    });
});

// Limpiar cache (solo admin)
app.post('/api/cache/clear', verificarToken, esAdmin, (req, res) => {
    cache.clear();
    logger.info('🧹 Cache limpiado manualmente por admin');
    res.json({
        success: true,
        message: 'Cache limpiado correctamente'
    });
});

// 🏢 Obtener logs de auditoría (solo admin) - MULTI-TENANT
app.get('/api/audit/logs', verificarToken, esAdmin, async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 50;
        // 🏢 SuperAdmin ve todos, otros solo de su conjunto
        const conjuntoId = isSuperAdmin(req) ? null : getConjuntoId(req);
        const logs = await AuditLog.obtenerRecientes(limite, conjuntoId);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo logs', mensaje: error.message });
    }
});

// 🏢 Obtener estadísticas de auditoría - MULTI-TENANT
app.get('/api/audit/stats', verificarToken, esAdmin, async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 7;
        // 🏢 TODO: Agregar filtro por conjunto si no es superadmin
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
// 📌 Supervisión de Movimientos (solo admin) - MULTI-TENANT
// ========================================
app.get('/api/supervision/movimientos', verificarToken, esAdmin, async (req, res) => {
    try {
        const { rol, accion, fechaInicio, fechaFin, page, limit } = req.query;

        // 🏢 MULTI-TENANT: SuperAdmin ve todos, otros solo de su conjunto
        const conjuntoId = isSuperAdmin(req) ? null : getConjuntoId(req);

        const resultado = await AuditLog.obtenerMovimientosSupervision({
            conjuntoId,  // 🏢 Filtro por conjunto
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

// 🏢 Obtener detalle de un movimiento específico - MULTI-TENANT
app.get('/api/supervision/movimientos/:id', verificarToken, esAdmin, async (req, res) => {
    try {
        const movimiento = await AuditLog.findById(req.params.id).lean();
        if (!movimiento) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }

        // 🏢 MULTI-TENANT: Verificar que el movimiento pertenece al conjunto del usuario
        if (!isSuperAdmin(req)) {
            const conjuntoId = getConjuntoId(req);
            if (movimiento.conjunto && movimiento.conjunto.toString() !== conjuntoId) {
                return res.status(403).json({ error: 'No tienes permisos para ver este movimiento' });
            }
        }

        res.json(movimiento);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo detalle', mensaje: error.message });
    }
});

// ========================================
// 📌 Archivos estáticos (Frontend)

async function crearAdminSiNoExiste() {
    try {
        const superadminCedula = process.env.SUPERADMIN_CEDULA || process.env.ADMIN_CEDULA || "123456789";
        const superadminPassword = process.env.SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";

        // 1. Verificar/crear conjunto por defecto para migración
        let conjuntoPorDefecto = await Conjunto.findOne({ nombre: "Conjunto Principal" });
        if (!conjuntoPorDefecto) {
            conjuntoPorDefecto = new Conjunto({
                nombre: "Conjunto Principal",
                direccion: "Por configurar",
                ciudad: "Por configurar",
                estado: "activo"
            });
            await conjuntoPorDefecto.save();
            console.log("🏢 Conjunto Principal creado para migración");
        }

        // 2. Verificar/crear superadmin
        const superadminExistente = await Usuario.findOne({ cedula: superadminCedula, rol: 'superadmin' });
        if (!superadminExistente) {
            // Verificar si existe como admin normal y actualizarlo
            const adminExistente = await Usuario.findOne({ cedula: superadminCedula });
            if (adminExistente) {
                adminExistente.rol = 'superadmin';
                adminExistente.conjunto = null; // SuperAdmin no pertenece a ningún conjunto
                await adminExistente.save();
                console.log("🔄 Admin existente actualizado a SuperAdmin");
            } else {
                const hashedPassword = await bcrypt.hash(superadminPassword, 10);
                const nuevoSuperAdmin = new Usuario({
                    nombre: "Super",
                    apellido: "Administrador",
                    cedula: superadminCedula,
                    apartamento: "N/A",
                    torre: "N/A",
                    password: hashedPassword,
                    rol: "superadmin",
                    conjunto: null // SuperAdmin no pertenece a ningún conjunto
                });
                await nuevoSuperAdmin.save();
                console.log("✅ SuperAdmin creado con éxito");
            }
        } else {
            console.log("👤 SuperAdmin ya existe");
        }
    } catch (error) {
        console.error("❌ Error al crear SuperAdmin/Conjunto:", error);
    }
}

// ========================================
// 📌 Manejo de errores global
// ========================================
app.use((err, req, res, next) => {
    logger.error('❌ Error no manejado:', { error: err.message, stack: err.stack });
    res.status(500).json({
        error: 'Error interno del servidor',
        mensaje: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
    });
});

// ========================================
// 🚀 Iniciar servidor
// ========================================
app.listen(port, () => {
    logger.info(`🚀 Servidor corriendo en http://localhost:${port}`);
    logger.info(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 API URL: http://localhost:${port}/api`);

    // 📡 Sistema de Heartbeat para instalaciones on-premise
    iniciarHeartbeat();
});

// ========================================
// 📡 Sistema de Heartbeat (On-Premise → Azure)
// ========================================
async function iniciarHeartbeat() {
    const AZURE_URL = process.env.AZURE_URL || 'https://safe-entry-fff6afd0gje3drcq.chilecentral-01.azurewebsites.net';
    const INSTALACION_ID = process.env.INSTALACION_ID;
    const NOMBRE_INSTALACION = process.env.NOMBRE_INSTALACION || 'Instalación Sin Nombre';
    const HEARTBEAT_INTERVALO = parseInt(process.env.HEARTBEAT_INTERVALO) || 300000; // 5 minutos

    // Solo activar heartbeat si hay un ID de instalación configurado
    // (esto significa que es una instalación on-premise, no Azure mismo)
    if (!INSTALACION_ID) {
        logger.info('📡 Heartbeat desactivado (no hay INSTALACION_ID configurado)');
        return;
    }

    logger.info(`📡 Heartbeat activado - Reportando a ${AZURE_URL} cada ${HEARTBEAT_INTERVALO / 1000}s`);

    const axios = require('axios');
    const os = require('os');

    async function enviarHeartbeat() {
        try {
            // Recopilar estadísticas
            const usuarios = await Usuario.aggregate([
                { $group: { _id: "$rol", count: { $sum: 1 } } }
            ]);

            const usuariosStats = { residentes: 0, porteros: 0, admins: 0, total: 0 };
            usuarios.forEach(u => {
                if (u._id === 'residente') usuariosStats.residentes = u.count;
                else if (u._id === 'porteria') usuariosStats.porteros = u.count;
                else if (u._id === 'admin') usuariosStats.admins = u.count;
                usuariosStats.total += u.count;
            });

            // Estadísticas de parqueaderos
            const plazas = await Parqueadero.find();
            const plazasStats = {
                total: plazas.length,
                ocupadas: plazas.filter(p => p.estado === 'OCUPADO').length,
                libres: plazas.filter(p => p.estado === 'LIBRE').length,
                enEspera: plazas.filter(p => p.estado === 'EN_ESPERA').length
            };

            // Estadísticas de accesos
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(inicioSemana.getDate() - 7);
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

            let accesosStats = { hoy: 0, semana: 0, mes: 0 };
            try {
                accesosStats.hoy = await HistorialAcceso.countDocuments({ fecha: { $gte: hoy } });
                accesosStats.semana = await HistorialAcceso.countDocuments({ fecha: { $gte: inicioSemana } });
                accesosStats.mes = await HistorialAcceso.countDocuments({ fecha: { $gte: inicioMes } });
            } catch (e) {
                // HistorialAcceso podría no existir
            }

            // Estado de salud
            const mongoose = require('mongoose');
            const memUsage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();

            const salud = {
                mongodb: mongoose.connection.readyState === 1 ? 'ok' : 'error',
                uptime: Math.floor(process.uptime()),
                memoria: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`,
                sistemaMemoria: `${Math.round(((totalMem - freeMem) / totalMem) * 100)}%`,
                cpu: `${os.loadavg()[0].toFixed(2)}`
            };

            // Enviar heartbeat
            const response = await axios.post(`${AZURE_URL}/api/telemetria/heartbeat`, {
                instalacionId: INSTALACION_ID,
                nombre: NOMBRE_INSTALACION,
                version: process.env.APP_VERSION || '1.0.0',
                stats: {
                    usuarios: usuariosStats,
                    plazas: plazasStats,
                    accesos: accesosStats
                },
                salud
            }, { timeout: 10000 });

            // Procesar configuración remota si la hay
            if (response.data.configuracion) {
                // Aquí podrías aplicar configuraciones remotas
                if (response.data.mensaje) {
                    logger.info(`📬 Mensaje de Azure: ${response.data.mensaje}`);
                }
            }

            logger.info('📡 Heartbeat enviado correctamente');

        } catch (error) {
            logger.warn(`⚠️ Error enviando heartbeat: ${error.message}`);
        }
    }

    // Enviar primer heartbeat después de 30 segundos
    setTimeout(enviarHeartbeat, 30000);

    // Continuar enviando periódicamente
    setInterval(enviarHeartbeat, HEARTBEAT_INTERVALO);
}
