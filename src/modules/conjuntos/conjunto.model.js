const mongoose = require("mongoose");

/**
 * Modelo Conjunto Residencial (Tenant)
 * Representa una unidad residencial que usa el sistema
 */
const conjuntoSchema = new mongoose.Schema({
    // Información básica
    nombre: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    nit: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    direccion: {
        type: String,
        trim: true
    },
    ciudad: {
        type: String,
        trim: true
    },
    departamento: {
        type: String,
        trim: true
    },
    telefono: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },

    // Branding
    logo: {
        type: String,
        default: null
    },

    // Estado del conjunto
    estado: {
        type: String,
        enum: ["activo", "suspendido", "inactivo"],
        default: "activo"
    },

    // Configuración específica del conjunto
    configuracion: {
        maxParqueaderos: { type: Number, default: 50 },
        maxUsuarios: { type: Number, default: 200 },
        maxVisitantes: { type: Number, default: 500 },
        permitirVisitantes: { type: Boolean, default: true },
        tiempoExpiracionQR: { type: Number, default: 24 },
        zonaHoraria: { type: String, default: "America/Bogota" }
    },

    // Información de contacto del administrador principal
    contactoAdmin: {
        nombre: String,
        telefono: String,
        email: String
    },

    // Notas internas (solo visible para superadmin)
    notasInternas: {
        type: String,
        default: ""
    },

    // Plan/Suscripción
    plan: {
        tipo: {
            type: String,
            enum: ["trial", "basico", "profesional", "enterprise"],
            default: "trial"
        },
        fechaInicio: {
            type: Date,
            default: Date.now
        },
        fechaVencimiento: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        limites: {
            maxUsuarios: { type: Number, default: 50 },
            maxParqueaderos: { type: Number, default: 20 },
            maxVisitantes: { type: Number, default: 100 }
        }
    }
}, {
    timestamps: true
});

// Índices
conjuntoSchema.index({ estado: 1 });
conjuntoSchema.index({ ciudad: 1 });
conjuntoSchema.index({ createdAt: -1 });

// Método estático para obtener conjuntos activos
conjuntoSchema.statics.obtenerActivos = function () {
    return this.find({ estado: "activo" })
        .select("nombre ciudad direccion estado")
        .sort({ nombre: 1 })
        .lean();
};

// Método estático para estadísticas
conjuntoSchema.statics.obtenerEstadisticas = async function (conjuntoId) {
    const Usuario = mongoose.model("Usuario");
    const Visitante = mongoose.model("Visitante");
    const Parqueadero = mongoose.model("Parqueadero");

    const [usuarios, visitantes, parqueaderos] = await Promise.all([
        Usuario.countDocuments({ conjunto: conjuntoId }),
        Visitante.countDocuments({ conjunto: conjuntoId }),
        Parqueadero.countDocuments({ conjunto: conjuntoId })
    ]);

    return { usuarios, visitantes, parqueaderos };
};

module.exports = mongoose.model("Conjunto", conjuntoSchema, "conjuntos");