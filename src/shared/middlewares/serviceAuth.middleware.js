/**
 * Autenticación por secreto compartido para servicios sin sesión de usuario
 * (p. ej. el script de cámara/LPR que corre on-premise).
 *
 * Política (warn-and-allow):
 *  - Si CAMERA_SERVICE_KEY NO está configurada, se deja pasar con un warning
 *    en logs (cómodo para desarrollo/local).
 *  - Si SÍ está configurada, se exige el header X-Camera-Service-Key correcto,
 *    o se responde 401.
 */
const verificarServicioCamara = (req, res, next) => {
    const secret = req.headers['x-camera-service-key'];

    if (!process.env.CAMERA_SERVICE_KEY) {
        console.warn('⚠️ CAMERA_SERVICE_KEY no configurado — rutas de cámara sin protección');
        return next();
    }

    if (secret !== process.env.CAMERA_SERVICE_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    next();
};

module.exports = { verificarServicioCamara };
