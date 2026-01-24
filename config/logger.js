/**
 * Sistema de Logging con Winston
 * Proporciona logging estructurado con niveles, timestamps y archivos
 */
const winston = require('winston');
const path = require('path');

// Formato personalizado para logs
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        // Agregar metadata si existe
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }

        // Agregar stack trace si es un error
        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Formato para consola con colores
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
    })
);

// Crear logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: { service: 'admin-residencial' },
    transports: [
        // Escribir todos los logs a archivo combinado
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Escribir solo errores a archivo separado
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// En desarrollo, también mostrar en consola con colores
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
} else {
    // En producción, consola sin colores
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Métodos de conveniencia
logger.logRequest = (req, statusCode, duration) => {
    const meta = {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.connection.remoteAddress
    };

    if (statusCode >= 500) {
        logger.error(`Request failed: ${req.method} ${req.originalUrl}`, meta);
    } else if (statusCode >= 400) {
        logger.warn(`Request error: ${req.method} ${req.originalUrl}`, meta);
    } else {
        logger.info(`Request: ${req.method} ${req.originalUrl}`, meta);
    }
};

logger.logAuth = (action, userId, success, details = {}) => {
    const level = success ? 'info' : 'warn';
    logger[level](`Auth: ${action}`, { userId, success, ...details });
};

logger.logDB = (operation, collection, success, details = {}) => {
    const level = success ? 'debug' : 'error';
    logger[level](`DB: ${operation} on ${collection}`, { success, ...details });
};

module.exports = logger;
