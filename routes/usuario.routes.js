const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuariocontroller");
const { loginRateLimiter } = require("../middlewares/rateLimit.middleware");
const { verificarToken, esAdmin, esPorteriaOAdmin } = require("../middlewares/auth.middleware");

// ========================================
// 📌 Rutas públicas (sin autenticación)
// ========================================
router.post("/login", loginRateLimiter, usuarioController.loginUsuario);
router.post("/refresh-token", usuarioController.refreshToken);

// ========================================
// 📌 Rutas que requieren autenticación
// ========================================
// Listar usuarios - requiere ser portero o admin
router.get("/", verificarToken, esPorteriaOAdmin, usuarioController.obtenerUsuarios);
router.post("/listarUsuarios", verificarToken, esPorteriaOAdmin, usuarioController.obtenerUsuarios);

// Crear usuario - requiere ser portero o admin
router.post("/crear", verificarToken, esPorteriaOAdmin, usuarioController.crearUsuario);

// ========================================
// 📌 Rutas de perfil (usuario autenticado)
// ========================================
router.get("/perfil/:id", verificarToken, usuarioController.obtenerMiPerfil);
router.put("/perfil/:id/foto", verificarToken, usuarioController.actualizarFotoPerfil);

// ========================================
// 📌 Rutas de gestión (usuario autenticado)
// ========================================
router.get("/:id", verificarToken, usuarioController.obtenerUsuarioPorId);
router.put("/:id", verificarToken, usuarioController.actualizarUsuario);
router.delete("/:id", verificarToken, esPorteriaOAdmin, usuarioController.eliminarUsuario);

module.exports = router;
