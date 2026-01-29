// models/parqueadero.js
const mongoose = require("mongoose");

const parqueaderoSchema = new mongoose.Schema({
  // ========== REFERENCIA AL CONJUNTO (TENANT) ==========
  conjunto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conjunto",
    required: true  // Todos los parqueaderos deben pertenecer a un conjunto
  },

  // ========== INFORMACIÓN DEL PARQUEADERO ==========
  numero: { type: String, required: true },
  estado: {
    type: String,
    enum: ["DISPONIBLE", "EN_ESPERA", "OCUPADO"],
    default: "DISPONIBLE"
  },
  visitante: { type: mongoose.Schema.Types.ObjectId, ref: "Visitante", default: null },
  horaEntrada: { type: Date, default: null }  // Cuando Python detecta la placa
}, {
  timestamps: true
});

// ========== ÍNDICES PARA MULTI-TENANT ==========
// Número de plaza único por conjunto
parqueaderoSchema.index({ conjunto: 1, numero: 1 }, { unique: true });

// Índices para queries eficientes dentro de un conjunto
parqueaderoSchema.index({ conjunto: 1, estado: 1 });

module.exports = mongoose.model("Parqueadero", parqueaderoSchema, "parqueaderos");
