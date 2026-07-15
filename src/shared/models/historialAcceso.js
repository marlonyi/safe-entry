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
    metodo: {
        type: String,
        enum: ["qr_scan", "manual_porteria", "LPR_CAMERA", null],
        default: null
    },
    fechaHora: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Fábrica única: TODOS los registros de acceso deben crearse por aquí para
// mantener una sola forma de documento (antes había 6 sitios construyendo el
// documento a mano con formas divergentes: plaza sin metodo / metodo sin plaza).
historialAccesoSchema.statics.registrar = function ({
    conjunto,
    placa,
    tipoAcceso,
    tipoUsuario,
    nombreUsuario,
    plaza = null,
    metodo = null,
    fechaHora = new Date()
}) {
    return this.create({
        conjunto,
        placa: placa || 'SIN-PLACA',
        tipoAcceso,
        tipoUsuario,
        nombreUsuario,
        plaza,
        metodo,
        fechaHora
    });
};

// ========== ÍNDICES PARA MULTI-TENANT ==========
historialAccesoSchema.index({ conjunto: 1, fechaHora: -1 });
historialAccesoSchema.index({ conjunto: 1, placa: 1 });
historialAccesoSchema.index({ conjunto: 1, tipoAcceso: 1 });

module.exports = mongoose.model("HistorialAcceso", historialAccesoSchema, "historialAccesos");
