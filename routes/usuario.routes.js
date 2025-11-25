const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuariocontroller");

// Rutas para usuarios
router.post("/crear", usuarioController.crearUsuario);
router.post("/login", usuarioController.loginUsuario);
router.post("/listarUsuarios", usuarioController.obtenerUsuarios);
router.get("/", usuarioController.obtenerUsuarios);
router.get("/:id", usuarioController.obtenerUsuarioPorId);
router.put("/:id", usuarioController.actualizarUsuario);
router.delete("/:id", usuarioController.eliminarUsuario);

module.exports = router;