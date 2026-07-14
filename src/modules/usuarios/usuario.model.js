const mongoose = require("mongoose");
const crypto = require("crypto");

const usuarioSchema = new mongoose.Schema({
    // ========== REFERENCIA AL CONJUNTO (TENANT) ==========
    conjunto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conjunto",
        default: null  // null = superadmin (acceso global a todos los conjuntos)
    },

    // ========== INFORMACIÓN PERSONAL ==========
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    cedula: { type: String, required: true },
    apartamento: { type: String },
    torre: { type: String },
    fechaIngreso: { type: Date },
    fechaRetiro: { type: Date },
    estadoExpensa: { type: String, enum: ["al dia", "en mora"], default: "al dia" },
    tieneVehiculo: { type: Boolean, default: true },
    placaVehiculo: { type: String },
    placa2Vehiculo: { type: String },
    password: { type: String, required: true },

    // ========== ROL (ahora incluye superadmin) ==========
    rol: {
        type: String,
        enum: ["superadmin", "admin", "residente", "porteria"],
        default: "residente"
    },
    fotoPerfil: { type: String, default: null },

    // ========== PARQUEADERO ASIGNADO ==========
    // Para residentes: 1 parqueadero fijo por apartamento
    parqueaderoAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Parqueadero",
        default: null
    },

    // ========== QR DE ACCESO PARA RESIDENTES ==========
    qrAcceso: {
        token: { type: String, default: null },
        fechaGeneracion: { type: Date, default: null },
        fechaExpiracion: { type: Date, default: null }
    }
}, {
    timestamps: true
});

// ========== MÉTODO PARA GENERAR QR DE ACCESO ==========
// El QR del residente es una credencial de acceso de larga duración (por
// defecto 90 días); regenerarla renueva el token y la expiración.
usuarioSchema.methods.generarQRAcceso = function (diasValidez = 90) {
    // Token único de 32 caracteres
    this.qrAcceso.token = crypto.randomBytes(16).toString('hex');
    this.qrAcceso.fechaGeneracion = new Date();
    this.qrAcceso.fechaExpiracion = new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000);
    return this.qrAcceso.token;
};

// ========== MÉTODO ESTÁTICO PARA BUSCAR POR QR ==========
// Rechaza tokens expirados. Los QR generados antes de introducir la
// expiración (fechaExpiracion ausente/null) se toleran (grandfathering) para
// no romper de golpe el acceso de residentes existentes hasta que regeneren.
usuarioSchema.statics.buscarPorQR = function (token) {
    return this.findOne({
        'qrAcceso.token': token,
        $or: [
            { 'qrAcceso.fechaExpiracion': { $gt: new Date() } },
            { 'qrAcceso.fechaExpiracion': null },
            { 'qrAcceso.fechaExpiracion': { $exists: false } }
        ]
    }).populate('conjunto', 'nombre');
};

// ========== VALIDACIÓN DE PLACA COLOMBIANA ==========
usuarioSchema.statics.validarPlaca = function (placa) {
    if (!placa) return true; // Placa opcional
    // Formatos: ABC123 o ABC12H (3 letras + 2 números + 1 alfanumérico)
    const regex = /^[A-Z]{3}[0-9]{2}[A-Z0-9]$/i;
    return regex.test(placa.replace(/[-\s]/g, '')); // Ignorar guiones y espacios
};

// ========== ÍNDICES PARA MULTI-TENANT ==========
// Índice compuesto: cédula única por conjunto (permite misma cédula en diferentes conjuntos)
usuarioSchema.index({ conjunto: 1, cedula: 1 }, { unique: true });

// Índices para queries eficientes dentro de un conjunto
usuarioSchema.index({ conjunto: 1, rol: 1, createdAt: -1 }); // Listar usuarios por rol en un conjunto
usuarioSchema.index({ conjunto: 1, placaVehiculo: 1 }); // Búsqueda por placa en un conjunto
usuarioSchema.index({ conjunto: 1, torre: 1, apartamento: 1 }); // Búsqueda por ubicación
usuarioSchema.index({ conjunto: 1, parqueaderoAsignado: 1 }); // Búsqueda por parqueadero

// Índice para búsqueda global de cédula (para login con auto-detección de conjunto)
usuarioSchema.index({ cedula: 1 });

// Índice para búsqueda por QR token
usuarioSchema.index({ 'qrAcceso.token': 1 });

module.exports = mongoose.model("Usuario", usuarioSchema);