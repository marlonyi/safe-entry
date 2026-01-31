/**
 * 🅿️ Controlador de Parqueadero
 * Maneja toda la lógica de negocio relacionada con plazas de parqueadero
 * 
 * 🏢 MULTI-TENANT: Todas las operaciones filtran por conjunto
 */

const Parqueadero = require("../config/models/parqueadero");
const HistorialAcceso = require("../config/models/historialAcceso");
const Usuario = require("../config/models/usuario");
const Visitante = require("../config/models/visitante");
const { getTenantFilter, isSuperAdmin, getConjuntoId } = require("../middlewares/auth.middleware");

/**
 * 📌 Obtener todas las plazas con info del visitante
 * GET /api/parqueaderos
 * 🏢 Filtrado por conjunto del usuario autenticado
 */
const obtenerPlazas = async (req, res) => {
    try {
        // Obtener filtro de conjunto
        const tenantFilter = getTenantFilter(req);

        const plazas = await Parqueadero.find(tenantFilter).populate({
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
};

/**
 * 📌 Asignar visitante a una plaza disponible
 * POST /api/parqueaderos/asignar
 * 🏢 Asigna plaza dentro del conjunto del usuario
 */
const asignarVisitante = async (req, res) => {
    try {
        const { visitanteId } = req.body;
        const tenantFilter = getTenantFilter(req);

        const plaza = await Parqueadero.findOne({ ...tenantFilter, estado: "DISPONIBLE" });
        if (!plaza) return res.status(400).json({ message: "No hay plazas disponibles" });

        plaza.estado = "EN_ESPERA";  // Visitante asignado, esperando llegada
        plaza.visitante = visitanteId;
        await plaza.save();

        res.json(await plaza.populate("visitante"));
    } catch (error) {
        res.status(500).json({ message: "Error al asignar visitante", error });
    }
};

/**
 * 📌 Liberar todas las plazas
 * POST /api/parqueaderos/liberar
 * 🏢 Solo libera plazas del conjunto del usuario
 */
const liberarPlazas = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);
        await Parqueadero.updateMany(tenantFilter, { estado: "DISPONIBLE", visitante: null, horaEntrada: null });
        res.json({ message: "Todas las plazas liberadas" });
    } catch (error) {
        res.status(500).json({ message: "Error al liberar plazas", error });
    }
};

/**
 * 📌 Registrar entrada de vehículo (usado por Python al detectar placa)
 * POST /api/parqueaderos/registrar-entrada
 * 🏢 Busca visitante dentro del conjunto indicado
 */
const registrarEntrada = async (req, res) => {
    try {
        const { placa, conjuntoId } = req.body; // conjuntoId opcional desde Python

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

        // Determinar filtro de conjunto (desde body o desde token)
        const tenantFilter = conjuntoId
            ? { conjunto: conjuntoId }
            : getTenantFilter(req);

        // Buscar visitante por placa en el conjunto
        const visitante = await Visitante.findOne({
            ...tenantFilter,
            placaVehiculo: placa.toUpperCase()
        });

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

        // Registrar en historial con conjunto
        await HistorialAcceso.create({
            placa: placa.toUpperCase(),
            tipoAcceso: "entrada",
            tipoUsuario: "visitante",
            nombreUsuario: `${visitante.nombre} ${visitante.apellido}`,
            plaza: plaza.numero,
            conjunto: visitante.conjunto // Incluir conjunto en historial
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
};

/**
 * 📌 Obtener historial de accesos con filtros
 * GET /api/parqueaderos/historial
 * 🏢 Filtrado por conjunto del usuario
 */
const obtenerHistorial = async (req, res) => {
    try {
        const { fecha, tipo, page = 1, limit = 50 } = req.query;

        // Aplicar filtro de conjunto
        const tenantFilter = getTenantFilter(req);
        let filtro = { ...tenantFilter };

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
};

/**
 * 📌 Registrar salida de vehículo
 * POST /api/parqueaderos/registrar-salida
 * 🏢 Busca visitante dentro del conjunto
 */
const registrarSalida = async (req, res) => {
    try {
        const { placa, conjuntoId } = req.body;

        // Determinar filtro de conjunto
        const tenantFilter = conjuntoId
            ? { conjunto: conjuntoId }
            : getTenantFilter(req);

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

        // Buscar visitante por placa en el conjunto
        const visitante = await Visitante.findOne({
            ...tenantFilter,
            placaVehiculo: placa.toUpperCase()
        });

        if (!visitante) {
            // Puede ser un residente
            const residente = await Usuario.findOne({
                ...tenantFilter,
                placaVehiculo: placa.toUpperCase()
            });

            if (residente) {
                // Registrar salida de residente
                await HistorialAcceso.create({
                    placa: placa.toUpperCase(),
                    tipoAcceso: "salida",
                    tipoUsuario: "residente",
                    nombreUsuario: `${residente.nombre} ${residente.apellido}`,
                    plaza: null,
                    conjunto: residente.conjunto
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
};

/**
 * 📌 Registrar acceso genérico (para Python - detecta automáticamente entrada o salida)
 * POST /api/parqueaderos/registrar-acceso
 */
const registrarAcceso = async (req, res) => {
    try {
        const { placa } = req.body;

        if (!placa) {
            return res.status(400).json({
                success: false,
                message: "Se requiere la placa del vehículo"
            });
        }

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
};

// ========================================
// 📌 GESTIÓN DE PLAZAS (SuperAdmin / Admin)
// ========================================

/**
 * 🏢 SUPERADMIN: Crear plazas de parqueadero para un conjunto
 * POST /api/parqueaderos/conjunto/:conjuntoId/crear
 */
const crearPlazasConjunto = async (req, res) => {
    try {
        const { conjuntoId } = req.params;
        const { cantidad, prefijo = "P" } = req.body;

        console.log('🅿️ Creando plazas - Conjunto:', conjuntoId, '| Cantidad:', cantidad);

        // Validar cantidad
        if (!cantidad || cantidad < 1 || cantidad > 500) {
            return res.status(400).json({
                error: "La cantidad debe estar entre 1 y 500 plazas"
            });
        }

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(conjuntoId)) {
            return res.status(400).json({ error: "ID de conjunto no válido" });
        }

        const Conjunto = require('../config/models/conjunto');
        const conjunto = await Conjunto.findById(conjuntoId);
        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Verificar plazas existentes
        const plazasExistentes = await Parqueadero.countDocuments({ conjunto: conjuntoId });

        // Verificar límite según plan
        const maxPermitidas = conjunto.plan?.limites?.maxParqueaderos || conjunto.configuracion?.maxParqueaderos || 100;
        if (plazasExistentes + cantidad > maxPermitidas) {
            return res.status(400).json({
                error: `Excede el límite del plan. Máximo: ${maxPermitidas}, Actuales: ${plazasExistentes}, Solicitadas: ${cantidad}`
            });
        }

        // Obtener el número más alto existente para continuar la secuencia
        const ultimaPlaza = await Parqueadero.findOne({ conjunto: conjuntoId })
            .sort({ numero: -1 })
            .lean();

        let ultimoNumero = 0;
        if (ultimaPlaza && ultimaPlaza.numero) {
            const match = ultimaPlaza.numero.match(/(\d+)/);
            if (match) ultimoNumero = parseInt(match[1]);
        }

        // Crear las plazas
        const plazasNuevas = [];
        for (let i = 1; i <= cantidad; i++) {
            plazasNuevas.push({
                conjunto: conjuntoId,
                numero: `${prefijo}${ultimoNumero + i}`,
                estado: "DISPONIBLE",
                visitante: null,
                horaEntrada: null
            });
        }

        const plazasCreadas = await Parqueadero.insertMany(plazasNuevas);

        console.log(`✅ ${plazasCreadas.length} plazas creadas para ${conjunto.nombre}`);

        res.status(201).json({
            mensaje: `${plazasCreadas.length} plazas creadas correctamente`,
            plazas: plazasCreadas.map(p => ({ id: p._id, numero: p.numero })),
            totalPlazas: plazasExistentes + plazasCreadas.length
        });
    } catch (error) {
        console.error("❌ Error al crear plazas:", error);
        res.status(500).json({ error: "Error al crear plazas", detalles: error.message });
    }
};

/**
 * 🏢 SUPERADMIN: Eliminar una plaza de parqueadero
 * DELETE /api/parqueaderos/:id
 */
const eliminarPlaza = async (req, res) => {
    try {
        const { id } = req.params;

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de plaza no válido" });
        }

        const plaza = await Parqueadero.findById(id);
        if (!plaza) {
            return res.status(404).json({ error: "Plaza no encontrada" });
        }

        // No permitir eliminar si está ocupada
        if (plaza.estado === "OCUPADO" || plaza.estado === "EN_ESPERA") {
            return res.status(400).json({
                error: "No se puede eliminar una plaza ocupada. Libérela primero."
            });
        }

        await Parqueadero.findByIdAndDelete(id);

        console.log(`🗑️ Plaza ${plaza.numero} eliminada`);

        res.json({
            mensaje: `Plaza ${plaza.numero} eliminada correctamente`,
            plazaEliminada: { id: plaza._id, numero: plaza.numero }
        });
    } catch (error) {
        console.error("❌ Error al eliminar plaza:", error);
        res.status(500).json({ error: "Error al eliminar plaza", detalles: error.message });
    }
};

/**
 * 📝 ADMIN/SUPERADMIN: Editar número de una plaza
 * PUT /api/parqueaderos/:id
 */
const editarPlaza = async (req, res) => {
    try {
        const { id } = req.params;
        const { numero } = req.body;

        if (!numero || numero.trim() === "") {
            return res.status(400).json({ error: "El número de plaza es requerido" });
        }

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de plaza no válido" });
        }

        const plaza = await Parqueadero.findById(id);
        if (!plaza) {
            return res.status(404).json({ error: "Plaza no encontrada" });
        }

        // Verificar que el nuevo número no exista en el mismo conjunto
        const duplicado = await Parqueadero.findOne({
            conjunto: plaza.conjunto,
            numero: numero.trim(),
            _id: { $ne: id }
        });

        if (duplicado) {
            return res.status(400).json({
                error: `Ya existe una plaza con el número "${numero}" en este conjunto`
            });
        }

        const numeroAnterior = plaza.numero;
        plaza.numero = numero.trim();
        await plaza.save();

        console.log(`✏️ Plaza renombrada: ${numeroAnterior} -> ${plaza.numero}`);

        res.json({
            mensaje: `Plaza renombrada de ${numeroAnterior} a ${plaza.numero}`,
            plaza: { id: plaza._id, numero: plaza.numero }
        });
    } catch (error) {
        console.error("❌ Error al editar plaza:", error);
        res.status(500).json({ error: "Error al editar plaza", detalles: error.message });
    }
};

/**
 * 📋 Obtener plazas de un conjunto específico (para SuperAdmin)
 * GET /api/parqueaderos/conjunto/:conjuntoId
 */
const obtenerPlazasConjunto = async (req, res) => {
    try {
        const { conjuntoId } = req.params;

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(conjuntoId)) {
            return res.status(400).json({ error: "ID de conjunto no válido" });
        }

        const plazas = await Parqueadero.find({ conjunto: conjuntoId })
            .populate({
                path: "visitante",
                select: "nombre apellido placaVehiculo"
            })
            .sort({ numero: 1 })
            .lean();

        // Ordenar numéricamente
        const plazasOrdenadas = plazas.sort((a, b) => {
            const numA = parseInt(a.numero.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.numero.replace(/\D/g, '')) || 0;
            return numA - numB;
        });

        const stats = {
            total: plazas.length,
            disponibles: plazas.filter(p => p.estado === "DISPONIBLE").length,
            ocupadas: plazas.filter(p => p.estado === "OCUPADO").length,
            enEspera: plazas.filter(p => p.estado === "EN_ESPERA").length
        };

        res.json({
            plazas: plazasOrdenadas.map(p => ({
                _id: p._id,
                numero: p.numero,
                estado: p.estado,
                visitante: p.visitante ? `${p.visitante.nombre} ${p.visitante.apellido}` : null,
                placa: p.visitante?.placaVehiculo || null
            })),
            estadisticas: stats
        });
    } catch (error) {
        console.error("❌ Error al obtener plazas del conjunto:", error);
        res.status(500).json({ error: "Error al obtener plazas", detalles: error.message });
    }
};

module.exports = {
    obtenerPlazas,
    asignarVisitante,
    liberarPlazas,
    registrarEntrada,
    obtenerHistorial,
    registrarSalida,
    registrarAcceso,
    // Nuevas funciones de gestión
    crearPlazasConjunto,
    eliminarPlaza,
    editarPlaza,
    obtenerPlazasConjunto
};
