// models/historialAcceso.js
const mongoose = require("mongoose");

const historialAccesoSchema = new mongoose.Schema({
    // ========== REFERENCIA AL CONJUNTO (TENANT) ==========
    conjunto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conjunto",
        required: true  // Todos los accesos deben pertenecer a un conjunto
    },

    // ========== INFORMACIÓN DEL ACCESO ==========
    placa: {
        type: String,
        required: true,
        uppercase: true
    },
    tipoAcceso: {
        type: String,
        enum: ["entrada", "salida"],
        required: true
    },
    tipoUsuario: {
        type: String,
        enum: ["residente", "visitante"],
        required: true
    },
    nombreUsuario: {
        type: String,
        required: true
    },
    plaza: {
        type: String,
        default: null
    },
    fechaHora: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// ========== ÍNDICES PARA MULTI-TENANT ==========
historialAccesoSchema.index({ conjunto: 1, fechaHora: -1 });
historialAccesoSchema.index({ conjunto: 1, placa: 1 });
historialAccesoSchema.index({ conjunto: 1, tipoAcceso: 1 });

module.exports = mongoose.model("HistorialAcceso", historialAccesoSchema, "historialAccesos");
