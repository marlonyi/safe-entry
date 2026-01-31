const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuariocontroller");
const { loginRateLimiter } = require("../middlewares/rateLimit.middleware");
const { verificarToken, esAdmin, esPorteriaOAdmin, esSuperAdmin } = require("../middlewares/auth.middleware");
const { verificarLimiteUsuarios } = require("../middlewares/planLimits.middleware");

// ========================================
// 📌 Rutas públicas (sin autenticación)
// ========================================
router.post("/login", loginRateLimiter, usuarioController.loginUsuario);
router.post("/refresh-token", usuarioController.refreshToken);

// Verificar QR de residente (público para escaneo en portería)
router.get("/verificar-qr/:token", usuarioController.verificarQRAcceso);

// ========================================
// 📌 Rutas que requieren autenticación
// ========================================
// Listar usuarios - requiere ser portero o admin
router.get("/", verificarToken, esPorteriaOAdmin, usuarioController.obtenerUsuarios);
router.post("/listarUsuarios", verificarToken, esPorteriaOAdmin, usuarioController.obtenerUsuarios);

// Crear usuario - requiere ser portero o admin + verificar límite de plan
router.post("/crear", verificarToken, esPorteriaOAdmin, verificarLimiteUsuarios, usuarioController.crearUsuario);

// ========================================
// 📌 Rutas de perfil (usuario autenticado)
// ========================================
router.get("/perfil/:id", verificarToken, usuarioController.obtenerMiPerfil);
router.put("/perfil/:id/foto", verificarToken, usuarioController.actualizarFotoPerfil);

// ========================================
// 📌 Rutas de contraseña
// ========================================
// Cambiar contraseña propia (requiere contraseña actual)
router.put("/me/password", verificarToken, usuarioController.cambiarPassword);
// SuperAdmin: Restablecer contraseña de cualquier usuario
router.put("/:id/restablecer-password", verificarToken, esSuperAdmin, usuarioController.restablecerPassword);

// ========================================
// 📌 Rutas QR de Acceso (usuario autenticado)
// ========================================
router.get("/:id/qr-acceso", verificarToken, usuarioController.generarQRAcceso);
router.post("/:id/qr-acceso/regenerar", verificarToken, usuarioController.regenerarQRAcceso);

// ========================================
// 📌 Rutas SuperAdmin (requiere rol superadmin)
// ========================================
// IMPORTANTE: Estas rutas deben ir ANTES de /:id para evitar conflictos
router.post("/admin-rapido", verificarToken, esSuperAdmin, usuarioController.crearAdminRapido);
router.put("/:id/rol", verificarToken, esSuperAdmin, usuarioController.cambiarRol);
router.put("/:id/conjunto", verificarToken, esSuperAdmin, usuarioController.moverAConjunto);

// ========================================
// 📌 Rutas de gestión (usuario autenticado)
// ========================================
router.get("/:id", verificarToken, usuarioController.obtenerUsuarioPorId);
router.put("/:id", verificarToken, usuarioController.actualizarUsuario);
router.delete("/:id", verificarToken, esPorteriaOAdmin, usuarioController.eliminarUsuario);

module.exports = router;


