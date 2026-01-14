// models/historialAcceso.js
const mongoose = require("mongoose");

const historialAccesoSchema = new mongoose.Schema({
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

// Índices para búsquedas eficientes
historialAccesoSchema.index({ fechaHora: -1 });
historialAccesoSchema.index({ placa: 1 });
historialAccesoSchema.index({ tipoAcceso: 1 });

module.exports = mongoose.model("HistorialAcceso", historialAccesoSchema, "historialAccesos");
