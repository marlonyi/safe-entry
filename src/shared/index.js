/**
 * Shared Module Index
 * Exporta todos los componentes compartidos
 */

// Config
const database = require('./config/database');
const appConfig = require('./config/app.config');
const cache = require('./config/cache');
const logger = require('./config/logger');

// Middlewares
const authMiddleware = require('./middlewares/auth.middleware');
const auditMiddleware = require('./middlewares/audit.middleware');
const rateLimitMiddleware = require('./middlewares/rateLimit.middleware');
const planLimitsMiddleware = require('./middlewares/planLimits.middleware');
const validationMiddleware = require('./middlewares/validation.middleware');

// Shared Models
const AuditLog = require('./models/auditLog');
const HistorialAcceso = require('./models/historialAcceso');

module.exports = {
    // Config
    config: {
        database,
        app: appConfig,
        cache
    },
    logger,

    // Middlewares
    middlewares: {
        auth: authMiddleware,
        audit: auditMiddleware,
        rateLimit: rateLimitMiddleware,
        planLimits: planLimitsMiddleware,
        validation: validationMiddleware
    },

    // Models
    models: {
        AuditLog,
        HistorialAcceso
    }
};