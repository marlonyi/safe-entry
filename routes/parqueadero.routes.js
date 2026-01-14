const express = require("express");
const router = express.Router();
const Parqueadero = require("../config/models/parqueadero");
const HistorialAcceso = require("../config/models/historialAcceso");
const Usuario = require("../config/models/usuario");

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

        plaza.estado = "EN_ESPERA";  // Visitante asignado, esperando llegada
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
        await Parqueadero.updateMany({}, { estado: "DISPONIBLE", visitante: null, horaEntrada: null });
        res.json({ message: "Todas las plazas liberadas" });
    } catch (error) {
        res.status(500).json({ message: "Error al liberar plazas", error });
    }
});

// 📌 Registrar entrada de vehículo (usado por Python al detectar placa)
router.post("/registrar-entrada", async (req, res) => {
    try {
        const { placa } = req.body;

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

        // Importar modelo de Visitante
        const Visitante = require("../config/models/visitante");

        // Buscar visitante por placa
        const visitante = await Visitante.findOne({ placaVehiculo: placa.toUpperCase() });

        if (!visitante) {
            return res.status(404).json({
                success: false,
                message: "No se encontró visitante con esa placa"
            });
        }

        // Buscar su plaza asignada (debe estar EN_ESPERA)
        const plaza = await Parqueadero.findOne({
            visitante: visitante._id,
            estado: "EN_ESPERA"
        });

        if (!plaza) {
            // Verificar si ya está ocupada
            const plazaOcupada = await Parqueadero.findOne({
                visitante: visitante._id,
                estado: "OCUPADO"
            });

            if (plazaOcupada) {
                return res.status(200).json({
                    success: true,
                    message: "El visitante ya registró su entrada",
                    plaza: plazaOcupada.numero,
                    yaRegistrado: true
                });
            }

            return res.status(404).json({
                success: false,
                message: "No se encontró plaza en espera para este visitante"
            });
        }

        // Actualizar estado a OCUPADO y registrar hora
        plaza.estado = "OCUPADO";
        plaza.horaEntrada = new Date();
        await plaza.save();

        // Actualizar estado del visitante
        visitante.estado = "ingresado";
        await visitante.save();

        // Registrar en historial
        await HistorialAcceso.create({
            placa: placa.toUpperCase(),
            tipoAcceso: "entrada",
            tipoUsuario: "visitante",
            nombreUsuario: `${visitante.nombre} ${visitante.apellido}`,
            plaza: plaza.numero
        });

        console.log(`🚗 Entrada registrada: ${visitante.nombre} ${visitante.apellido} - Plaza ${plaza.numero}`);

        res.json({
            success: true,
            message: "Entrada registrada exitosamente",
            visitante: {
                nombre: `${visitante.nombre} ${visitante.apellido}`,
                placa: visitante.placaVehiculo
            },
            plaza: {
                numero: plaza.numero,
                horaEntrada: plaza.horaEntrada
            }
        });

    } catch (error) {
        console.error("Error registrando entrada:", error);
        res.status(500).json({
            success: false,
            message: "Error al registrar entrada",
            error: error.message
        });
    }
});

// 📌 Obtener historial de accesos con filtros
router.get("/historial", async (req, res) => {
    try {
        const { fecha, tipo, page = 1, limit = 50 } = req.query;

        let filtro = {};

        // Filtro por fecha (día específico)
        if (fecha) {
            const fechaInicio = new Date(fecha);
            fechaInicio.setHours(0, 0, 0, 0);
            const fechaFin = new Date(fecha);
            fechaFin.setHours(23, 59, 59, 999);
            filtro.fechaHora = { $gte: fechaInicio, $lte: fechaFin };
        }

        // Filtro por tipo de acceso
        if (tipo && (tipo === 'entrada' || tipo === 'salida')) {
            filtro.tipoAcceso = tipo;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [historial, total] = await Promise.all([
            HistorialAcceso.find(filtro)
                .sort({ fechaHora: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            HistorialAcceso.countDocuments(filtro)
        ]);

        res.json({
            success: true,
            data: historial,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error obteniendo historial:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener historial",
            error: error.message
        });
    }
});

// 📌 Registrar salida de vehículo
router.post("/registrar-salida", async (req, res) => {
    try {
        const { placa } = req.body;

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

        const Visitante = require("../config/models/visitante");

        // Buscar visitante por placa
        const visitante = await Visitante.findOne({ placaVehiculo: placa.toUpperCase() });

        if (!visitante) {
            // Puede ser un residente
            const residente = await Usuario.findOne({ placaVehiculo: placa.toUpperCase() });

            if (residente) {
                // Registrar salida de residente
                await HistorialAcceso.create({
                    placa: placa.toUpperCase(),
                    tipoAcceso: "salida",
                    tipoUsuario: "residente",
                    nombreUsuario: `${residente.nombre} ${residente.apellido}`,
                    plaza: null
                });

                console.log(`🚗 Salida registrada (residente): ${residente.nombre} ${residente.apellido}`);

                return res.json({
                    success: true,
                    message: "Salida de residente registrada",
                    usuario: {
                        nombre: `${residente.nombre} ${residente.apellido}`,
                        placa: residente.placaVehiculo,
                        tipo: "residente"
                    }
                });
            }

            return res.status(404).json({
                success: false,
                message: "No se encontró usuario con esa placa"
            });
        }

        // Buscar su plaza ocupada
        const plaza = await Parqueadero.findOne({
            visitante: visitante._id,
            estado: "OCUPADO"
        });

        if (!plaza) {
            return res.status(404).json({
                success: false,
                message: "No se encontró plaza ocupada para este visitante"
            });
        }

        // Liberar la plaza
        plaza.estado = "DISPONIBLE";
        plaza.visitante = null;
        plaza.horaEntrada = null;
        await plaza.save();

        // Actualizar estado del visitante
        visitante.estado = "salido";
        await visitante.save();

        // Registrar en historial
        await HistorialAcceso.create({
            placa: placa.toUpperCase(),
            tipoAcceso: "salida",
            tipoUsuario: "visitante",
            nombreUsuario: `${visitante.nombre} ${visitante.apellido}`,
            plaza: plaza.numero
        });

        console.log(`🚗 Salida registrada: ${visitante.nombre} ${visitante.apellido} - Plaza ${plaza.numero}`);

        res.json({
            success: true,
            message: "Salida registrada exitosamente",
            visitante: {
                nombre: `${visitante.nombre} ${visitante.apellido}`,
                placa: visitante.placaVehiculo
            },
            plaza: {
                numero: plaza.numero
            }
        });

    } catch (error) {
        console.error("Error registrando salida:", error);
        res.status(500).json({
            success: false,
            message: "Error al registrar salida",
            error: error.message
        });
    }
});

// 📌 Registrar acceso genérico (para Python - detecta automáticamente entrada o salida)
router.post("/registrar-acceso", async (req, res) => {
    try {
        const { placa } = req.body;

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

        const Visitante = require("../config/models/visitante");
        const placaUpper = placa.toUpperCase();

        // Buscar visitante por placa
        const visitante = await Visitante.findOne({ placaVehiculo: placaUpper });

        if (visitante) {
            // Si está ingresado, registrar salida
            if (visitante.estado === "ingresado") {
                const plaza = await Parqueadero.findOne({
                    visitante: visitante._id,
                    estado: "OCUPADO"
                });

                if (plaza) {
                    plaza.estado = "DISPONIBLE";
                    plaza.visitante = null;
                    plaza.horaEntrada = null;
                    await plaza.save();
                }

                visitante.estado = "salido";
                await visitante.save();

                await HistorialAcceso.create({
                    placa: placaUpper,
                    tipoAcceso: "salida",
                    tipoUsuario: "visitante",
                    nombreUsuario: `${visitante.nombre} ${visitante.apellido}`,
                    plaza: plaza?.numero || null
                });

                console.log(`🚗 SALIDA registrada: ${visitante.nombre} ${visitante.apellido}`);

                return res.json({
                    success: true,
                    tipoAcceso: "salida",
                    message: "Salida registrada exitosamente",
                    usuario: {
                        nombre: `${visitante.nombre} ${visitante.apellido}`,
                        placa: placaUpper,
                        tipo: "visitante"
                    }
                });
            }

            // Si está pendiente o en espera, registrar entrada
            const plaza = await Parqueadero.findOne({
                visitante: visitante._id,
                estado: "EN_ESPERA"
            });

            if (plaza) {
                plaza.estado = "OCUPADO";
                plaza.horaEntrada = new Date();
                await plaza.save();

                visitante.estado = "ingresado";
                await visitante.save();

                await HistorialAcceso.create({
                    placa: placaUpper,
                    tipoAcceso: "entrada",
                    tipoUsuario: "visitante",
                    nombreUsuario: `${visitante.nombre} ${visitante.apellido}`,
                    plaza: plaza.numero
                });

                console.log(`🚗 ENTRADA registrada: ${visitante.nombre} ${visitante.apellido} - Plaza ${plaza.numero}`);

                return res.json({
                    success: true,
                    tipoAcceso: "entrada",
                    message: "Entrada registrada exitosamente",
                    usuario: {
                        nombre: `${visitante.nombre} ${visitante.apellido}`,
                        placa: placaUpper,
                        tipo: "visitante"
                    },
                    plaza: plaza.numero
                });
            }

            return res.json({
                success: true,
                message: "Visitante reconocido pero sin plaza asignada",
                usuario: {
                    nombre: `${visitante.nombre} ${visitante.apellido}`,
                    placa: placaUpper,
                    tipo: "visitante"
                }
            });
        }

        // Buscar residente por placa
        const residente = await Usuario.findOne({ placaVehiculo: placaUpper });

        if (residente) {
            // Verificar último acceso para determinar si es entrada o salida
            const ultimoAcceso = await HistorialAcceso.findOne({ placa: placaUpper })
                .sort({ fechaHora: -1 });

            const tipoAcceso = (!ultimoAcceso || ultimoAcceso.tipoAcceso === "salida") ? "entrada" : "salida";

            await HistorialAcceso.create({
                placa: placaUpper,
                tipoAcceso: tipoAcceso,
                tipoUsuario: "residente",
                nombreUsuario: `${residente.nombre} ${residente.apellido}`,
                plaza: null
            });

            console.log(`🚗 ${tipoAcceso.toUpperCase()} registrada (residente): ${residente.nombre} ${residente.apellido}`);

            return res.json({
                success: true,
                tipoAcceso: tipoAcceso,
                message: `${tipoAcceso === 'entrada' ? 'Entrada' : 'Salida'} de residente registrada`,
                usuario: {
                    nombre: `${residente.nombre} ${residente.apellido}`,
                    placa: placaUpper,
                    tipo: "residente"
                }
            });
        }

        return res.status(404).json({
            success: false,
            message: "Placa no registrada en el sistema"
        });

    } catch (error) {
        console.error("Error registrando acceso:", error);
        res.status(500).json({
            success: false,
            message: "Error al registrar acceso",
            error: error.message
        });
    }
});

module.exports = router;

