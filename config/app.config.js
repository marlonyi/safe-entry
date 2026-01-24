/**
 * Configuración Centralizada del Sistema
 * Todas las configuraciones de la aplicación en un solo lugar
 */

const config = {
    // ========================================
    // Servidor
    // ========================================
    server: {
        port: parseInt(process.env.PORT) || 5000,
        env: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV !== 'production'
    },

    // ========================================
    // Base de datos
    // ========================================
    database: {
        uri: process.env.MONGO_URI || 'mongodb://localhost:27017/adminResidencial',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },

    // ========================================
    // JWT / Autenticación
    // ========================================
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'secreto',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
        refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
        saltRounds: 10
    },

    // ========================================
    // Admin por defecto
    // ========================================
    admin: {
        cedula: process.env.ADMIN_CEDULA || '123456789',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        nombre: 'Admin',
        apellido: 'Principal'
    },

    // ========================================
    // CORS
    // ========================================
    cors: {
        allowedOrigins: [
            'http://localhost:5000',
            'http://localhost:3000',
            'http://127.0.0.1:5000',
            'http://127.0.0.1:3000',
            process.env.FRONTEND_URL_LOCAL,
            process.env.FRONTEND_URL_PROD
        ].filter(Boolean)
    },

    // ========================================
    // Rate Limiting
    // ========================================
    rateLimit: {
        windowMs: 60 * 1000, // 1 minuto
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        blockDurationMs: 5 * 60 * 1000 // 5 minutos
    },

    // ========================================
    // Logging
    // ========================================
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        maxFileSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5
    },

    // ========================================
    // Uploads
    // ========================================
    uploads: {
        maxSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    },

    // ========================================
    // QR / Visitantes
    // ========================================
    visitantes: {
        qrValidezHoras: parseInt(process.env.QR_VALIDEZ_HORAS) || 24,
        codigoIntervaloMinutos: 10
    }
};

// Validaciones de configuración crítica
const validateConfig = () => {
    const warnings = [];
    const errors = [];

    // Verificar JWT_SECRET en producción
    if (config.server.isProduction) {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secreto') {
            errors.push('JWT_SECRET no está configurado correctamente para producción');
        }
    }

    // Advertencias para desarrollo
    if (config.server.isDevelopment) {
        if (!process.env.JWT_SECRET) {
            warnings.push('JWT_SECRET no configurado, usando valor por defecto (solo para desarrollo)');
        }
    }

    return { warnings, errors };
};

// Ejecutar validación al cargar el módulo
const validation = validateConfig();

module.exports = {
    ...config,
    validation
};
