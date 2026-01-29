/**
 * 🅿️ Rutas de Parqueadero
 * Usa el controlador para toda la lógica de negocio
 * 🏢 MULTI-TENANT: Requiere autenticación para filtrado por conjunto
 */

const express = require("express");
const router = express.Router();
const parqueaderoController = require("../controllers/parqueaderoController");
const { verificarToken, esPorteriaOAdmin } = require("../middlewares/auth.middleware");

// 📌 Obtener todas las plazas con info del visitante (requiere auth para filtrar por conjunto)
router.get("/", verificarToken, parqueaderoController.obtenerPlazas);

// 📌 Asignar visitante a una plaza disponible
router.post("/asignar", verificarToken, esPorteriaOAdmin, parqueaderoController.asignarVisitante);

// 📌 Liberar todas las plazas
router.post("/liberar", verificarToken, esPorteriaOAdmin, parqueaderoController.liberarPlazas);

// 📌 Registrar entrada de vehículo (usado por Python al detectar placa - sin auth para cámaras)
router.post("/registrar-entrada", parqueaderoController.registrarEntrada);

// 📌 Obtener historial de accesos con filtros
router.get("/historial", verificarToken, parqueaderoController.obtenerHistorial);

// 📌 Registrar salida de vehículo (usado por Python - sin auth para cámaras)
router.post("/registrar-salida", parqueaderoController.registrarSalida);

// 📌 Registrar acceso genérico (para Python - detecta automáticamente entrada o salida)
router.post("/registrar-acceso", parqueaderoController.registrarAcceso);

module.exports = router;

