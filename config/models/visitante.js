const mongoose = require('mongoose');
const Parqueadero = require('./parqueadero'); // 🔹 Asegúrate de la ruta correcta
const crypto = require('crypto');

const visitanteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  cedula: { type: String, required: true, unique: true },
  placaVehiculo: { type: String, required: true, unique: true },
  residenteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: false,   // ✅ ya no es obligatorio
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
  // Secreto para código dinámico TOTP (NO usar default dinámico - causa problemas)
  codigoSecreto: {
    type: String,
    default: null  // Se genera en el endpoint cuando es necesario
  }
}, {
  timestamps: true
});

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

// Generar código dinámico de 6 dígitos (cambia cada 10 minutos)
visitanteSchema.methods.generarCodigoDinamico = function () {
  const INTERVALO_MS = 10 * 60 * 1000; // 10 minutos
  const intervaloActual = Math.floor(Date.now() / INTERVALO_MS);

  const hash = crypto.createHmac('sha256', this.codigoSecreto || 'default')
    .update(intervaloActual.toString())
    .digest('hex');

  // Convertir primeros 6 caracteres hex a número y tomar 6 dígitos
  const numero = parseInt(hash.slice(0, 8), 16) % 1000000;
  return numero.toString().padStart(6, '0');
};

// Verificar código dinámico (acepta actual y anterior por tolerancia)
visitanteSchema.methods.verificarCodigoDinamico = function (codigo) {
  const INTERVALO_MS = 10 * 60 * 1000;

  // Código actual
  const codigoActual = this.generarCodigoDinamico();
  if (codigo === codigoActual) return true;

  // Código del intervalo anterior (tolerancia)
  const intervaloAnterior = Math.floor(Date.now() / INTERVALO_MS) - 1;
  const hashAnterior = crypto.createHmac('sha256', this.codigoSecreto || 'default')
    .update(intervaloAnterior.toString())
    .digest('hex');
  const codigoAnterior = (parseInt(hashAnterior.slice(0, 8), 16) % 1000000).toString().padStart(6, '0');

  return codigo === codigoAnterior;
};

// Obtener tiempo restante del código actual (en segundos)
visitanteSchema.methods.tiempoRestanteCodigo = function () {
  const INTERVALO_MS = 10 * 60 * 1000;
  const intervaloActual = Math.floor(Date.now() / INTERVALO_MS);
  const siguienteIntervalo = (intervaloActual + 1) * INTERVALO_MS;
  return Math.ceil((siguienteIntervalo - Date.now()) / 1000);
};


// Middleware moderno para liberar plaza al eliminar
visitanteSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  if (this.parqueadero) {
    try {
      const plaza = await Parqueadero.findById(this.parqueadero);
      if (plaza) {
        plaza.estado = "DISPONIBLE";
        plaza.visitante = null;
        await plaza.save();
      }
      next();
    } catch (error) {
      console.error("Error liberando la plaza del visitante eliminado:", error);
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model("Visitante", visitanteSchema, "visitantes");
