/**
 * Servicio de Visitantes
 */
const Visitante = require('./visitante.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');

const registrarVisitante = async (data, conjuntoId, tenantFilter) => {
    let { nombreVisitante, apellidoVisitante, cedulaVisitante, placaVisitante, residenteId, tipoVehiculo } = data;

    if (!nombreVisitante || !apellidoVisitante || !cedulaVisitante || !placaVisitante) {
        throw new Error("Todos los campos son obligatorios: nombre, apellido, cédula y placa");
    }

    if (residenteId === "admin") {
        residenteId = null;
    }

    // Determinar tipo de vehículo basado en la placa si no se especifica
    if (!tipoVehiculo) {
        // Placas de moto en Colombia suelen tener formato: ABC12 o ABC12D (terminan en letra)
        const placaUpper = placaVisitante.toUpperCase();
        if (placaUpper.length <= 5 || /^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(placaUpper)) {
            tipoVehiculo = 'MOTO';
        } else {
            tipoVehiculo = 'CARRO';
        }
    }

    let plaza = null;

    if (placaVisitante && placaVisitante.toUpperCase() !== 'N/A') {
        // Buscar parqueadero disponible para visitantes del tipo de vehículo correspondiente
        plaza = await Parqueadero.findOne({
            ...tenantFilter,
            estado: "DISPONIBLE",
            categoria: "VISITANTE",
            tipoVehiculo: tipoVehiculo
        });

        // Si no hay del tipo específico, buscar cualquiera de visitante disponible
        if (!plaza) {
            plaza = await Parqueadero.findOne({
                ...tenantFilter,
                estado: "DISPONIBLE",
                categoria: "VISITANTE"
            });
        }
    }

    const nuevoVisitante = new Visitante({
        nombre: nombreVisitante,
        apellido: apellidoVisitante,
        cedula: cedulaVisitante,
        placaVehiculo: placaVisitante,
        residenteId,
        parqueadero: plaza ? plaza._id : null,
        conjunto: conjuntoId
    });

    await nuevoVisitante.save();

    if (plaza) {
        plaza.visitante = nuevoVisitante._id;
        plaza.estado = "OCUPADO";
        plaza.horaAsignacion = new Date();
        plaza.placaVehiculo = placaVisitante;
        await plaza.save();
    }

    return { visitante: nuevoVisitante, plaza };
};

const obtenerVisitantes = async (tenantFilter) => {
    return await Visitante.find(tenantFilter)
        .populate('parqueadero', 'numero estado')
        .populate('residenteId', 'nombre apartamento torre');
};

const obtenerVisitantesPorResidente = async (residenteId, tenantFilter) => {
    return await Visitante.find({ ...tenantFilter, residenteId })
        .populate('parqueadero', 'numero estado')
        .populate('residenteId', 'nombre apartamento torre');
};

const eliminarVisitante = async (id, tenantFilter) => {
    const visitante = await Visitante.findOne({ _id: id, ...tenantFilter });
    if (!visitante) throw new Error("Visitante no encontrado en este conjunto");

    await Visitante.findByIdAndDelete(id);

    const plaza = await Parqueadero.findOne({ _id: visitante.parqueadero, ...tenantFilter });
    if (plaza) {
        plaza.estado = "DISPONIBLE";
        plaza.visitante = null;
        plaza.horaAsignacion = null;
        await plaza.save();
    }

    return { visitante, plaza };
};

const editarVisitante = async (id, updateData, tenantFilter) => {
    const { nombreVisitante, apellidoVisitante, cedulaVisitante, placaVisitante } = updateData;

    if (!nombreVisitante || !apellidoVisitante || !cedulaVisitante || !placaVisitante) {
        throw new Error("Todos los campos son obligatorios");
    }

    const visitante = await Visitante.findOne({ _id: id, ...tenantFilter });
    if (!visitante) throw new Error("Visitante no encontrado");

    Object.assign(visitante, {
        nombre: nombreVisitante,
        apellido: apellidoVisitante,
        cedula: cedulaVisitante,
        placaVehiculo: placaVisitante
    });
    return await visitante.save();
};

const obtenerPlazasConVisitantes = async (tenantFilter) => {
    return await Parqueadero.find({ ...tenantFilter, estado: 'OCUPADO' })
        .populate('visitante', 'nombre apellido cedula placaVehiculo');
};

module.exports = {
    registrarVisitante,
    obtenerVisitantes,
    obtenerVisitantesPorResidente,
    eliminarVisitante,
    editarVisitante,
    obtenerPlazasConVisitantes
};