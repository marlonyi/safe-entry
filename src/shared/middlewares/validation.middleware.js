/**
 * Utilidades de Validación con express-validator
 * Uso: importar validadores y agregarlos a rutas específicas
 */
const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para manejar errores de validación
 * Usar después de los validadores
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Error de validación',
            detalles: errors.array().map(err => ({
                campo: err.path,
                mensaje: err.msg
            }))
        });
    }
    next();
};

/**
 * Sanitizar string para prevenir XSS
 */
const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
};

// ========== VALIDADORES PARA USUARIOS ==========

const validateLogin = [
    body('cedula')
        .trim()
        .notEmpty().withMessage('La cédula es requerida')
        .isLength({ min: 5, max: 20 }).withMessage('Cédula debe tener entre 5 y 20 caracteres'),
    body('password')
        .notEmpty().withMessage('La contraseña es requerida')
        .isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres'),
    handleValidationErrors
];

const validateCreateUser = [
    body('nombre')
        .trim()
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 50 }).withMessage('Nombre debe tener entre 2 y 50 caracteres')
        .customSanitizer(sanitizeString),
    body('apellido')
        .trim()
        .notEmpty().withMessage('El apellido es requerido')
        .isLength({ min: 2, max: 50 }).withMessage('Apellido debe tener entre 2 y 50 caracteres')
        .customSanitizer(sanitizeString),
    body('cedula')
        .trim()
        .notEmpty().withMessage('La cédula es requerida')
        .isLength({ min: 5, max: 20 }).withMessage('Cédula debe tener entre 5 y 20 caracteres')
        .matches(/^[0-9]+$/).withMessage('La cédula solo debe contener números'),
    body('password')
        .notEmpty().withMessage('La contraseña es requerida')
        .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rol')
        .optional()
        .isIn(['residente', 'porteria', 'admin']).withMessage('Rol inválido'),
    body('placaVehiculo')
        .optional()
        .trim()
        .isLength({ max: 10 }).withMessage('La placa no puede tener más de 10 caracteres')
        .toUpperCase(),
    handleValidationErrors
];

// ========== VALIDADORES PARA VISITANTES ==========

const validateCreateVisitante = [
    body('nombre')
        .trim()
        .notEmpty().withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 50 }).withMessage('Nombre debe tener entre 2 y 50 caracteres')
        .customSanitizer(sanitizeString),
    body('apellido')
        .trim()
        .notEmpty().withMessage('El apellido es requerido')
        .isLength({ min: 2, max: 50 }).withMessage('Apellido debe tener entre 2 y 50 caracteres')
        .customSanitizer(sanitizeString),
    body('cedula')
        .trim()
        .notEmpty().withMessage('La cédula es requerida')
        .isLength({ min: 5, max: 20 }).withMessage('Cédula debe tener entre 5 y 20 caracteres'),
    body('placaVehiculo')
        .trim()
        .notEmpty().withMessage('La placa del vehículo es requerida')
        .isLength({ min: 4, max: 10 }).withMessage('La placa debe tener entre 4 y 10 caracteres')
        .toUpperCase(),
    body('apartamentoDestino')
        .optional()
        .trim()
        .customSanitizer(sanitizeString),
    body('torreDestino')
        .optional()
        .trim()
        .customSanitizer(sanitizeString),
    handleValidationErrors
];

// ========== VALIDADORES PARA PARQUEADEROS ==========

const validatePlaca = [
    body('placa')
        .trim()
        .notEmpty().withMessage('La placa es requerida')
        .isLength({ min: 4, max: 10 }).withMessage('La placa debe tener entre 4 y 10 caracteres')
        .toUpperCase(),
    handleValidationErrors
];

// ========== VALIDADORES PARA PARÁMETROS ==========

const validateMongoId = [
    param('id')
        .isMongoId().withMessage('ID inválido'),
    handleValidationErrors
];

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100'),
    handleValidationErrors
];

module.exports = {
    // Middleware de manejo de errores
    handleValidationErrors,

    // Utilidades
    sanitizeString,

    // Validadores de usuarios
    validateLogin,
    validateCreateUser,

    // Validadores de visitantes
    validateCreateVisitante,

    // Validadores de parqueaderos
    validatePlaca,

    // Validadores genéricos
    validateMongoId,
    validatePagination
};