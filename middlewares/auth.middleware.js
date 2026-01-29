const jwt = require('jsonwebtoken');

// 🔒 Validación de seguridad JWT_SECRET
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'secreto';

// En producción: FALLAR si JWT_SECRET no está configurado correctamente
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secreto')) {
    throw new Error('❌ CRÍTICO: JWT_SECRET debe estar configurado correctamente en producción. Configure una clave segura en .env');
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secreto') {
    console.warn('⚠️ auth.middleware: JWT_SECRET usando valor por defecto (solo válido para desarrollo)');
}

/**
 * Middleware para verificar autenticación JWT
 * Uso: router.get('/ruta-protegida', verificarToken, controlador)
 */
const verificarToken = (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({
                error: 'Acceso denegado. No se proporcionó token de autenticación.'
            });
        }

        // Formato esperado: "Bearer <token>"
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        if (!token) {
            return res.status(401).json({
                error: 'Token no válido o mal formateado.'
            });
        }

        // Verificar token usando el secret de .env
        const decoded = jwt.verify(token, JWT_SECRET);

        // Agregar datos del usuario al request (ahora incluye conjuntoId)
        req.usuario = decoded;
        next();
    } catch (error) {
        console.error('Error verificando token:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado. Por favor inicie sesión nuevamente.'
            });
        }

        return res.status(401).json({
            error: 'Token inválido.'
        });
    }
};

// ========================================
// 📌 MIDDLEWARES DE ROL MULTI-TENANT
// ========================================

/**
 * Middleware para verificar rol de superadmin (acceso global)
 * Solo usuarios con rol 'superadmin' pueden acceder
 */
const esSuperAdmin = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.usuario.rol !== 'superadmin') {
        return res.status(403).json({
            error: 'Requiere permisos de superadministrador para esta acción.'
        });
    }

    next();
};

/**
 * Middleware para verificar rol de administrador
 * Acepta: superadmin (global) o admin (del conjunto)
 */
const esAdmin = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    // Superadmin siempre tiene acceso de admin
    if (req.usuario.rol === 'superadmin' || req.usuario.rol === 'admin') {
        return next();
    }

    return res.status(403).json({
        error: 'No tienes permisos de administrador para esta acción.'
    });
};

/**
 * Middleware para verificar rol de portería o admin
 * Acepta: superadmin, admin, porteria
 */
const esPorteriaOAdmin = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const rolesPermitidos = ['superadmin', 'admin', 'porteria'];

    if (!rolesPermitidos.includes(req.usuario.rol)) {
        return res.status(403).json({
            error: 'No tienes permisos para esta acción.'
        });
    }

    next();
};

// ========================================
// 📌 HELPERS PARA FILTRADO MULTI-TENANT
// ========================================

/**
 * Helper para obtener filtro de tenant en queries
 * - SuperAdmin: sin filtro (acceso global)
 * - Otros roles: filtra por su conjunto
 * 
 * @param {Object} req - Request con usuario decodificado
 * @returns {Object} Filtro MongoDB para agregar a queries
 * 
 * Uso: const filtro = getTenantFilter(req);
 *      Model.find({ ...filtro, ...otrosFiltros })
 */
const getTenantFilter = (req) => {
    // SuperAdmin tiene acceso global
    if (req.usuario?.rol === 'superadmin') {
        return {};
    }

    // Otros usuarios solo ven datos de su conjunto
    return { conjunto: req.usuario?.conjuntoId || null };
};

/**
 * Helper para verificar si usuario es superadmin
 */
const isSuperAdmin = (req) => {
    return req.usuario?.rol === 'superadmin';
};

/**
 * Helper para obtener conjuntoId del usuario
 * Retorna null para superadmin o si no hay usuario
 */
const getConjuntoId = (req) => {
    if (!req.usuario || req.usuario.rol === 'superadmin') {
        return null;
    }
    return req.usuario.conjuntoId;
};

module.exports = {
    verificarToken,
    esSuperAdmin,
    esAdmin,
    esPorteriaOAdmin,
    // Helpers
    getTenantFilter,
    isSuperAdmin,
    getConjuntoId
};
