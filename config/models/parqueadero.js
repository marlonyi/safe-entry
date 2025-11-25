// models/parqueadero.js
const mongoose = require("mongoose");

const parqueaderoSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }, // cada plaza debe ser única
  estado: { type: String, enum: ["DISPONIBLE", "OCUPADO"], default: "DISPONIBLE" },
  visitante: { type: mongoose.Schema.Types.ObjectId, ref: "Visitante", default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model("Parqueadero", parqueaderoSchema, "parqueaderos");
