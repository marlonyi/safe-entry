const mongoose = require('mongoose');
const crypto = require('crypto');

const visitanteSchema = new mongoose.Schema({
  // ========== REFERENCIA AL CONJUNTO (TENANT) ==========
  conjunto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conjunto",
    required: true  // Todos los visitantes deben pertenecer a un conjunto
  },

  // ========== INFORMACIÓN DEL VISITANTE ==========
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  cedula: { type: String, required: true },
  placaVehiculo: { type: String, default: null },
  residenteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: false,
    default: null
  },
  parqueadero: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parqueadero",
    default: null
  },
  // Campos para QR
  qrToken: {
    type: String,
    default: null
  },
  qrExpiracion: {
    type: Date,
    default: null
  },
  apartamentoDestino: {
    type: String,
    default: ''
  },
  torreDestino: {
    type: String,
    default: ''
  },
  motivoVisita: {
    type: String,
    default: ''
  },
  estado: {
    type: String,
    enum: ['pendiente', 'ingresado', 'salido'],
    default: 'pendiente'
  },
  // Secreto para código dinámico TOTP
  codigoSecreto: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// ========== ÍNDICES PARA MULTI-TENANT ==========
visitanteSchema.index({ conjunto: 1, cedula: 1 }, { unique: true });
// Único por conjunto SOLO para placas reales (string). Los visitantes sin
// vehículo guardan placaVehiculo=null y no colisionan entre sí.
visitanteSchema.index(
    { conjunto: 1, placaVehiculo: 1 },
    { unique: true, partialFilterExpression: { placaVehiculo: { $type: "string" } } }
);
visitanteSchema.index({ conjunto: 1, residenteId: 1, createdAt: -1 });
visitanteSchema.index({ conjunto: 1, estado: 1 });

// Método para generar token QR
visitanteSchema.methods.generarQR = function (horasValidez = 24) {
  this.qrToken = crypto.randomBytes(16).toString('hex');
  this.qrExpiracion = new Date(Date.now() + horasValidez * 60 * 60 * 1000);
  return this.qrToken;
};

// Método para verificar si el QR es válido
visitanteSchema.methods.verificarQR = function (token) {
  if (!this.qrToken || !this.qrExpiracion) return false;
  if (this.qrToken !== token) return false;
  if (new Date() > this.qrExpiracion) return false;
  return true;
};

// Método estático para buscar por token QR
visitanteSchema.statics.buscarPorQR = async function (token) {
  return await this.findOne({
    qrToken: token,
    qrExpiracion: { $gt: new Date() }
  });
};

// ========== MÉTODOS TOTP (Código Dinámico) ==========
visitanteSchema.methods.generarCodigoDinamico = function () {
  const INTERVALO_MS = 10 * 60 * 1000;
  const intervaloActual = Math.floor(Date.now() / INTERVALO_MS);
  const hash = crypto.createHmac('sha256', this.codigoSecreto || 'default')
    .update(intervaloActual.toString())
    .digest('hex');
  const numero = parseInt(hash.slice(0, 8), 16) % 1000000;
  return numero.toString().padStart(6, '0');
};

visitanteSchema.methods.verificarCodigoDinamico = function (codigo) {
  const INTERVALO_MS = 10 * 60 * 1000;
  const codigoActual = this.generarCodigoDinamico();
  if (codigo === codigoActual) return true;

  const intervaloAnterior = Math.floor(Date.now() / INTERVALO_MS) - 1;
  const hashAnterior = crypto.createHmac('sha256', this.codigoSecreto || 'default')
    .update(intervaloAnterior.toString())
    .digest('hex');
  const codigoAnterior = (parseInt(hashAnterior.slice(0, 8), 16) % 1000000).toString().padStart(6, '0');
  return codigo === codigoAnterior;
};

visitanteSchema.methods.tiempoRestanteCodigo = function () {
  const INTERVALO_MS = 10 * 60 * 1000;
  const intervaloActual = Math.floor(Date.now() / INTERVALO_MS);
  const siguienteIntervalo = (intervaloActual + 1) * INTERVALO_MS;
  return Math.ceil((siguienteIntervalo - Date.now()) / 1000);
};

module.exports = mongoose.model("Visitante", visitanteSchema, "visitantes");