/**
 * 🅿️ Rutas de Parqueadero
 * Usa el controlador para toda la lógica de negocio
 * 🏢 MULTI-TENANT: Requiere autenticación para filtrado por conjunto
 */

const express = require("express");
const router = express.Router();
// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { middlewares } = require('../../index');
const { verificarToken, esPorteriaOAdmin, esSuperAdmin, esAdmin } = middlewares.auth;
const parqueaderoController = require('./parqueadero.controller');

// ========================================
// 📌 Rutas de consulta y operación
// ========================================

// 📌 Obtener todas las plazas con info del visitante (requiere auth para filtrar por conjunto)
// Query params: ?categoria=PRIVADO|VISITANTE&tipoVehiculo=CARRO|MOTO
router.get("/", verificarToken, parqueaderoController.obtenerPlazas);

// 📌 Obtener estadísticas de parqueaderos
router.get("/estadisticas", verificarToken, parqueaderoController.obtenerEstadisticas);

// 📌 Obtener parqueadero por apartamento
// Query params: ?torre=A&apartamento=101
router.get("/por-apartamento", verificarToken, parqueaderoController.obtenerParqueaderoPorApartamento);

// 📌 Obtener parqueaderos agrupados por torre
router.get("/por-torre", verificarToken, parqueaderoController.obtenerPorTorre);

// 📌 Asignar visitante a una plaza disponible
// Body: { visitanteId, tipoVehiculo }
router.post("/asignar", verificarToken, esPorteriaOAdmin, parqueaderoController.asignarVisitante);

// 📌 Asignar parqueadero permanentemente a un residente
// Body: { plazaId, residenteId }
router.post("/asignar-residente", verificarToken, esAdmin, parqueaderoController.asignarResidente);

// 📌 Asignar parqueadero automáticamente por apartamento
// Body: { usuarioId }
router.post("/asignar-apartamento", verificarToken, esAdmin, parqueaderoController.asignarParqueaderoApartamento);

// 📌 Liberar parqueadero de un residente
// Body: { usuarioId }
router.post("/liberar-residente", verificarToken, esAdmin, parqueaderoController.liberarParqueaderoResidente);

// 📌 Liberar plaza
router.post("/liberar", verificarToken, esPorteriaOAdmin, parqueaderoController.liberarPlazas);

// 📌 Estadisticas del historial (resumen para cards) - debe ir antes de /historial
router.get("/historial/estadisticas", verificarToken, parqueaderoController.obtenerEstadisticasHistorial);

// 📌 Obtener historial de accesos con filtros
router.get("/historial", verificarToken, parqueaderoController.obtenerHistorial);

// ========================================
// 📌 Rutas para cámaras (sin auth - Python)
// ========================================

// 📌 Registrar entrada de vehículo (usado por Python al detectar placa)
router.post("/registrar-entrada", parqueaderoController.registrarEntrada);

// 📌 Registrar salida de vehículo (usado por Python)
router.post("/registrar-salida", parqueaderoController.registrarSalida);

// 📌 Registrar acceso genérico (para Python - detecta automáticamente entrada o salida)
router.post("/registrar-acceso", parqueaderoController.registrarAcceso);

// ========================================
// 📌 Rutas de gestión de plazas
// ========================================

// 🏢 SUPERADMIN: Obtener plazas de un conjunto específico
router.get("/conjunto/:conjuntoId", verificarToken, esSuperAdmin, parqueaderoController.obtenerPlazasConjunto);

// 🏢 SUPERADMIN: Crear plazas para un conjunto con configuración
// Body: { configuracion: { residenteCarro: 8, residenteMoto: 4, visitanteCarro: 6, visitanteMoto: 2 } }
router.post("/conjunto/:conjuntoId/crear", verificarToken, esSuperAdmin, parqueaderoController.crearPlazasConjunto);

// 🏢 SUPERADMIN: Inicializar parqueaderos con configuración de torres/pisos
// Body: { torres: ['A','B','C'...], pisos: 10, apartamentosPorPiso: 2, visitanteCarro: 20, visitanteMoto: 10 }
router.post("/inicializar-conjunto/:conjuntoId", verificarToken, esSuperAdmin, parqueaderoController.inicializarConjunto);

// 🏢 SUPERADMIN: Eliminar una plaza
router.delete("/:id", verificarToken, esSuperAdmin, parqueaderoController.eliminarPlaza);

// 📝 ADMIN o SUPERADMIN: Editar plaza (número, estado, categoría, tipoVehiculo)
router.put("/:id", verificarToken, esAdmin, parqueaderoController.editarPlaza);

module.exports = router;
