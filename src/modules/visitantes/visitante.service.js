/**
 * Servicio de Visitantes
 */
const Visitante = require('./visitante.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');
const parqueaderoService = require('../parqueaderos/parqueadero.service');

const registrarVisitante = async (data, conjuntoId, tenantFilter) => {
    let { nombreVisitante, apellidoVisitante, cedulaVisitante, placaVisitante, residenteId, tipoVehiculo } = data;

    if (!nombreVisitante || !apellidoVisitante || !cedulaVisitante) {
        throw new Error("Nombre, apellido y cédula son obligatorios");
    }

    if (residenteId === "admin") {
        residenteId = null;
    }

    // Visitante sin vehículo: se guarda placa null (no la cadena 'N/A') para no
    // colisionar en el índice único parcial (conjunto, placaVehiculo).
    const placaNormalizada = (placaVisitante && placaVisitante.toUpperCase() !== 'N/A' && placaVisitante.trim() !== '')
        ? placaVisitante.toUpperCase()
        : null;

    // Determinar tipo de vehículo basado en la placa si no se especifica
    if (!tipoVehiculo && placaNormalizada) {
        // Placas de moto en Colombia suelen tener formato: ABC12 o ABC12D (terminan en letra)
        if (placaNormalizada.length <= 5 || /^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(placaNormalizada)) {
            tipoVehiculo = 'MOTO';
        } else {
            tipoVehiculo = 'CARRO';
        }
    }

    let plaza = null;

    if (placaNormalizada) {
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
        placaVehiculo: placaNormalizada,
        residenteId,
        parqueadero: plaza ? plaza._id : null,
        conjunto: conjuntoId
    });

    await nuevoVisitante.save();

    if (plaza) {
        // La transición de estado la hace el dueño de la máquina de estados
        // (parqueadero.service), no este módulo.
        plaza = await parqueaderoService.ocuparPlazaVisitante(plaza._id, {
            visitanteId: nuevoVisitante._id,
            placa: placaNormalizada
        });
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

    let plaza = await Parqueadero.findOne({ _id: visitante.parqueadero, ...tenantFilter });
    if (plaza) {
        plaza = await parqueaderoService.liberarPlazaVisitante(plaza._id);
    }

    return { visitante, plaza };
};

const editarVisitante = async (id, updateData, tenantFilter) => {
    const { nombreVisitante, apellidoVisitante, cedulaVisitante, placaVisitante } = updateData;

    if (!nombreVisitante || !apellidoVisitante || !cedulaVisitante) {
        throw new Error("Nombre, apellido y cédula son obligatorios");
    }

    const placaNormalizada = (placaVisitante && placaVisitante.toUpperCase() !== 'N/A' && placaVisitante.trim() !== '')
        ? placaVisitante.toUpperCase()
        : null;

    const visitante = await Visitante.findOne({ _id: id, ...tenantFilter });
    if (!visitante) throw new Error("Visitante no encontrado");

    Object.assign(visitante, {
        nombre: nombreVisitante,
        apellido: apellidoVisitante,
        cedula: cedulaVisitante,
        placaVehiculo: placaNormalizada
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