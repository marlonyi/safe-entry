// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { models, middlewares, logger } = require('../../index');
const { AuditLog } = models;
const { getTenantFilter, getConjuntoId } = middlewares.auth;
const visitanteService = require('./visitante.service');
const { successResponse, errorResponse } = require('../../../utils/responseHandler');

exports.registrarVisitante = async (req, res) => {
    try {
        const conjuntoId = getConjuntoId(req);
        const tenantFilter = getTenantFilter(req);
        
        const resultado = await visitanteService.registrarVisitante(req.body, conjuntoId, tenantFilter);

        const { visitante, plaza } = resultado;

        // Auditoría
        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'CREATE_VISITANTE',
                descripcion: `Registró visitante ${visitante.nombre} ${visitante.apellido} y asignó plaza ${plaza ? plaza.numero : 'ninguna'}`,
                recurso: { tipo: 'visitante', id: visitante._id.toString() }
            });
        }

        return successResponse(res, visitante, "Visitante registrado y parqueadero asignado", 201);
    } catch (error) {
        logger.error('Error al registrar visitante:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

exports.obtenerVisitantes = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const visitantes = await visitanteService.obtenerVisitantes(tenantFilter);
        return successResponse(res, visitantes, "Lista de visitantes obtenida");
    } catch (error) {
        logger.error('Error al obtener visitantes:', error.message);
        return errorResponse(res, 'Error al obtener visitantes', 500);
    }
};

exports.obtenerVisitantesPorResidente = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const residenteId = req.params.residenteId;
        const visitantes = await visitanteService.obtenerVisitantesPorResidente(residenteId, tenantFilter);
        return successResponse(res, visitantes, "Lista de visitantes del residente obtenida");
    } catch (error) {
        logger.error('Error al obtener visitantes por residente:', error.message);
        return errorResponse(res, 'Error al obtener visitantes', 500);
    }
};

exports.eliminarVisitante = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const resultado = await visitanteService.eliminarVisitante(req.params.id, tenantFilter);
        
        const { visitante, plaza } = resultado;

        // Auditoría
        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'DELETE_VISITANTE',
                descripcion: `Eliminó visitante ${visitante.nombre} ${visitante.apellido} y liberó plaza ${plaza ? plaza.numero : 'N/A'}`,
                recurso: { tipo: 'visitante', id: visitante._id.toString() }
            });
        }

        return successResponse(res, null, "Visitante eliminado y plaza liberada");
    } catch (error) {
        logger.error('Error al eliminar visitante:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

exports.editarVisitante = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const actualizado = await visitanteService.editarVisitante(req.params.id, req.body, tenantFilter);

        // Auditoría
        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'UPDATE_VISITANTE',
                descripcion: `Actualizó visitante ${actualizado.nombre} ${actualizado.apellido}`,
                recurso: { tipo: 'visitante', id: actualizado._id.toString() }
            });
        }

        return successResponse(res, actualizado, "Visitante actualizado correctamente");
    } catch (error) {
        logger.error('Error al editar visitante:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

exports.obtenerPlazasConVisitantes = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const plazas = await visitanteService.obtenerPlazasConVisitantes(tenantFilter);
        return successResponse(res, plazas, "Plazas ocupadas obtenidas");
    } catch (error) {
        logger.error('Error al obtener plazas con visitantes:', error.message);
        return errorResponse(res, 'Error en el servidor al obtener las plazas', 500);
    }
};
