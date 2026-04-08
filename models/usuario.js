/**
 * Re-exporta el modelo Usuario desde la ubicación canónica (src/modules).
 * No se redefine aquí para evitar OverwriteModelError de Mongoose.
 */
module.exports = require('../src/modules/usuarios/usuario.model');
