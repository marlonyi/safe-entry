/**
 * Re-exporta el modelo Visitante desde la ubicación canónica (src/modules).
 * No se redefine aquí para evitar OverwriteModelError de Mongoose.
 */
module.exports = require('../src/modules/visitantes/visitante.model');
