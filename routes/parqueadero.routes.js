const express = require("express");
const router = express.Router();
const Parqueadero = require("../config/models/parqueadero");

// 📌 Obtener todas las plazas con info del visitante
router.get("/", async (req, res) => {
    try {
        const plazas = await Parqueadero.find().populate({
            path: "visitante",
            select: "nombre apellido placaVehiculo cedula"
        });
        
        // Transformar la respuesta para incluir la placa de forma clara
        const plazasFormateadas = plazas.map(plaza => ({
            numero: plaza.numero,
            estado: plaza.estado,
            placa: plaza.visitante?.placaVehiculo || null,
            visitante: plaza.visitante?.nombre + " " + plaza.visitante?.apellido || null,
            _id: plaza._id
        }));
        
        res.json(plazasFormateadas);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener plazas", error });
    }
});

// 📌 Asignar visitante a una plaza disponible
router.post("/asignar", async (req, res) => {
    try {
        const { visitanteId } = req.body;

        const plaza = await Parqueadero.findOne({ estado: "DISPONIBLE" });
        if (!plaza) return res.status(400).json({ message: "No hay plazas disponibles" });

        plaza.estado = "OCUPADO";
        plaza.visitante = visitanteId;
        await plaza.save();

        res.json(await plaza.populate("visitante"));
    } catch (error) {
        res.status(500).json({ message: "Error al asignar visitante", error });
    }
});

// 📌 Liberar todas las plazas
router.post("/liberar", async (req, res) => {
    try {
        await Parqueadero.updateMany({}, { estado: "DISPONIBLE", visitante: null });
        res.json({ message: "Todas las plazas liberadas" });
    } catch (error) {
        res.status(500).json({ message: "Error al liberar plazas", error });
    }
});

module.exports = router;
