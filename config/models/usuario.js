const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    cedula: { type: String, required: true, unique: true },
    apartamento: { type: String },
    torre: { type: String },
    fechaIngreso: { type: Date },
    fechaRetiro: { type: Date },
    estadoExpensa: { type: String, enum: ["al dia", "en mora"], default: "al dia" },
    tieneVehiculo: { type: Boolean, default: true },
    placaVehiculo: { type: String },
    placa2Vehiculo: { type: String },
    password: { type: String, required: true },
    rol: { type: String, enum: ["admin", "residente", "porteria"], default: "residente" }
}, {
    timestamps: true
});

module.exports = mongoose.model("Usuario", usuarioSchema);
