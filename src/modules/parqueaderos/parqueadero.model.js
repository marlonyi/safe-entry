const mongoose = require("mongoose");

const parqueaderoSchema = new mongoose.Schema({
  // ========== REFERENCIA AL CONJUNTO (TENANT) ==========
  conjunto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conjunto",
    required: true
  },

  // ========== INFORMACIÓN DEL PARQUEADERO ==========
  numero: { type: String, required: true },

  // === CATEGORIZACIÓN ===
  // PRIVADO: Asignado permanentemente a un apartamento (propiedad del residente)
  // VISITANTE: Rotativo para visitantes (bien común)
  categoria: {
    type: String,
    enum: ["PRIVADO", "VISITANTE"],
    required: true,
    default: "VISITANTE"
  },
  tipoVehiculo: {
    type: String,
    enum: ["CARRO", "MOTO"],
    required: true,
    default: "CARRO"
  },

  // === ASIGNACIÓN A APARTAMENTO (solo para PRIVADO) ===
  torre: { type: String, default: null },
  apartamento: { type: String, default: null },
  residenteAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null
  },

  // === CONFIGURACIÓN VISITANTES (solo para VISITANTE) ===
  tiempoMaximoHoras: {
    type: Number,
    default: 8  // Límite de 8 horas por defecto
  },

  // === ESTADO Y USO ===
  estado: {
    type: String,
    enum: ["DISPONIBLE", "OCUPADO", "RESERVADO"],
    default: "DISPONIBLE"
  },
  visitante: { type: mongoose.Schema.Types.ObjectId, ref: "Visitante", default: null },
  horaEntrada: { type: Date, default: null },
  placaVehiculo: { type: String, default: null }
}, {
  timestamps: true
});

// ========== ÍNDICES PARA MULTI-TENANT ==========
parqueaderoSchema.index({ conjunto: 1, numero: 1 }, { unique: true });
parqueaderoSchema.index({ conjunto: 1, estado: 1 });
parqueaderoSchema.index({ conjunto: 1, categoria: 1, tipoVehiculo: 1 });
// Índice para buscar parqueadero por apartamento
parqueaderoSchema.index({ conjunto: 1, torre: 1, apartamento: 1 });

module.exports = mongoose.model("Parqueadero", parqueaderoSchema, "parqueaderos");