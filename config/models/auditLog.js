const mongoose = require('mongoose');

/**
 * Modelo de Log de Auditoría
 * Registra acciones importantes en el sistema
 */
const auditLogSchema = new mongoose.Schema({
    // Usuario que realizó la acción
    usuario: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
        cedula: String,
        nombre: String,
        rol: String
    },

    // Tipo de acción
    accion: {
        type: String,
        enum: [
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'LOGOUT',
            'CREATE_USER',
            'UPDATE_USER',
            'DELETE_USER',
            'CREATE_VISITANTE',
            'UPDATE_VISITANTE',
            'DELETE_VISITANTE',
            'CHANGE_PASSWORD',
            'RESET_PASSWORD',
            'ACCESS_DENIED',
            'RATE_LIMIT_EXCEEDED',
            'OTHER'
        ],
        required: true
    },

    // Descripción adicional
    descripcion: {
        type: String,
        default: ''
    },

    // Detalles del recurso afectado
    recurso: {
        tipo: String, // 'usuario', 'visitante', 'parqueadero', etc.
        id: String,
        nombre: String, // Nombre del recurso afectado para fácil visualización
        datosAnteriores: mongoose.Schema.Types.Mixed, // Estado ANTES del cambio
        datosNuevos: mongoose.Schema.Types.Mixed // Estado DESPUÉS del cambio
    },

    // Información de la request
    requestInfo: {
        ip: String,
        userAgent: String,
        method: String,
        path: String
    },

    // Estado del resultado
    resultado: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'BLOCKED'],
        default: 'SUCCESS'
    },

    // Timestamp
    fecha: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índices para búsquedas eficientes
auditLogSchema.index({ fecha: -1 });
auditLogSchema.index({ 'usuario.cedula': 1, fecha: -1 });
auditLogSchema.index({ 'usuario.rol': 1, fecha: -1 });
auditLogSchema.index({ accion: 1, fecha: -1 });
auditLogSchema.index({ 'requestInfo.ip': 1, fecha: -1 });

// Método estático para crear log
auditLogSchema.statics.registrar = async function (datos) {
    try {
        const log = new this(datos);
        await log.save();
        console.log(`📝 Audit: [${datos.accion}] ${datos.descripcion || ''}`);
        return log;
    } catch (error) {
        console.error('❌ Error guardando log de auditoría:', error);
        return null;
    }
};

// Método estático para obtener logs recientes
auditLogSchema.statics.obtenerRecientes = function (limite = 50) {
    return this.find()
        .sort({ fecha: -1 })
        .limit(limite)
        .lean();
};

// Método estático para obtener logs por usuario
auditLogSchema.statics.obtenerPorUsuario = function (cedula, limite = 20) {
    return this.find({ 'usuario.cedula': cedula })
        .sort({ fecha: -1 })
        .limit(limite)
        .lean();
};

// Método estático para obtener logs por IP
auditLogSchema.statics.obtenerPorIP = function (ip, limite = 20) {
    return this.find({ 'requestInfo.ip': ip })
        .sort({ fecha: -1 })
        .limit(limite)
        .lean();
};

// Método estático para estadísticas
auditLogSchema.statics.obtenerEstadisticas = async function (dias = 7) {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const stats = await this.aggregate([
        { $match: { fecha: { $gte: fechaInicio } } },
        {
            $group: {
                _id: '$accion',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const failed = await this.countDocuments({
        fecha: { $gte: fechaInicio },
        resultado: 'FAILED'
    });

    const blocked = await this.countDocuments({
        fecha: { $gte: fechaInicio },
        resultado: 'BLOCKED'
    });

    return { acciones: stats, intentosFallidos: failed, bloqueados: blocked };
};

// Método estático para supervisión de movimientos (porteros y residentes)
auditLogSchema.statics.obtenerMovimientosSupervision = async function (filtros = {}) {
    const {
        rol,
        accion,
        fechaInicio,
        fechaFin,
        page = 1,
        limit = 20
    } = filtros;

    let query = {
        // Solo acciones CRUD relevantes para supervisión
        accion: {
            $in: [
                'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
                'CREATE_VISITANTE', 'UPDATE_VISITANTE', 'DELETE_VISITANTE'
            ]
        }
    };

    // Filtrar por rol específico (porteria o residente)
    if (rol && rol !== 'todos') {
        query['usuario.rol'] = rol;
    } else {
        // Por defecto solo porteros y residentes (no admin)
        query['usuario.rol'] = { $in: ['porteria', 'residente'] };
    }

    // Filtrar por tipo de acción
    if (accion && accion !== 'todas') {
        query.accion = accion;
    }

    // Filtrar por rango de fechas
    if (fechaInicio || fechaFin) {
        query.fecha = {};
        if (fechaInicio) {
            query.fecha.$gte = new Date(fechaInicio);
        }
        if (fechaFin) {
            const fin = new Date(fechaFin);
            fin.setHours(23, 59, 59, 999);
            query.fecha.$lte = fin;
        }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [movimientos, total] = await Promise.all([
        this.find(query)
            .sort({ fecha: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        this.countDocuments(query)
    ]);

    return {
        data: movimientos,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
        }
    };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
