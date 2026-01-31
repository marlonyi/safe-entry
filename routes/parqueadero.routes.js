/**
 * 🅿️ Rutas de Parqueadero
 * Usa el controlador para toda la lógica de negocio
 * 🏢 MULTI-TENANT: Requiere autenticación para filtrado por conjunto
 */

const express = require("express");
const router = express.Router();
const parqueaderoController = require("../controllers/parqueaderoController");
const { verificarToken, esPorteriaOAdmin, esSuperAdmin, esAdmin } = require("../middlewares/auth.middleware");

// ========================================
// 📌 Rutas de consulta y operación
// ========================================

// 📌 Obtener todas las plazas con info del visitante (requiere auth para filtrar por conjunto)
router.get("/", verificarToken, parqueaderoController.obtenerPlazas);

// 📌 Asignar visitante a una plaza disponible
router.post("/asignar", verificarToken, esPorteriaOAdmin, parqueaderoController.asignarVisitante);

// 📌 Liberar todas las plazas
router.post("/liberar", verificarToken, esPorteriaOAdmin, parqueaderoController.liberarPlazas);

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

// 🏢 SUPERADMIN: Crear plazas para un conjunto
router.post("/conjunto/:conjuntoId/crear", verificarToken, esSuperAdmin, parqueaderoController.crearPlazasConjunto);

// 🏢 SUPERADMIN: Eliminar una plaza
router.delete("/:id", verificarToken, esSuperAdmin, parqueaderoController.eliminarPlaza);

// 📝 ADMIN o SUPERADMIN: Editar número de una plaza
router.put("/:id", verificarToken, esAdmin, parqueaderoController.editarPlaza);

module.exports = router;
