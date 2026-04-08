/**
 * Middleware de Auditoría
 * Facilita el registro de logs en controladores
 */

const AuditLog = require('../models/auditLog');

/**
 * Extrae información de la request para el log
 */
function getRequestInfo(req) {
    return {
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        path: req.originalUrl || req.path
    };
}

/**
 * Registra una acción en el log de auditoría
 */
async function registrarAuditoria(req, accion, opciones = {}) {
    try {
        const datos = {
            usuario: {
                id: req.user?._id || opciones.usuarioId,
                cedula: req.user?.cedula || opciones.cedula || 'anonymous',
                nombre: req.user?.nombre || opciones.nombre || 'Anónimo',
                rol: req.user?.rol || opciones.rol || 'unknown'
            },
            accion,
            descripcion: opciones.descripcion || '',
            recurso: opciones.recurso || null,
            requestInfo: getRequestInfo(req),
            resultado: opciones.resultado || 'SUCCESS'
        };

        return await AuditLog.registrar(datos);
    } catch (error) {
        console.error('❌ Error en registrarAuditoria:', error);
        return null;
    }
}

/**
 * Middleware que se ejecuta después de las acciones
 * para registrar automáticamente ciertas operaciones
 */
function auditMiddleware(accion, getDescripcion) {
    return (req, res, next) => {
        // Guardar el método original de res.json
        const originalJson = res.json.bind(res);

        res.json = function (data) {
            // Registrar después de enviar respuesta
            setImmediate(async () => {
                try {
                    const descripcion = typeof getDescripcion === 'function'
                        ? getDescripcion(req, data)
                        : getDescripcion || '';

                    const resultado = res.statusCode >= 400 ? 'FAILED' : 'SUCCESS';

                    await registrarAuditoria(req, accion, {
                        descripcion,
                        resultado,
                        recurso: {
                            tipo: req.baseUrl?.replace('/api/', '') || 'unknown',
                            id: req.params?.id || data?._id || data?.id,
                            datos: res.statusCode < 400 ? { id: data?._id || data?.id } : null
                        }
                    });
                } catch (error) {
                    console.error('Error en audit middleware:', error);
                }
            });

            return originalJson(data);
        };

        next();
    };
}

/**
 * Funciones helper para casos comunes
 */
const audit = {
    // Login exitoso
    loginSuccess: (req, usuario) => registrarAuditoria(req, 'LOGIN_SUCCESS', {
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        rol: usuario.rol,
        descripcion: `Usuario ${usuario.nombre} inició sesión`
    }),

    // Login fallido
    loginFailed: (req, cedula, razon = 'Credenciales incorrectas') => registrarAuditoria(req, 'LOGIN_FAILED', {
        cedula,
        descripcion: `Intento de login fallido para ${cedula}: ${razon}`,
        resultado: 'FAILED'
    }),

    // Logout
    logout: (req) => registrarAuditoria(req, 'LOGOUT', {
        descripcion: `Usuario ${req.user?.nombre || 'unknown'} cerró sesión`
    }),

    // Crear usuario
    createUser: (req, nuevoUsuario) => registrarAuditoria(req, 'CREATE_USER', {
        descripcion: `Se creó usuario: ${nuevoUsuario.nombre} ${nuevoUsuario.apellido} (${nuevoUsuario.rol})`,
        recurso: { tipo: 'usuario', id: nuevoUsuario._id?.toString() }
    }),

    // Actualizar usuario
    updateUser: (req, usuarioId) => registrarAuditoria(req, 'UPDATE_USER', {
        descripcion: `Se actualizó usuario ID: ${usuarioId}`,
        recurso: { tipo: 'usuario', id: usuarioId }
    }),

    // Eliminar usuario
    deleteUser: (req, usuarioId, nombre) => registrarAuditoria(req, 'DELETE_USER', {
        descripcion: `Se eliminó usuario: ${nombre || usuarioId}`,
        recurso: { tipo: 'usuario', id: usuarioId }
    }),

    // Crear visitante
    createVisitante: (req, visitante) => registrarAuditoria(req, 'CREATE_VISITANTE', {
        descripcion: `Se registró visitante: ${visitante.nombre} para ${visitante.apartamentoDestino}`,
        recurso: { tipo: 'visitante', id: visitante._id?.toString() }
    }),

    // Cambio de contraseña
    changePassword: (req, usuarioId) => registrarAuditoria(req, 'CHANGE_PASSWORD', {
        descripcion: `Se cambió la contraseña del usuario`,
        recurso: { tipo: 'usuario', id: usuarioId }
    }),

    // Acceso denegado
    accessDenied: (req, razon) => registrarAuditoria(req, 'ACCESS_DENIED', {
        descripcion: `Acceso denegado: ${razon}`,
        resultado: 'BLOCKED'
    }),

    // Rate limit excedido
    rateLimitExceeded: (req) => registrarAuditoria(req, 'RATE_LIMIT_EXCEEDED', {
        descripcion: `Rate limit excedido para IP: ${req.ip}`,
        resultado: 'BLOCKED'
    })
};

module.exports = {
    registrarAuditoria,
    auditMiddleware,
    audit,
    getRequestInfo
};