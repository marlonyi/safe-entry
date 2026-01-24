// models/parqueadero.js
const mongoose = require("mongoose");

const parqueaderoSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
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

// Índice para búsqueda rápida por estado
parqueaderoSchema.index({ estado: 1 });

module.exports = mongoose.model("Parqueadero", parqueaderoSchema, "parqueaderos");
