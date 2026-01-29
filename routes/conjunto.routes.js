// routes/conjunto.routes.js
const express = require("express");
const router = express.Router();
const conjuntoController = require("../controllers/conjuntoController");
const usuarioController = require("../controllers/usuariocontroller");
const { verificarToken, esSuperAdmin } = require("../middlewares/auth.middleware");

// ========================================
// 📌 Ruta pública (para selector de login)
// ========================================
router.get("/lista", conjuntoController.listarConjuntosParaSelector);

// ========================================
// 📌 Rutas protegidas (Solo SuperAdmin)
// ========================================

// Estadísticas globales
router.get("/estadisticas", verificarToken, esSuperAdmin, conjuntoController.obtenerEstadisticasGlobales);

// CRUD de conjuntos
router.get("/", verificarToken, esSuperAdmin, conjuntoController.obtenerConjuntos);
router.post("/", verificarToken, esSuperAdmin, conjuntoController.crearConjunto);
router.get("/:id", verificarToken, esSuperAdmin, conjuntoController.obtenerConjuntoPorId);
router.put("/:id", verificarToken, esSuperAdmin, conjuntoController.actualizarConjunto);
router.delete("/:id", verificarToken, esSuperAdmin, conjuntoController.eliminarConjunto);

// Exportar datos de un conjunto
router.get("/:id/exportar", verificarToken, esSuperAdmin, usuarioController.exportarDatosConjunto);

// Actualizar plan de un conjunto
router.put("/:id/plan", verificarToken, esSuperAdmin, conjuntoController.actualizarPlan);

module.exports = router;

