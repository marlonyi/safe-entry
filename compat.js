/**
 * Archivo de compatibilidad
 * Exporta desde la nueva estructura manteniendo las rutas antiguas
 * Esto permite una migración gradual sin romper el código existente
 */

// ============================================
// COMPATIBILIDAD HACIA ATRÁS
// Los imports antiguos siguen funcionando
// pero redirigen a la nueva estructura
// ============================================

// Config
module.exports.database = require('./src/shared/config/database');
module.exports.logger = require('./src/shared/config/logger');
module.exports.cache = require('./src/shared/config/cache');
module.exports.appConfig = require('./src/shared/config/app.config');

// Middlewares
module.exports.authMiddleware = require('./src/shared/middlewares/auth.middleware');
module.exports.auditMiddleware = require('./src/shared/middlewares/audit.middleware');
module.exports.rateLimitMiddleware = require('./src/shared/middlewares/rateLimit.middleware');
module.exports.planLimitsMiddleware = require('./src/shared/middlewares/planLimits.middleware');
module.exports.validationMiddleware = require('./src/shared/middlewares/validation.middleware');

// Modelos compartidos
module.exports.AuditLog = require('./src/shared/models/auditLog');
module.exports.HistorialAcceso = require('./src/shared/models/historialAcceso');

// Modelos de negocio
module.exports.Usuario = require('./src/modules/usuarios/usuario.model');
module.exports.Visitante = require('./src/modules/visitantes/visitante.model');
module.exports.Parqueadero = require('./src/modules/parqueaderos/parqueadero.model');
module.exports.Conjunto = require('./src/modules/conjuntos/conjunto.model');
module.exports.Instalacion = require('./src/modules/telemetria/instalacion.model');

// Servicios
module.exports.visitanteService = require('./src/modules/visitantes/visitante.service');
module.exports.parqueaderoService = require('./src/modules/parqueaderos/parqueadero.service');
module.exports.conjuntoService = require('./src/modules/conjuntos/conjunto.service');