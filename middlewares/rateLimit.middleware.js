/**
 * Rate Limiting Middleware
 * Limita intentos de login y requests por IP
 */

// Store en memoria para rate limiting (en producción usar Redis)
const rateLimitStore = new Map();
const loginAttempts = new Map();

// Configuración
const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 100; // Máximo requests por minuto (general)
const MAX_LOGIN_ATTEMPTS = 5; // Máximo intentos de login
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueo

/**
 * Limpieza periódica del store (cada 5 minutos)
 */
setInterval(() => {
    const now = Date.now();

    // Limpiar rate limit general
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.windowStart > WINDOW_MS) {
            rateLimitStore.delete(key);
        }
    }

    // Limpiar intentos de login
    for (const [key, data] of loginAttempts.entries()) {
        if (now - data.lastAttempt > BLOCK_DURATION_MS) {
            loginAttempts.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Middleware de Rate Limiting general
 */
function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(ip);

    if (!record || now - record.windowStart > WINDOW_MS) {
        // Nueva ventana
        record = {
            windowStart: now,
            count: 1
        };
        rateLimitStore.set(ip, record);
        return next();
    }

    record.count++;

    if (record.count > MAX_REQUESTS) {
        console.warn(`⚠️ Rate limit excedido para IP: ${ip}`);
        return res.status(429).json({
            error: 'Demasiadas solicitudes',
            mensaje: 'Has excedido el límite de solicitudes. Intenta de nuevo en un momento.',
            retryAfter: Math.ceil((WINDOW_MS - (now - record.windowStart)) / 1000)
        });
    }

    next();
}

/**
 * Middleware específico para login
 */
function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const identifier = `${ip}-login`;
    const now = Date.now();

    let record = loginAttempts.get(identifier);

    // Verificar si está bloqueado
    if (record && record.blocked && now - record.blockedAt < BLOCK_DURATION_MS) {
        const remainingTime = Math.ceil((BLOCK_DURATION_MS - (now - record.blockedAt)) / 1000);
        return res.status(429).json({
            error: 'Cuenta bloqueada temporalmente',
            mensaje: `Has excedido el número máximo de intentos. Intenta de nuevo en ${Math.ceil(remainingTime / 60)} minutos.`,
            retryAfter: remainingTime,
            blocked: true
        });
    }

    // Resetear si el bloqueo expiró
    if (record && record.blocked && now - record.blockedAt >= BLOCK_DURATION_MS) {
        loginAttempts.delete(identifier);
        record = null;
    }

    if (!record) {
        record = {
            attempts: 0,
            lastAttempt: now,
            blocked: false
        };
        loginAttempts.set(identifier, record);
    }

    // Guardar referencia para usar después de la respuesta
    req.loginAttemptRecord = record;
    req.loginAttemptIdentifier = identifier;

    next();
}

/**
 * Registrar intento de login fallido
 */
function recordFailedLogin(req) {
    const identifier = req.loginAttemptIdentifier;
    let record = loginAttempts.get(identifier);

    if (!record) {
        record = {
            attempts: 0,
            lastAttempt: Date.now(),
            blocked: false
        };
        loginAttempts.set(identifier, record);
    }

    record.attempts++;
    record.lastAttempt = Date.now();

    if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
        record.blocked = true;
        record.blockedAt = Date.now();
        console.warn(`🔒 IP bloqueada por múltiples intentos fallidos: ${req.ip}`);
    }

    return {
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - record.attempts,
        blocked: record.blocked
    };
}

/**
 * Resetear intentos de login exitoso
 */
function resetLoginAttempts(req) {
    const identifier = req.loginAttemptIdentifier;
    if (identifier) {
        loginAttempts.delete(identifier);
    }
}

/**
 * Obtener estado de rate limiting
 */
function getRateLimitStatus() {
    return {
        activeIPs: rateLimitStore.size,
        blockedLogins: [...loginAttempts.values()].filter(r => r.blocked).length
    };
}

module.exports = {
    rateLimiter,
    loginRateLimiter,
    recordFailedLogin,
    resetLoginAttempts,
    getRateLimitStatus
};
