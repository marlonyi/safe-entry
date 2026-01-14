const Visitante = require('../config/models/visitante');
const Parqueadero = require('../config/models/parqueadero');
const AuditLog = require('../config/models/auditLog');

/**
 * Registrar visitante con asignación automática de plaza
 */
exports.registrarVisitante = async (req, res) => {
    try {
        let { nombreVisitante, apellidoVisitante, cedulaVisitante, placaVisitante, residenteId, ejecutadoPor } = req.body;

        // Validación básica
        if (!nombreVisitante || !apellidoVisitante || !cedulaVisitante || !placaVisitante) {
            return res.status(400).json({
                mensaje: "Todos los campos son obligatorios: nombre, apellido, cédula y placa"
            });
        }

        // Si viene "admin", lo guardamos como null
        if (residenteId === "admin") {
            residenteId = null;
        }

        // Buscar plaza disponible
        const plaza = await Parqueadero.findOne({ estado: "DISPONIBLE" });
        if (!plaza) {
            return res.status(400).json({ mensaje: "No hay plazas disponibles" });
        }

        const nuevoVisitante = new Visitante({
            nombre: nombreVisitante,
            apellido: apellidoVisitante,
            cedula: cedulaVisitante,
            placaVehiculo: placaVisitante,
            residenteId: residenteId || null,
            parqueadero: plaza._id
        });

        await nuevoVisitante.save();

        // Actualizar plaza
        plaza.estado = "EN_ESPERA";  // Visitante asignado, esperando llegada
        plaza.visitante = nuevoVisitante._id;
        await plaza.save();

        // Registrar en auditoría
        if (ejecutadoPor) {
            await AuditLog.registrar({
                usuario: {
                    id: ejecutadoPor.id,
                    cedula: ejecutadoPor.cedula,
                    nombre: ejecutadoPor.nombre,
                    rol: ejecutadoPor.rol
                },
                accion: 'CREATE_VISITANTE',
                descripcion: `Registró visitante: ${nombreVisitante} ${apellidoVisitante} - Placa: ${placaVisitante}`,
                recurso: {
                    tipo: 'visitante',
                    id: nuevoVisitante._id.toString(),
                    nombre: `${nombreVisitante} ${apellidoVisitante}`,
                    datosAnteriores: null,
                    datosNuevos: {
                        nombre: nombreVisitante,
                        apellido: apellidoVisitante,
                        cedula: cedulaVisitante,
                        placaVehiculo: placaVisitante,
                        plaza: plaza.numero
                    }
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        }

        res.status(201).json({ visitante: nuevoVisitante, plaza });
    } catch (error) {
        console.error("Error al registrar visitante:", error);

        // Manejar error de duplicado
        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: "Ya existe un visitante con esa cédula o placa"
            });
        }

        res.status(500).json({ mensaje: "Error al registrar visitante" });
    }
};

/**
 * Obtener todos los visitantes
 */
exports.obtenerVisitantes = async (req, res) => {
    try {
        const visitantes = await Visitante.find()
            .populate("residenteId", "nombre cedula")
            .populate("parqueadero", "numero estado");
        res.json(visitantes);
    } catch (error) {
        console.error("Error al obtener visitantes:", error);
        res.status(500).json({ mensaje: "Error al obtener visitantes" });
    }
};

/**
 * Obtener visitantes de un residente específico
 */
exports.obtenerVisitantesPorResidente = async (req, res) => {
    try {
        const { residenteId } = req.params;
        const visitantes = await Visitante.find({ residenteId })
            .populate("parqueadero", "numero estado");
        res.json(visitantes);
    } catch (error) {
        console.error("Error al obtener visitantes del residente:", error);
        res.status(500).json({ mensaje: "Error al obtener visitantes" });
    }
};

/**
 * Eliminar visitante y liberar plaza
 */
exports.eliminarVisitante = async (req, res) => {
    try {
        const { residenteId, visitanteId } = req.params;
        const ejecutadoPor = req.body?.ejecutadoPor || null;

        // Construir query - si residenteId es "undefined" o "admin", buscar solo por visitanteId
        let query = { _id: visitanteId };
        if (residenteId && residenteId !== "undefined" && residenteId !== "admin" && residenteId !== "null") {
            query.residenteId = residenteId;
        }

        const visitante = await Visitante.findOne(query).lean();

        if (!visitante) {
            return res.status(404).json({ mensaje: "Visitante no encontrado" });
        }

        // Liberar la plaza EXPLÍCITAMENTE antes de eliminar
        if (visitante.parqueadero) {
            await Parqueadero.findByIdAndUpdate(visitante.parqueadero, {
                estado: "DISPONIBLE",
                visitante: null
            });
            console.log(`✅ Plaza ${visitante.parqueadero} liberada correctamente`);
        }

        // Eliminar visitante
        await Visitante.findByIdAndDelete(visitanteId);

        // Registrar en auditoría
        if (ejecutadoPor) {
            await AuditLog.registrar({
                usuario: {
                    id: ejecutadoPor.id,
                    cedula: ejecutadoPor.cedula,
                    nombre: ejecutadoPor.nombre,
                    rol: ejecutadoPor.rol
                },
                accion: 'DELETE_VISITANTE',
                descripcion: `Eliminó visitante: ${visitante.nombre} ${visitante.apellido} - Placa: ${visitante.placaVehiculo}`,
                recurso: {
                    tipo: 'visitante',
                    id: visitanteId,
                    nombre: `${visitante.nombre} ${visitante.apellido}`,
                    datosAnteriores: {
                        nombre: visitante.nombre,
                        apellido: visitante.apellido,
                        cedula: visitante.cedula,
                        placaVehiculo: visitante.placaVehiculo
                    },
                    datosNuevos: null
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        }

        // Devolver plazas actualizadas
        const plazasActualizadas = await Parqueadero.find().populate("visitante");

        res.status(200).json({
            mensaje: "Visitante eliminado y plaza liberada",
            plazas: plazasActualizadas
        });
    } catch (error) {
        console.error("Error al eliminar visitante:", error);
        res.status(500).json({ mensaje: "Error al eliminar visitante" });
    }
};

/**
 * Editar visitante
 */
exports.editarVisitante = async (req, res) => {
    try {
        const { visitanteId } = req.params;
        const { nombre, apellido, cedula, placaVehiculo, ejecutadoPor } = req.body;

        // Obtener estado anterior antes de actualizar
        const visitanteAnterior = await Visitante.findById(visitanteId).lean();
        if (!visitanteAnterior) {
            return res.status(404).json({ mensaje: "Visitante no encontrado" });
        }

        const visitante = await Visitante.findById(visitanteId);

        // Actualizar solo campos proporcionados
        if (nombre) visitante.nombre = nombre;
        if (apellido) visitante.apellido = apellido;
        if (cedula) visitante.cedula = cedula;
        if (placaVehiculo) visitante.placaVehiculo = placaVehiculo;

        await visitante.save();

        const visitanteActualizado = await Visitante.findById(visitanteId)
            .populate("parqueadero", "numero estado");

        // Registrar cambios en auditoría
        if (ejecutadoPor) {
            await AuditLog.registrar({
                usuario: {
                    id: ejecutadoPor.id,
                    cedula: ejecutadoPor.cedula,
                    nombre: ejecutadoPor.nombre,
                    rol: ejecutadoPor.rol
                },
                accion: 'UPDATE_VISITANTE',
                descripcion: `Editó visitante: ${visitanteAnterior.nombre} ${visitanteAnterior.apellido}`,
                recurso: {
                    tipo: 'visitante',
                    id: visitanteId,
                    nombre: `${visitanteAnterior.nombre} ${visitanteAnterior.apellido}`,
                    datosAnteriores: {
                        nombre: visitanteAnterior.nombre,
                        apellido: visitanteAnterior.apellido,
                        cedula: visitanteAnterior.cedula,
                        placaVehiculo: visitanteAnterior.placaVehiculo
                    },
                    datosNuevos: {
                        nombre: visitanteActualizado.nombre,
                        apellido: visitanteActualizado.apellido,
                        cedula: visitanteActualizado.cedula,
                        placaVehiculo: visitanteActualizado.placaVehiculo
                    }
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        }

        res.json({ mensaje: "Visitante actualizado con éxito", visitante: visitanteActualizado });
    } catch (error) {
        console.error("Error al actualizar visitante:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: "Ya existe un visitante con esa cédula o placa"
            });
        }

        res.status(500).json({ mensaje: "Error al actualizar visitante" });
    }
};

/**
 * Ver todas las plazas con visitantes
 */
exports.obtenerPlazasConVisitantes = async (req, res) => {
    try {
        const plazas = await Parqueadero.find().populate("visitante");
        res.json(plazas);
    } catch (error) {
        console.error("Error al obtener plazas:", error);
        res.status(500).json({ mensaje: "Error al obtener plazas" });
    }
};
