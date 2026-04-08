/**
 * Servicio de Parqueaderos
 */
const Parqueadero = require("./parqueadero.model");
const HistorialAcceso = require("../../shared/models/historialAcceso");
const Visitante = require("../visitantes/visitante.model");
const Usuario = require("../usuarios/usuario.model");

const obtenerPlazas = async (tenantFilter) => {
    const plazas = await Parqueadero.find(tenantFilter).populate({
        path: "visitante",
        select: "nombre apellido placaVehiculo cedula"
    });

    return plazas.map(plaza => ({
        numero: plaza.numero,
        estado: plaza.estado,
        placa: plaza.visitante?.placaVehiculo || null,
        visitante: plaza.visitante ? `${plaza.visitante.nombre} ${plaza.visitante.apellido}` : null,
        _id: plaza._id
    }));
};

const asignarVisitante = async (visitanteId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ ...tenantFilter, estado: "DISPONIBLE" });
    if (!plaza) throw new Error("No hay plazas disponibles");

    plaza.estado = "EN_ESPERA";
    plaza.visitante = visitanteId;
    await plaza.save();

    return plaza;
};

const liberarPlaza = async (idPlaza, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: idPlaza, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o no pertenece a este conjunto");

    plaza.estado = "DISPONIBLE";
    plaza.visitante = null;
    await plaza.save();

    return plaza;
};

const registrarEntrada = async (codigoParqueadero, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ codigoQR: codigoParqueadero, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o no pertenece a tu conjunto");
    if (plaza.estado === "OCUPADO") throw new Error("Esta plaza ya está ocupada");

    plaza.estado = "OCUPADO";
    plaza.ultimaOcupacion = new Date();
    await plaza.save();

    const visitante = plaza.visitante || null;
    const nuevoAcceso = new HistorialAcceso({
        plazaId: plaza._id,
        visitanteId: visitante,
        conjunto: plaza.conjunto,
        tipo: 'ENTRADA',
        metodo: 'QR_SCAN',
        fechaHora: new Date()
    });
    await nuevoAcceso.save();

    return plaza;
};

const obtenerHistorial = async (tenantFilter) => {
    return await HistorialAcceso.find(tenantFilter)
        .populate('plazaId', 'numero')
        .populate('visitanteId', 'nombre apellido placaVehiculo')
        .sort({ fechaHora: -1 })
        .limit(50);
};

const registrarSalida = async (plazaId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada en este conjunto");
    if (plaza.estado === "DISPONIBLE") throw new Error("La plaza ya está libre");

    plaza.estado = "DISPONIBLE";
    const visitanteId = plaza.visitante;
    plaza.visitante = null;
    await plaza.save();

    const nuevoAcceso = new HistorialAcceso({
        plazaId: plaza._id,
        visitanteId: visitanteId,
        conjunto: plaza.conjunto,
        tipo: 'SALIDA',
        metodo: 'MANUAL',
        fechaHora: new Date()
    });
    await nuevoAcceso.save();

    return plaza;
};

const registrarAccesoVehicular = async (placa, tipo, tenantFilter, conjuntoId, usuarioLogueado) => {
    let residente = await Usuario.findOne({ ...tenantFilter, placaVehiculo: placa });
    let visitante = null;

    if (!residente) {
        visitante = await Visitante.findOne({ ...tenantFilter, placaVehiculo: placa, estado: 'activo' });
    }

    if (!residente && !visitante) {
        throw new Error("Vehículo no registrado o inactivo");
    }

    let accesoData = {
        tipo,
        fechaHora: new Date(),
        metodo: 'LPR_CAMERA',
        conjunto: conjuntoId,
        registradoPor: usuarioLogueado ? usuarioLogueado.id : null,
        placaManual: placa
    };

    if (residente) {
        accesoData.residenteId = residente._id;
    } else if (visitante) {
        accesoData.visitanteId = visitante._id;
    }

    const acceso = new HistorialAcceso(accesoData);
    await acceso.save();

    return {
        acceso,
        persona: residente ? `${residente.nombre} ${residente.apellido}` : `${visitante.nombre} ${visitante.apellido}`,
        rol: residente ? 'residente' : 'visitante'
    };
};

const crearPlazasConjunto = async (conjuntoId, cantidadParam) => {
    const cantidad = parseInt(cantidadParam);
    if (!cantidad || cantidad <= 0 || cantidad > 500) {
        throw new Error("Cantidad inválida. Debe ser un número entre 1 y 500");
    }

    const plazasExistentes = await Parqueadero.countDocuments({ conjunto: conjuntoId });
    if (plazasExistentes > 0) {
        throw new Error("El conjunto ya tiene parqueaderos inicializados");
    }

    const nuevasPlazas = [];
    for (let i = 1; i <= cantidad; i++) {
        nuevasPlazas.push({
            numero: `P-${i.toString().padStart(3, '0')}`,
            estado: 'DISPONIBLE',
            codigoQR: `QR-${conjuntoId}-P${i}-${Date.now()}`,
            conjunto: conjuntoId
        });
    }

    await Parqueadero.insertMany(nuevasPlazas);
    return cantidad;
};

const eliminarPlaza = async (plazaId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o sin permisos");

    await HistorialAcceso.deleteMany({ plazaId: plaza._id });
    await Parqueadero.findByIdAndDelete(plazaId);
    return plaza;
};

const editarPlaza = async (plazaId, nuevoNumero, nuevoEstado, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o sin permisos");

    if (nuevoNumero) {
        const existeNumero = await Parqueadero.findOne({
            numero: nuevoNumero,
            conjunto: plaza.conjunto,
            _id: { $ne: plazaId }
        });
        if (existeNumero) throw new Error("Ya existe otra plaza con ese número en el conjunto");
        plaza.numero = nuevoNumero;
    }

    if (nuevoEstado) {
        const estadosValidos = ["DISPONIBLE", "OCUPADO", "EN_ESPERA", "MANTENIMIENTO"];
        if (!estadosValidos.includes(nuevoEstado)) throw new Error("Estado inválido");
        plaza.estado = nuevoEstado;

        if (nuevoEstado === "DISPONIBLE" || nuevoEstado === "MANTENIMIENTO") {
            plaza.visitante = null;
        }
    }

    await plaza.save();
    return plaza;
};

const obtenerPlazasConjunto = async (conjuntoId) => {
    return await Parqueadero.find({ conjunto: conjuntoId }).sort({ numero: 1 });
};

module.exports = {
    obtenerPlazas,
    asignarVisitante,
    liberarPlaza,
    registrarEntrada,
    obtenerHistorial,
    registrarSalida,
    registrarAccesoVehicular,
    crearPlazasConjunto,
    eliminarPlaza,
    editarPlaza,
    obtenerPlazasConjunto
};