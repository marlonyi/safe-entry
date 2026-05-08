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
        const filtros = {};

        // Filtros opcionales por categoría y tipo
        if (req.query.categoria) {
            filtros.categoria = req.query.categoria;
        }
        if (req.query.tipoVehiculo) {
            filtros.tipoVehiculo = req.query.tipoVehiculo;
        }

        const plazas = await parqueaderoService.obtenerPlazas(tenantFilter, filtros);
        return successResponse(res, plazas, "Plazas obtenidas correctamente");
    } catch (error) {
        logger.error('Error al obtener plazas:', error.message);
        return errorResponse(res, "Error al obtener plazas", 500);
    }
};

const obtenerEstadisticas = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const stats = await parqueaderoService.obtenerEstadisticas(tenantFilter);
        return successResponse(res, stats, "Estadísticas obtenidas");
    } catch (error) {
        logger.error('Error al obtener estadísticas:', error.message);
        return errorResponse(res, "Error al obtener estadísticas", 500);
    }
};

const asignarVisitante = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const { visitanteId, tipoVehiculo } = req.body;
        const plaza = await parqueaderoService.asignarVisitante(visitanteId, tipoVehiculo, tenantFilter);

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

const asignarResidente = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const { plazaId, residenteId } = req.body;

        const plaza = await parqueaderoService.asignarResidente(plazaId, residenteId, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'ASSIGN_RESIDENT_PARKING',
                descripcion: `Asignó parqueadero ${plaza.numero} permanentemente a residente`
            });
        }

        return successResponse(res, plaza, "Parqueadero asignado permanentemente");
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
        const opciones = {
            fechaInicio: req.query.fechaInicio,
            fechaFin: req.query.fechaFin,
            tipoAcceso: req.query.tipoAcceso,
            tipoUsuario: req.query.tipoUsuario,
            placa: req.query.placa,
            conjunto: req.query.conjunto,
            page: req.query.page || 1,
            limit: req.query.limit || 50
        };
        const historial = await parqueaderoService.obtenerHistorial(tenantFilter, opciones);
        return successResponse(res, historial, "Historial obtenido");
    } catch (error) {
        return errorResponse(res, "Error al obtener historial", 500);
    }
};

const obtenerEstadisticasHistorial = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const opciones = {
            fechaInicio: req.query.fechaInicio,
            fechaFin: req.query.fechaFin,
            conjunto: req.query.conjunto
        };
        const stats = await parqueaderoService.obtenerEstadisticasHistorial(tenantFilter, opciones);
        return successResponse(res, stats, "Estadisticas de historial");
    } catch (error) {
        return errorResponse(res, "Error al obtener estadisticas de historial", 500);
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
        const { conjuntoId, configuracion } = req.body;

        // Verificación extra puede ir en middleware o service
        if (req.usuarioLogueado && req.usuarioLogueado.rol !== 'superadmin' && req.usuarioLogueado.rol !== 'admin') {
             return errorResponse(res, "No autorizado", 403);
        }

        const resultado = await parqueaderoService.crearPlazasConjunto(conjuntoId, configuracion);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'INIT_PARKING',
                descripcion: `Inicializó ${resultado.total} parqueaderos para el conjunto ${conjuntoId}`
            });
        }

        return successResponse(res, resultado, `${resultado.total} plazas creadas exitosamente`);
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
        const tenantFilter = getTenantFilter(req);
        const plaza = await parqueaderoService.editarPlaza(req.params.id, req.body, tenantFilter);

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

const asignarParqueaderoApartamento = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const { usuarioId } = req.body;

        const resultado = await parqueaderoService.asignarParqueaderoApartamento(usuarioId, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'ASSIGN_PARKING_APARTMENT',
                descripcion: resultado.mensaje
            });
        }

        return successResponse(res, resultado, resultado.mensaje);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const liberarParqueaderoResidente = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const { usuarioId } = req.body;

        const resultado = await parqueaderoService.liberarParqueaderoResidente(usuarioId, tenantFilter);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'FREE_RESIDENT_PARKING',
                descripcion: `Liberó parqueadero de residente`
            });
        }

        return successResponse(res, resultado, resultado.mensaje);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const obtenerParqueaderoPorApartamento = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const { torre, apartamento } = req.query;

        if (!torre || !apartamento) {
            return errorResponse(res, "Se requiere torre y apartamento", 400);
        }

        const parqueadero = await parqueaderoService.obtenerParqueaderoPorApartamento(torre, apartamento, tenantFilter);
        return successResponse(res, parqueadero, parqueadero ? "Parqueadero encontrado" : "Sin parqueadero asignado");
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Inicializar parqueaderos con configuración de torres/pisos/apartamentos
const inicializarConjunto = async (req, res) => {
    try {
        const { conjuntoId } = req.params;
        const configuracion = req.body;

        if (!conjuntoId) {
            return errorResponse(res, "Se requiere el ID del conjunto", 400);
        }

        const resultado = await parqueaderoService.crearPlazasConfiguracion(conjuntoId, configuracion);

        if (req.usuarioLogueado) {
            await AuditLog.registrar({
                usuario: req.usuarioLogueado,
                accion: 'INIT_PARKING_TOWERS',
                descripcion: resultado.mensaje
            });
        }

        return successResponse(res, resultado, resultado.mensaje);
    } catch (error) {
        logger.error('Error al inicializar parqueaderos:', error.message);
        return errorResponse(res, error.message, 400);
    }
};

// Obtener parqueaderos agrupados por torre
const obtenerPorTorre = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        const resultado = await parqueaderoService.obtenerParqueaderosPorTorre(tenantFilter);
        return successResponse(res, resultado, "Parqueaderos obtenidos por torre");
    } catch (error) {
        logger.error('Error al obtener parqueaderos por torre:', error.message);
        return errorResponse(res, "Error al obtener parqueaderos", 500);
    }
};

module.exports = {
    obtenerPlazas,
    obtenerEstadisticas,
    asignarVisitante,
    asignarResidente,
    liberarPlazas,
    registrarEntrada,
    obtenerHistorial,
    obtenerEstadisticasHistorial,
    registrarSalida,
    registrarAcceso,
    crearPlazasConjunto,
    inicializarConjunto,
    eliminarPlaza,
    editarPlaza,
    obtenerPlazasConjunto,
    asignarParqueaderoApartamento,
    liberarParqueaderoResidente,
    obtenerParqueaderoPorApartamento,
    obtenerPorTorre
};
