// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { models, logger } = require('../../index');
const { AuditLog } = models;
const conjuntoService = require('./conjunto.service');
const { successResponse, errorResponse } = require('../../../utils/responseHandler');

const crearConjunto = async (req, res) => {
    try {
        const nuevoConjunto = await conjuntoService.crearConjunto(req.body);
        
        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'CREATE_CONJUNTO',
                descripcion: `Registró el conjunto: ${nuevoConjunto.nombre}`,
                recurso: { tipo: 'conjunto', id: nuevoConjunto._id.toString() },
                nivel: 'critical'
            });
        }
        
        return successResponse(res, nuevoConjunto, "Conjunto creado exitosamente", 201);
    } catch (error) {
        logger.error('Error crearConjunto:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

const obtenerConjuntos = async (req, res) => {
    try {
        const data = await conjuntoService.obtenerConjuntos(req.query);
        return successResponse(res, data, "Conjuntos obtenidos");
    } catch (error) {
        logger.error('Error obtenerConjuntos:', error.message);
        return errorResponse(res, "Error al obtener conjuntos", 500);
    }
};

const obtenerConjuntoPorId = async (req, res) => {
    try {
        const conjunto = await conjuntoService.obtenerConjuntoPorId(req.params.id);
        return successResponse(res, conjunto, "Conjunto obtenido");
    } catch (error) {
        logger.error('Error obtenerConjuntoPorId:', error.message);
        return errorResponse(res, error.message, 404);
    }
};

const actualizarConjunto = async (req, res) => {
    try {
        const actualizado = await conjuntoService.actualizarConjunto(req.params.id, req.body);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'UPDATE_CONJUNTO',
                descripcion: `Actualizó datos del conjunto: ${actualizado.nombre}`,
                recurso: { tipo: 'conjunto', id: actualizado._id.toString() },
                nivel: 'warning'
            });
        }

        return successResponse(res, actualizado, "Conjunto actualizado exitosamente");
    } catch (error) {
        logger.error('Error actualizarConjunto:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

const eliminarConjunto = async (req, res) => {
    try {
        const conjunto = await conjuntoService.eliminarConjunto(req.params.id);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'DELETE_CONJUNTO',
                descripcion: `Suspendió el conjunto: ${conjunto.nombre}`,
                recurso: { tipo: 'conjunto', id: conjunto._id.toString() },
                nivel: 'critical'
            });
        }

        return successResponse(res, null, "Conjunto suspendido exitosamente");
    } catch (error) {
        logger.error('Error eliminarConjunto:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

const obtenerEstadisticasGlobales = async (req, res) => {
    try {
        const stats = await conjuntoService.obtenerEstadisticasGlobales();
        return successResponse(res, stats, "Estadísticas globales obtenidas");
    } catch (error) {
        logger.error('Error obtenerEstadisticasGlobales:', error.message);
        return errorResponse(res, "Error interno al calcular estadísticas", 500);
    }
};

const listarConjuntosParaSelector = async (req, res) => {
    try {
        const lista = await conjuntoService.listarConjuntosParaSelector();
        return successResponse(res, lista, "Lista de conjuntos obtenida");
    } catch (error) {
        logger.error('Error listarConjuntosParaSelector:', error.message);
        return errorResponse(res, "Error al listar conjuntos", 500);
    }
};

const actualizarPlan = async (req, res) => {
    try {
        const actualizado = await conjuntoService.actualizarPlan(req.params.id, req.body.planActual);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'UPDATE_PLAN_CONJUNTO',
                descripcion: `Cambio de plan a ${req.body.planActual} para conjunto ${actualizado.nombre}`,
                recurso: { tipo: 'conjunto', id: actualizado._id.toString() },
                nivel: 'critical'
            });
        }

        return successResponse(res, actualizado, "Plan actualizado correctamente");
    } catch (error) {
        logger.error('Error actualizarPlan:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    crearConjunto,
    obtenerConjuntos,
    obtenerConjuntoPorId,
    actualizarConjunto,
    eliminarConjunto,
    obtenerEstadisticasGlobales,
    listarConjuntosParaSelector,
    actualizarPlan
};
