/**
 * Re-exporta el modelo HistorialAcceso desde la ubicación canónica (models/).
 * No se redefine aquí para evitar OverwriteModelError de Mongoose.
 */
module.exports = require('../../../models/historialAcceso');