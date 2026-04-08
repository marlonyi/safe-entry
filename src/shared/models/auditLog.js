/**
 * Re-exporta el modelo AuditLog desde la ubicación canónica.
 * No se redefine el modelo aquí para evitar el error de Mongoose:
 * "Cannot overwrite `AuditLog` model once compiled."
 */
module.exports = require('../../../models/auditLog');