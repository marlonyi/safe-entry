const mongoose = require("mongoose");

/**
 * Modelo para registrar instalaciones on-premise
 * Las instalaciones reportan periódicamente a Azure (heartbeat)
 */
const InstalacionSchema = new mongoose.Schema({
    // Identificador único de la instalación (generado en cliente)
    instalacionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Información básica
    nombre: {
        type: String,
        required: true
    },

    licencia: {
        type: String,
        default: null // Para futuro sistema de licencias
    },

    version: {
        type: String,
        default: "1.0.0"
    },

    // Estado
    activa: {
        type: Boolean,
        default: true
    },

    ultimoHeartbeat: {
        type: Date,
        default: Date.now
    },

    // Estadísticas reportadas
    stats: {
        usuarios: {
            residentes: { type: Number, default: 0 },
            porteros: { type: Number, default: 0 },
            admins: { type: Number, default: 0 },
            total: { type: Number, default: 0 }
        },
        plazas: {
            total: { type: Number, default: 0 },
            ocupadas: { type: Number, default: 0 },
            libres: { type: Number, default: 0 },
            enEspera: { type: Number, default: 0 }
        },
        accesos: {
            hoy: { type: Number, default: 0 },
            semana: { type: Number, default: 0 },
            mes: { type: Number, default: 0 }
        },
        ultimoAcceso: Date
    },

    // Estado de salud del sistema
    salud: {
        mongodb: { type: String, enum: ["ok", "error", "warning"], default: "ok" },
        uptime: { type: Number, default: 0 }, // segundos
        memoria: { type: String, default: "0%" },
        disco: { type: String, default: "0%" },
        cpu: { type: String, default: "0%" }
    },

    // Configuración remota (SuperAdmin puede modificar)
    configuracion: {
        heartbeatIntervalo: { type: Number, default: 300 }, // segundos (5 min)
        maxUsuarios: { type: Number, default: 0 }, // 0 = sin límite
        maxPlazas: { type: Number, default: 0 },
        funcionesHabilitadas: {
            reconocimientoPlacas: { type: Boolean, default: true },
            qrScanner: { type: Boolean, default: true },
            visitantes: { type: Boolean, default: true }
        },
        mensajePersonalizado: { type: String, default: "" }
    },

    // Información de contacto del cliente
    cliente: {
        nombre: String,
        email: String,
        telefono: String,
        direccion: String
    },

    // IP pública desde donde reporta
    ipPublica: String,

    // Historial de heartbeats (últimos 100)
    historialHeartbeats: [{
        fecha: Date,
        stats: Object,
        salud: Object
    }],

    // Notas del SuperAdmin
    notas: String

}, { timestamps: true });

// Índices
InstalacionSchema.index({ ultimoHeartbeat: -1 });
InstalacionSchema.index({ activa: 1, ultimoHeartbeat: -1 });

// Método virtual para determinar si está en línea (heartbeat < 10 min)
InstalacionSchema.virtual("enLinea").get(function () {
    const diezMinutos = 10 * 60 * 1000;
    return (Date.now() - this.ultimoHeartbeat) < diezMinutos;
});

// Método para actualizar desde heartbeat
InstalacionSchema.methods.actualizarDesdeHeartbeat = function (datos) {
    this.ultimoHeartbeat = new Date();
    this.version = datos.version || this.version;

    if (datos.stats) {
        // Actualizar cada subdocumento explícitamente
        if (datos.stats.usuarios) {
            this.stats.usuarios = { ...this.stats.usuarios.toObject?.() || this.stats.usuarios, ...datos.stats.usuarios };
        }
        if (datos.stats.plazas) {
            this.stats.plazas = { ...this.stats.plazas.toObject?.() || this.stats.plazas, ...datos.stats.plazas };
        }
        if (datos.stats.accesos) {
            this.stats.accesos = { ...this.stats.accesos.toObject?.() || this.stats.accesos, ...datos.stats.accesos };
        }
    }

    if (datos.salud) {
        this.salud = { ...this.salud.toObject?.() || this.salud, ...datos.salud };
    }

    if (datos.ipPublica) {
        this.ipPublica = datos.ipPublica;
    }

    // Guardar en historial (máximo 100)
    this.historialHeartbeats.push({
        fecha: new Date(),
        stats: datos.stats,
        salud: datos.salud
    });

    if (this.historialHeartbeats.length > 100) {
        this.historialHeartbeats = this.historialHeartbeats.slice(-100);
    }

    return this.save();
};

// Serialización
InstalacionSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Instalacion", InstalacionSchema);
