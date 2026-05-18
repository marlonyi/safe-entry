const express = require('express');
const router = express.Router();
const { middlewares } = require('../../index');
const { verificarToken } = middlewares.auth;
const modeloController = require('./modelo.controller');

// Selector de conjuntos
router.get('/conjuntos', verificarToken, modeloController.listarConjuntos);

// Parámetros del modelo calculados desde datos reales
router.get('/parametros/:conjuntoId', verificarToken, modeloController.obtenerParametros);

module.exports = router;
