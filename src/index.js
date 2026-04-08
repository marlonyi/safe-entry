/**
 * Admin Residencial - Punto de entrada de módulos
 * Este archivo exporta todos los componentes organizados por la arquitectura modular
 */

// Shared components
const shared = require('./shared');

// Business modules
const modules = require('./modules');

module.exports = {
    // Configuración
    config: shared.config,
    logger: shared.logger,

    // Middlewares
    middlewares: shared.middlewares,

    // Modelos compartidos
    sharedModels: shared.models,

    // Módulos de negocio
    ...modules
};