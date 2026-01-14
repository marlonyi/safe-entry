const jwt = require('jsonwebtoken');

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
        const secretKey = process.env.JWT_SECRET || 'secreto';
        const decoded = jwt.verify(token, secretKey);
        
        // Agregar datos del usuario al request
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

/**
 * Middleware para verificar rol de administrador
 * Debe usarse después de verificarToken
 */
const esAdmin = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ 
            error: 'No tienes permisos de administrador para esta acción.' 
        });
    }
    
    next();
};

/**
 * Middleware para verificar rol de portería o admin
 */
const esPorteriaOAdmin = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'porteria') {
        return res.status(403).json({ 
            error: 'No tienes permisos para esta acción.' 
        });
    }
    
    next();
};

module.exports = {
    verificarToken,
    esAdmin,
    esPorteriaOAdmin
};
