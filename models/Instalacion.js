/**
 * Re-exporta el modelo Instalacion desde la ubicación canónica (src/modules).
 * No se redefine aquí para evitar OverwriteModelError de Mongoose.
 */
module.exports = require('../src/modules/telemetria/instalacion.model');
