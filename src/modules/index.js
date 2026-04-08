/**
 * Módulos de Negocio - Index
 * Exporta todos los módulos de la aplicación
 */

// Modelos
const Usuario = require('./usuarios/usuario.model');
const Visitante = require('./visitantes/visitante.model');
const Parqueadero = require('./parqueaderos/parqueadero.model');
const Conjunto = require('./conjuntos/conjunto.model');
const Instalacion = require('./telemetria/instalacion.model');

// Servicios
const visitanteService = require('./visitantes/visitante.service');
const parqueaderoService = require('./parqueaderos/parqueadero.service');
const conjuntoService = require('./conjuntos/conjunto.service');

module.exports = {
    // Modelos
    models: {
        Usuario,
        Visitante,
        Parqueadero,
        Conjunto,
        Instalacion
    },

    // Servicios
    services: {
        visitante: visitanteService,
        parqueadero: parqueaderoService,
        conjunto: conjuntoService
    }
};