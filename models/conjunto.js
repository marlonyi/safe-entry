/**
 * Re-exporta el modelo Conjunto desde la ubicación canónica (src/modules).
 * No se redefine aquí para evitar OverwriteModelError de Mongoose.
 */
module.exports = require('../src/modules/conjuntos/conjunto.model');
