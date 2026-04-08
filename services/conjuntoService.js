const Conjunto = require('../models/conjunto');
const Usuario = require('../models/usuario');
const Parqueadero = require('../models/parqueadero');
const Visitante = require('../models/visitante');

const crearConjunto = async (datos) => {
    const { nombre, direccion, telefonos, planActual, modulosActivos, cantidadParqueaderos } = datos;
    const nuevoConjunto = new Conjunto({
        nombre,
        direccion,
        telefonos,
        planActual: planActual || 'basico',
        modulosActivos: modulosActivos || ['porteria', 'visitantes']
    });
    
    const conjuntoGuardado = await nuevoConjunto.save();
    
    // Si se especificó una cantidad de parqueaderos, crearlos automáticamente
    if (cantidadParqueaderos && !isNaN(cantidadParqueaderos) && Number(cantidadParqueaderos) > 0) {
        let n = parseInt(cantidadParqueaderos);
        const parqueaderosPromises = [];
        for (let i = 1; i <= n; i++) {
            parqueaderosPromises.push(new Parqueadero({
                conjunto: conjuntoGuardado._id,
                numero: `P-${i}`,
                estado: "DISPONIBLE"
            }).save());
        }
        await Promise.all(parqueaderosPromises);
    }
    
    return conjuntoGuardado;
};

const obtenerConjuntos = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.estado) filter.estado = query.estado;
    if (query.busqueda) {
        filter.nombre = { $regex: query.busqueda, $options: 'i' };
    }

    const conjuntos = await Conjunto.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Conjunto.countDocuments(filter);

    return {
        conjuntos,
        paginacion: {
            total,
            paginaActual: page,
            totalPaginas: Math.ceil(total / limit)
        }
    };
};

const obtenerConjuntoPorId = async (id) => {
    const conjunto = await Conjunto.findById(id);
    if (!conjunto) throw new Error("Conjunto no encontrado");
    return conjunto;
};

const actualizarConjunto = async (id, datos) => {
    const { nombre, direccion, telefonos, emailContacto, modulosActivos } = datos;
    const conjunto = await Conjunto.findById(id);
    if (!conjunto) throw new Error("Conjunto no encontrado");

    if (nombre) conjunto.nombre = nombre;
    if (direccion) conjunto.direccion = direccion;
    if (telefonos && Array.isArray(telefonos)) conjunto.telefonos = telefonos;
    if (emailContacto) conjunto.emailContacto = emailContacto;
    if (modulosActivos && Array.isArray(modulosActivos)) conjunto.modulosActivos = modulosActivos;

    return await conjunto.save();
};

const eliminarConjunto = async (id) => {
    const conjunto = await Conjunto.findById(id);
    if (!conjunto) throw new Error("Conjunto no encontrado");
    
    conjunto.estado = 'inactivo';
    return await conjunto.save();
};

const obtenerEstadisticasGlobales = async () => {
    const totalConjuntos = await Conjunto.countDocuments();
    const conjuntosActivos = await Conjunto.countDocuments({ estado: 'activo' });
    const totalUsuarios = await Usuario.countDocuments();
    const totalVisitantes = await Visitante.countDocuments();

    const conjuntosPorPlan = await Conjunto.aggregate([
        { $group: { _id: "$planActual", count: { $sum: 1 } } }
    ]);

    return {
        totalConjuntos,
        conjuntosActivos,
        totalUsuarios,
        totalVisitantes,
        conjuntosPorPlan
    };
};

const listarConjuntosParaSelector = async () => {
    return await Conjunto.find({ estado: 'activo' })
        .select('nombre direccion _id')
        .sort({ nombre: 1 });
};

const actualizarPlan = async (id, planActual) => {
    const conjunto = await Conjunto.findById(id);
    if (!conjunto) throw new Error("Conjunto no encontrado");

    const planesValidos = ['basico', 'estandar', 'premium', 'enterprise'];
    if (!planesValidos.includes(planActual)) {
        throw new Error("Plan no válido");
    }

    conjunto.planActual = planActual;
    return await conjunto.save();
};

module.exports = {
    crearConjunto,
    obtenerConjuntos,
    obtenerConjuntoPorId,
    actualizarConjunto,
    eliminarConjunto,
    obtenerEstadisticasGlobales,
    listarConjuntosParaSelector,
    actualizarPlan
};
