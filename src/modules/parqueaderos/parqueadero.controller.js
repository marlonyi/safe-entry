// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { models, middlewares, logger } = require('../../index');
const { AuditLog } = models;
const { getTenantFilter, getConjuntoId } = middlewares.auth;
const parqueaderoService = require('./parqueadero.service');
const { successResponse, errorResponse } = require("../../../utils/responseHandler");

const obtenerPlazas = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const plazas = await parqueaderoService.obtenerPlazas(tenantFilter);
        return successResponse(res, plazas, "Plazas obtenidas correctamente");
    } catch (error) {
        logger.error('Error al obtener plazas:', error.message);
        return errorResponse(res, "Error al obtener plazas", 500);
    }
};

const asignarVisitante = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.asignarVisitante(req.body.visitanteId, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'ASSIGN_PARKING',
                descripcion: `Asignó visitante a plaza ${plaza.numero}`
            });
        }

        return successResponse(res, plaza, "Parqueadero asignado");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const liberarPlazas = async (req, res) => {
    try {
        const { idPlaza } = req.body;
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.liberarPlaza(idPlaza, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'FREE_PARKING',
                descripcion: `Liberó la plaza ${plaza.numero}`
            });
        }
        
        return successResponse(res, plaza, "Parqueadero liberado exitosamente");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const registrarEntrada = async (req, res) => {
    try {
        const { codigoParqueadero } = req.body;
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.registrarEntrada(codigoParqueadero, tenantFilter);

        return successResponse(res, { numero: plaza.numero }, "Acceso registrado correctamente");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const obtenerHistorial = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const historial = await parqueaderoService.obtenerHistorial(tenantFilter);
        return successResponse(res, historial, "Historial obtenido");
    } catch (error) {
        return errorResponse(res, "Error al obtener historial", 500);
    }
};

const registrarSalida = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.registrarSalida(req.params.plazaId, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'REGISTER_EXIT',
                descripcion: `Registró salida de plaza ${plaza.numero}`
            });
        }

        return successResponse(res, plaza, "Salida registrada y plaza liberada");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const registrarAcceso = async (req, res) => {
    try {
        const { placa, tipo } = req.body;
        const tenantFilter = getTenantFilter(req);
        const conjuntoId = getConjuntoId(req);

        if (!placa || !tipo) {
            return errorResponse(res, "Placa y tipo de acceso son obligatorios", 400);
        }

        const data = await parqueaderoService.registrarAccesoVehicular(placa, tipo, tenantFilter, conjuntoId, req.usuarioLogueado);

        return successResponse(res, data, "Acceso registrado correctamente");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const crearPlazasConjunto = async (req, res) => {
    try {
        const { conjuntoId, cantidad } = req.body;
        
        // Verificación extra puede ir en middleware o service
        if (req.usuarioLogueado && req.usuarioLogueado.rol !== 'superadmin' && req.usuarioLogueado.rol !== 'admin') {
             return errorResponse(res, "No autorizado", 403);
        }

        const total = await parqueaderoService.crearPlazasConjunto(conjuntoId, cantidad);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'INIT_PARKING',
                descripcion: `Inicializó ${total} parqueaderos para el conjunto ${conjuntoId}`
            });
        }

        return successResponse(res, { creados: total }, `${total} plazas creadas exitosamente`);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const eliminarPlaza = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.eliminarPlaza(req.params.id, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'DELETE_PARKING_SLOT',
                descripcion: `Eliminó el parqueadero ${plaza.numero}`
            });
        }

        return successResponse(res, null, "Plaza y su historial eliminados");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const editarPlaza = async (req, res) => {
    try {
        const { numero, estado } = req.body;
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.editarPlaza(req.params.id, numero, estado, tenantFilter);

        return successResponse(res, plaza, "Plaza actualizada exitosamente");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const obtenerPlazasConjunto = async (req, res) => {
    try {
        const plazas = await parqueaderoService.obtenerPlazasConjunto(req.params.conjuntoId);
        return successResponse(res, plazas, "Plazas obtenidas");
    } catch (error) {
        return errorResponse(res, "Error interno", 500);
    }
};

module.exports = {
    obtenerPlazas,
    asignarVisitante,
    liberarPlazas,
    registrarEntrada,
    obtenerHistorial,
    registrarSalida,
    registrarAcceso,
    crearPlazasConjunto,
    eliminarPlaza,
    editarPlaza,
    obtenerPlazasConjunto
};
