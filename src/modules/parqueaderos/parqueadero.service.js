/**
 * Servicio de Parqueaderos
 */
const Parqueadero = require("./parqueadero.model");
const HistorialAcceso = require("../../shared/models/historialAcceso");
const Visitante = require("../visitantes/visitante.model");
const Usuario = require("../usuarios/usuario.model");
const Conjunto = require("../conjuntos/conjunto.model");

const obtenerPlazas = async (tenantFilter, filtrosAdicionales = {}) => {
    const query = { ...tenantFilter, ...filtrosAdicionales };

    const plazas = await Parqueadero.find(query)
        .populate({
            path: "visitante",
            select: "nombre apellido placaVehiculo cedula"
        })
        .populate({
            path: "residenteAsignado",
            select: "nombre apellido placaVehiculo"
        });

    return plazas.map(plaza => ({
        _id: plaza._id,
        numero: plaza.numero,
        estado: plaza.estado,
        categoria: plaza.categoria,
        tipoVehiculo: plaza.tipoVehiculo,
        placa: plaza.placaVehiculo || plaza.visitante?.placaVehiculo || null,
        visitante: plaza.visitante ? `${plaza.visitante.nombre} ${plaza.visitante.apellido}` : null,
        residenteAsignado: plaza.residenteAsignado ? {
            _id: plaza.residenteAsignado._id,
            nombre: `${plaza.residenteAsignado.nombre} ${plaza.residenteAsignado.apellido}`,
            placa: plaza.residenteAsignado.placaVehiculo
        } : null
    }));
};

// Obtener estadísticas de parqueaderos por categoría
const obtenerEstadisticas = async (tenantFilter) => {
    const plazas = await Parqueadero.find(tenantFilter);

    const stats = {
        total: plazas.length,
        disponibles: plazas.filter(p => p.estado === "DISPONIBLE").length,
        ocupados: plazas.filter(p => p.estado === "OCUPADO").length,
        porCategoria: {
            privado: {
                carro: { total: 0, disponibles: 0 },
                moto: { total: 0, disponibles: 0 }
            },
            visitante: {
                carro: { total: 0, disponibles: 0 },
                moto: { total: 0, disponibles: 0 }
            }
        },
        tiempoExcedido: []  // Parqueaderos de visitantes con tiempo excedido
    };

    plazas.forEach(p => {
        // Mapear categorías a minúsculas para las estadísticas
        const cat = p.categoria === "PRIVADO" ? "privado" :
                    p.categoria === "VISITANTE" ? "visitante" :
                    p.categoria.toLowerCase();
        const tipo = p.tipoVehiculo.toLowerCase();

        if (stats.porCategoria[cat] && stats.porCategoria[cat][tipo]) {
            stats.porCategoria[cat][tipo].total++;
            if (p.estado === "DISPONIBLE") {
                stats.porCategoria[cat][tipo].disponibles++;
            }
        }

        // Verificar tiempo excedido en visitantes
        if (p.categoria === "VISITANTE" && p.estado === "OCUPADO" && p.horaEntrada && p.tiempoMaximoHoras) {
            const horasTranscurridas = (Date.now() - new Date(p.horaEntrada).getTime()) / (1000 * 60 * 60);
            if (horasTranscurridas > p.tiempoMaximoHoras) {
                stats.tiempoExcedido.push({
                    numero: p.numero,
                    placa: p.placaVehiculo,
                    horasExcedidas: Math.round(horasTranscurridas - p.tiempoMaximoHoras)
                });
            }
        }
    });

    return stats;
};

// Asignar parqueadero a visitante (filtrando por tipo de vehículo)
const asignarVisitante = async (visitanteId, tipoVehiculo = "CARRO", tenantFilter) => {
    const plaza = await Parqueadero.findOne({
        ...tenantFilter,
        estado: "DISPONIBLE",
        categoria: "VISITANTE",
        tipoVehiculo: tipoVehiculo
    });

    if (!plaza) {
        const alternativos = await Parqueadero.countDocuments({
            ...tenantFilter,
            estado: "DISPONIBLE",
            categoria: "VISITANTE"
        });

        if (alternativos > 0) {
            throw new Error(`No hay parqueaderos disponibles para ${tipoVehiculo.toLowerCase()}. Hay ${alternativos} cupo(s) de otro tipo.`);
        }
        throw new Error("No hay parqueaderos disponibles para visitantes");
    }

    // RESERVADO: plaza apartada para el visitante (aún no ocupada físicamente).
    // Es un valor real del enum del schema y la UI (Plaza.jsx) ya lo representa.
    plaza.estado = "RESERVADO";
    plaza.visitante = visitanteId;
    await plaza.save();

    return plaza;
};

// Asignar parqueadero permanentemente a un residente
const asignarResidente = async (plazaId, residenteId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Parqueadero no encontrado");

    if (plaza.categoria !== "PRIVADO") {
        throw new Error("Solo se pueden asignar parqueaderos de categoría PRIVADO");
    }

    if (plaza.estado !== "DISPONIBLE") {
        throw new Error("El parqueadero no está disponible");
    }

    // Verificar que el residente no tenga ya un parqueadero asignado
    const residenteExistente = await Parqueadero.findOne({
        ...tenantFilter,
        residenteAsignado: residenteId
    });
    if (residenteExistente) {
        throw new Error("El residente ya tiene un parqueadero asignado");
    }

    // Verificar que el residente existe y pertenece al conjunto
    const residente = await Usuario.findOne({ _id: residenteId, ...tenantFilter });
    if (!residente) {
        throw new Error("Residente no encontrado en este conjunto");
    }

    plaza.residenteAsignado = residenteId;
    plaza.estado = "OCUPADO";
    await plaza.save();

    return plaza.populate("residenteAsignado", "nombre apellido placaVehiculo");
};

// Liberar plaza (para visitantes o residentes que se mudan)
const liberarPlaza = async (idPlaza, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: idPlaza, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o no pertenece a este conjunto");

    plaza.estado = "DISPONIBLE";
    plaza.visitante = null;
    plaza.placaVehiculo = null;

    // Si es de residente (PRIVADO), mantener la asignación pero marcar como disponible
    // (el residente sigue teniendo el cupo reservado)
    if (plaza.categoria !== "PRIVADO") {
        plaza.residenteAsignado = null;
    }

    await plaza.save();
    return plaza;
};

// Entrada por cámara/LPR: se identifica el visitante por visitanteId y se marca
// OCUPADA su plaza (si tiene). Registra el acceso en historial con el shape real.
const registrarEntrada = async ({ visitanteId, placa }, tenantFilter) => {
    let plaza = null;
    if (visitanteId) {
        plaza = await Parqueadero.findOne({ visitante: visitanteId, ...tenantFilter });
    }

    let nombreUsuario = 'Desconocido';
    if (visitanteId) {
        const visitanteDoc = await Visitante.findById(visitanteId);
        if (visitanteDoc) nombreUsuario = `${visitanteDoc.nombre} ${visitanteDoc.apellido}`;
    }

    if (plaza) {
        plaza.estado = "OCUPADO";
        await plaza.save();
    }

    const nuevoAcceso = new HistorialAcceso({
        conjunto: tenantFilter.conjunto,
        placa: placa || (plaza && plaza.placaVehiculo) || 'DESCONOCIDA',
        tipoAcceso: 'entrada',
        tipoUsuario: 'visitante',
        nombreUsuario,
        plaza: plaza ? plaza.numero : null,
        fechaHora: new Date()
    });
    await nuevoAcceso.save();

    return plaza || { numero: null };
};

// Buscar la plaza que un visitante ocupa actualmente (para registrar su salida).
const buscarPlazaOcupadaPorVisitante = async (visitanteId, tenantFilter) => {
    return Parqueadero.findOne({ visitante: visitanteId, ...tenantFilter });
};

const obtenerHistorial = async (tenantFilter, opciones = {}) => {
    const {
        fechaInicio,
        fechaFin,
        tipoAcceso,
        tipoUsuario,
        placa,
        conjunto,
        page = 1,
        limit = 50
    } = opciones;

    const filtro = { ...tenantFilter };

    if (fechaInicio || fechaFin) {
        filtro.fechaHora = {};
        if (fechaInicio) filtro.fechaHora.$gte = new Date(fechaInicio);
        if (fechaFin) {
            const fin = new Date(fechaFin);
            fin.setHours(23, 59, 59, 999);
            filtro.fechaHora.$lte = fin;
        }
    }
    if (tipoAcceso) filtro.tipoAcceso = tipoAcceso;
    if (tipoUsuario) filtro.tipoUsuario = tipoUsuario;
    if (placa) filtro.placa = { $regex: placa.toUpperCase(), $options: 'i' };
    if (conjunto) filtro.conjunto = conjunto;

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const lim = Math.min(200, parseInt(limit));

    const [items, total] = await Promise.all([
        HistorialAcceso.find(filtro)
            .populate('conjunto', 'nombre')
            .sort({ fechaHora: -1 })
            .skip(skip)
            .limit(lim)
            .lean(),
        HistorialAcceso.countDocuments(filtro)
    ]);

    return {
        items,
        total,
        page: parseInt(page),
        limit: lim,
        totalPages: Math.ceil(total / lim)
    };
};

const obtenerEstadisticasHistorial = async (tenantFilter, opciones = {}) => {
    const { fechaInicio, fechaFin, conjunto } = opciones;
    const filtro = { ...tenantFilter };

    if (fechaInicio || fechaFin) {
        filtro.fechaHora = {};
        if (fechaInicio) filtro.fechaHora.$gte = new Date(fechaInicio);
        if (fechaFin) {
            const fin = new Date(fechaFin);
            fin.setHours(23, 59, 59, 999);
            filtro.fechaHora.$lte = fin;
        }
    }
    if (conjunto) filtro.conjunto = conjunto;

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const filtroHoy = { ...filtro, fechaHora: { ...(filtro.fechaHora || {}), $gte: inicioHoy } };

    const [total, entradas, salidas, residentes, visitantes, hoy, entradasHoy, salidasHoy] = await Promise.all([
        HistorialAcceso.countDocuments(filtro),
        HistorialAcceso.countDocuments({ ...filtro, tipoAcceso: 'entrada' }),
        HistorialAcceso.countDocuments({ ...filtro, tipoAcceso: 'salida' }),
        HistorialAcceso.countDocuments({ ...filtro, tipoUsuario: 'residente' }),
        HistorialAcceso.countDocuments({ ...filtro, tipoUsuario: 'visitante' }),
        HistorialAcceso.countDocuments(filtroHoy),
        HistorialAcceso.countDocuments({ ...filtroHoy, tipoAcceso: 'entrada' }),
        HistorialAcceso.countDocuments({ ...filtroHoy, tipoAcceso: 'salida' })
    ]);

    return { total, entradas, salidas, residentes, visitantes, hoy, entradasHoy, salidasHoy };
};

const registrarSalida = async (plazaId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada en este conjunto");
    if (plaza.estado === "DISPONIBLE") throw new Error("La plaza ya está libre");

    let nombreUsuario = 'Desconocido';
    if (plaza.visitante) {
        const visitanteDoc = await Visitante.findById(plaza.visitante);
        if (visitanteDoc) nombreUsuario = `${visitanteDoc.nombre} ${visitanteDoc.apellido}`;
    }
    const placaSalida = plaza.placaVehiculo;

    plaza.estado = plaza.residenteAsignado ? "OCUPADO" : "DISPONIBLE"; // Residente: queda reservado
    plaza.visitante = null;
    plaza.placaVehiculo = null;
    await plaza.save();

    const nuevoAcceso = new HistorialAcceso({
        conjunto: plaza.conjunto,
        placa: placaSalida || 'DESCONOCIDA',
        tipoAcceso: 'salida',
        tipoUsuario: 'visitante',
        nombreUsuario,
        plaza: plaza.numero,
        fechaHora: new Date()
    });
    await nuevoAcceso.save();

    return plaza;
};

const registrarAccesoVehicular = async (placa, tipo, tenantFilter, conjuntoId, usuarioLogueado) => {
    let residente = await Usuario.findOne({ ...tenantFilter, placaVehiculo: placa });
    let visitante = null;

    if (!residente) {
        // Solo visitantes vigentes (aún no salieron) pueden auto-registrar acceso por placa.
        visitante = await Visitante.findOne({
            ...tenantFilter,
            placaVehiculo: placa,
            estado: { $in: ['pendiente', 'ingresado'] }
        });
    }

    if (!residente && !visitante) {
        throw new Error("Vehículo no registrado o inactivo");
    }

    const persona = residente || visitante;
    const nombreUsuario = `${persona.nombre} ${persona.apellido}`;
    const tipoUsuario = residente ? 'residente' : 'visitante';

    const acceso = new HistorialAcceso({
        conjunto: conjuntoId,
        placa,
        tipoAcceso: tipo,
        tipoUsuario,
        nombreUsuario,
        fechaHora: new Date()
    });
    await acceso.save();

    return { acceso, persona: nombreUsuario, rol: tipoUsuario };
};

// Crear parqueaderos con distribución por categoría
const crearPlazasConjunto = async (conjuntoId, configuracion = null) => {
    const plazasExistentes = await Parqueadero.countDocuments({ conjunto: conjuntoId });
    if (plazasExistentes > 0) {
        throw new Error("El conjunto ya tiene parqueaderos inicializados");
    }

    // Configuración por defecto
    // Si se pasa 'apartamentos', se crean parqueaderos privados por cada uno
    // Si no, se usa la distribución manual
    let config = configuracion || {
        privadoCarro: 0,
        privadoMoto: 0,
        visitanteCarro: 6,
        visitanteMoto: 2,
        apartamentos: null
    };

    const nuevasPlazas = [];

    // Si hay apartamentos definidos, crear parqueaderos privados para cada uno
    if (config.apartamentos && Array.isArray(config.apartamentos)) {
        // config.apartamentos = [{ torre: 'A', apartamento: '101', tipoVehiculo: 'CARRO' }, ...]
        config.apartamentos.forEach((apt, index) => {
            nuevasPlazas.push({
                numero: `${apt.torre}-${apt.apartamento}`,
                estado: 'DISPONIBLE',
                categoria: 'PRIVADO',
                tipoVehiculo: apt.tipoVehiculo || 'CARRO',
                torre: apt.torre,
                apartamento: apt.apartamento,
                conjunto: conjuntoId
            });
        });

        // Agregar parqueaderos de visitantes
        for (let i = 0; i < (config.visitanteCarro || 0); i++) {
            nuevasPlazas.push({
                numero: `V-C-${(i + 1).toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'VISITANTE',
                tipoVehiculo: 'CARRO',
                tiempoMaximoHoras: config.tiempoMaximoHoras || 8,
                conjunto: conjuntoId
            });
        }
        for (let i = 0; i < (config.visitanteMoto || 0); i++) {
            nuevasPlazas.push({
                numero: `V-M-${(i + 1).toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'VISITANTE',
                tipoVehiculo: 'MOTO',
                tiempoMaximoHoras: config.tiempoMaximoHoras || 8,
                conjunto: conjuntoId
            });
        }
    } else {
        // Modo manual: crear según cantidades especificadas
        let contador = 1;

        // Parqueaderos privados para carros
        for (let i = 0; i < (config.privadoCarro || 0); i++) {
            nuevasPlazas.push({
                numero: `P-C-${contador.toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'PRIVADO',
                tipoVehiculo: 'CARRO',
                conjunto: conjuntoId
            });
            contador++;
        }

        // Parqueaderos privados para motos
        for (let i = 0; i < (config.privadoMoto || 0); i++) {
            nuevasPlazas.push({
                numero: `P-M-${contador.toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'PRIVADO',
                tipoVehiculo: 'MOTO',
                conjunto: conjuntoId
            });
            contador++;
        }

        // Parqueaderos de visitantes para carros
        for (let i = 0; i < (config.visitanteCarro || 0); i++) {
            nuevasPlazas.push({
                numero: `V-C-${contador.toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'VISITANTE',
                tipoVehiculo: 'CARRO',
                tiempoMaximoHoras: config.tiempoMaximoHoras || 8,
                conjunto: conjuntoId
            });
            contador++;
        }

        // Parqueaderos de visitantes para motos
        for (let i = 0; i < (config.visitanteMoto || 0); i++) {
            nuevasPlazas.push({
                numero: `V-M-${contador.toString().padStart(2, '0')}`,
                estado: 'DISPONIBLE',
                categoria: 'VISITANTE',
                tipoVehiculo: 'MOTO',
                tiempoMaximoHoras: config.tiempoMaximoHoras || 8,
                conjunto: conjuntoId
            });
            contador++;
        }
    }

    const total = nuevasPlazas.length;
    if (total > 500) {
        throw new Error("El total de parqueaderos no puede exceder 500");
    }

    await Parqueadero.insertMany(nuevasPlazas);

    return {
        total,
        privados: nuevasPlazas.filter(p => p.categoria === 'PRIVADO').length,
        visitantes: nuevasPlazas.filter(p => p.categoria === 'VISITANTE').length,
        distribucion: config
    };
};

const eliminarPlaza = async (plazaId, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o sin permisos");

    await HistorialAcceso.deleteMany({ plazaId: plaza._id });
    await Parqueadero.findByIdAndDelete(plazaId);
    return plaza;
};

// Borrar todos los parqueaderos de un conjunto (operación destructiva)
const eliminarTodasLasPlazasDeConjunto = async (conjuntoId) => {
    if (!conjuntoId) throw new Error("conjuntoId requerido");

    const ids = await Parqueadero.find({ conjunto: conjuntoId }).distinct('_id');
    if (ids.length === 0) {
        return { eliminadas: 0, mensaje: "El conjunto no tenía parqueaderos" };
    }

    // Limpiar referencias en visitantes (parqueadero asignado)
    const Visitante = require("../visitantes/visitante.model");
    await Visitante.updateMany(
        { parqueadero: { $in: ids } },
        { $set: { parqueadero: null } }
    );

    // Limpiar referencias en usuarios (parqueaderoAsignado)
    const Usuario = require("../usuarios/usuario.model");
    await Usuario.updateMany(
        { parqueaderoAsignado: { $in: ids } },
        { $set: { parqueaderoAsignado: null } }
    );

    const resultado = await Parqueadero.deleteMany({ conjunto: conjuntoId });
    return {
        eliminadas: resultado.deletedCount,
        mensaje: `Se eliminaron ${resultado.deletedCount} plazas del conjunto`
    };
};

const editarPlaza = async (plazaId, datosActualizacion, tenantFilter) => {
    const plaza = await Parqueadero.findOne({ _id: plazaId, ...tenantFilter });
    if (!plaza) throw new Error("Plaza no encontrada o sin permisos");

    const { numero, estado, categoria, tipoVehiculo, residenteAsignado } = datosActualizacion;

    if (numero) {
        const existeNumero = await Parqueadero.findOne({
            numero: numero,
            conjunto: plaza.conjunto,
            _id: { $ne: plazaId }
        });
        if (existeNumero) throw new Error("Ya existe otra plaza con ese número en el conjunto");
        plaza.numero = numero;
    }

    if (estado) {
        const estadosValidos = ["DISPONIBLE", "OCUPADO", "RESERVADO"];
        if (!estadosValidos.includes(estado)) throw new Error("Estado inválido");
        plaza.estado = estado;

        if (estado === "DISPONIBLE") {
            plaza.visitante = null;
            plaza.placaVehiculo = null;
        }
    }

    if (categoria) {
        if (!["PRIVADO", "VISITANTE"].includes(categoria)) {
            throw new Error("Categoría inválida. Use PRIVADO o VISITANTE");
        }
        plaza.categoria = categoria;
    }

    if (tipoVehiculo) {
        if (!["CARRO", "MOTO"].includes(tipoVehiculo)) {
            throw new Error("Tipo de vehículo inválido");
        }
        plaza.tipoVehiculo = tipoVehiculo;
    }

    if (residenteAsignado !== undefined) {
        plaza.residenteAsignado = residenteAsignado;
    }

    await plaza.save();
    return plaza.populate("residenteAsignado", "nombre apellido placaVehiculo");
};

const obtenerPlazasConjunto = async (conjuntoId) => {
    return await Parqueadero.find({ conjunto: conjuntoId })
        .populate("residenteAsignado", "nombre apellido placaVehiculo")
        .sort({ categoria: 1, tipoVehiculo: 1, numero: 1 });
};

// Asignar parqueadero automáticamente por apartamento
const asignarParqueaderoApartamento = async (usuarioId, tenantFilter) => {
    const Usuario = require('../usuarios/usuario.model');

    const usuario = await Usuario.findOne({ _id: usuarioId, ...tenantFilter });
    if (!usuario) {
        throw new Error("Usuario no encontrado");
    }

    if (usuario.rol !== 'residente') {
        throw new Error("Solo los residentes pueden tener parqueadero asignado");
    }

    if (!usuario.torre || !usuario.apartamento) {
        throw new Error("El residente debe tener torre y apartamento asignados");
    }

    // Verificar si ya tiene parqueadero asignado
    if (usuario.parqueaderoAsignado) {
        const existente = await Parqueadero.findById(usuario.parqueaderoAsignado);
        if (existente) {
            return { parqueadero: existente, mensaje: "Ya tiene parqueadero asignado" };
        }
    }

    // Determinar tipo de vehículo según la placa
    let tipoVehiculo = 'CARRO';
    if (usuario.tieneVehiculo && usuario.placaVehiculo) {
        const placaUpper = usuario.placaVehiculo.toUpperCase();
        if (placaUpper.length <= 5 || /^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(placaUpper)) {
            tipoVehiculo = 'MOTO';
        }
    }

    // Buscar parqueadero privado disponible del tipo correspondiente
    let parqueadero = await Parqueadero.findOne({
        ...tenantFilter,
        categoria: 'PRIVADO',
        tipoVehiculo: tipoVehiculo,
        estado: 'DISPONIBLE',
        torre: usuario.torre,
        apartamento: usuario.apartamento,
        residenteAsignado: null
    });

    // Si no hay del tipo específico para el apartamento, buscar cualquiera del apartamento
    if (!parqueadero) {
        parqueadero = await Parqueadero.findOne({
            ...tenantFilter,
            categoria: 'PRIVADO',
            estado: 'DISPONIBLE',
            torre: usuario.torre,
            apartamento: usuario.apartamento,
            residenteAsignado: null
        });
    }

    // Si no hay para el apartamento, buscar cualquiera privado disponible
    if (!parqueadero) {
        parqueadero = await Parqueadero.findOne({
            ...tenantFilter,
            categoria: 'PRIVADO',
            estado: 'DISPONIBLE',
            residenteAsignado: null
        });
    }

    if (!parqueadero) {
        throw new Error(`No hay parqueaderos privados disponibles (${tipoVehiculo})`);
    }

    // Asignar parqueadero al residente
    parqueadero.residenteAsignado = usuarioId;
    parqueadero.torre = usuario.torre;
    parqueadero.apartamento = usuario.apartamento;
    parqueadero.estado = 'OCUPADO';
    await parqueadero.save();

    // Actualizar usuario
    usuario.parqueaderoAsignado = parqueadero._id;
    await usuario.save();

    return {
        parqueadero: await parqueadero.populate("residenteAsignado", "nombre apellido placaVehiculo"),
        usuario: usuario,
        mensaje: `Parqueadero ${parqueadero.numero} asignado al apartamento ${usuario.torre}-${usuario.apartamento}`
    };
};

// Liberar parqueadero de un residente (cuando se muda o cambia)
const liberarParqueaderoResidente = async (usuarioId, tenantFilter) => {
    const Usuario = require('../usuarios/usuario.model');

    const usuario = await Usuario.findOne({ _id: usuarioId, ...tenantFilter });
    if (!usuario) {
        throw new Error("Usuario no encontrado");
    }

    if (!usuario.parqueaderoAsignado) {
        return { mensaje: "El residente no tiene parqueadero asignado" };
    }

    const parqueadero = await Parqueadero.findOne({
        _id: usuario.parqueaderoAsignado,
        ...tenantFilter
    });

    if (parqueadero) {
        parqueadero.residenteAsignado = null;
        parqueadero.torre = null;
        parqueadero.apartamento = null;
        parqueadero.estado = 'DISPONIBLE';
        parqueadero.placaVehiculo = null;
        await parqueadero.save();
    }

    usuario.parqueaderoAsignado = null;
    await usuario.save();

    return { parqueadero, mensaje: "Parqueadero liberado" };
};

// Obtener parqueadero por apartamento
const obtenerParqueaderoPorApartamento = async (torre, apartamento, tenantFilter) => {
    return await Parqueadero.findOne({
        ...tenantFilter,
        torre: torre,
        apartamento: apartamento
    }).populate("residenteAsignado", "nombre apellido placaVehiculo");
};

// Crear parqueaderos con configuración de torres/pisos/apartamentos
const crearPlazasConfiguracion = async (conjuntoId, config) => {
    const plazasExistentes = await Parqueadero.countDocuments({ conjunto: conjuntoId });
    if (plazasExistentes > 0) {
        throw new Error("El conjunto ya tiene parqueaderos inicializados");
    }

    // Configuración por defecto para 10 torres, 10 pisos, 2 aptos por piso
    const {
        torres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        pisos = 10,
        apartamentosPorPiso = 2,
        residenteMoto = 0,        // Cantidad de plazas de moto para residentes (rotativas)
        visitanteCarro = 20,
        visitanteMoto = 10,
        tiempoMaximoHoras = 8
    } = config;

    const nuevasPlazas = [];

    // Crear parqueaderos privados (CARRO) por cada apartamento
    for (const torre of torres) {
        for (let piso = 1; piso <= pisos; piso++) {
            for (let apto = 1; apto <= apartamentosPorPiso; apto++) {
                // Número de apartamento: primer dígito = piso, segundo = apto
                const numeroApartamento = `${piso}0${apto}`;
                const numeroParqueadero = `${torre}-${numeroApartamento}`;

                nuevasPlazas.push({
                    numero: numeroParqueadero,
                    estado: 'DISPONIBLE',
                    categoria: 'PRIVADO',
                    tipoVehiculo: 'CARRO',
                    torre: torre,
                    apartamento: numeroApartamento,
                    conjunto: conjuntoId
                });
            }
        }
    }

    // Crear plazas de MOTO para residentes (no van asociadas a un apto específico,
    // se asignan después al residente que tenga moto)
    for (let i = 1; i <= residenteMoto; i++) {
        nuevasPlazas.push({
            numero: `R-M-${i.toString().padStart(3, '0')}`,
            estado: 'DISPONIBLE',
            categoria: 'PRIVADO',
            tipoVehiculo: 'MOTO',
            conjunto: conjuntoId
        });
    }

    // Crear parqueaderos de visitantes para carros
    for (let i = 1; i <= visitanteCarro; i++) {
        nuevasPlazas.push({
            numero: `V-C-${i.toString().padStart(3, '0')}`,
            estado: 'DISPONIBLE',
            categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO',
            tiempoMaximoHoras: tiempoMaximoHoras,
            conjunto: conjuntoId
        });
    }

    // Crear parqueaderos de visitantes para motos
    for (let i = 1; i <= visitanteMoto; i++) {
        nuevasPlazas.push({
            numero: `V-M-${i.toString().padStart(3, '0')}`,
            estado: 'DISPONIBLE',
            categoria: 'VISITANTE',
            tipoVehiculo: 'MOTO',
            tiempoMaximoHoras: tiempoMaximoHoras,
            conjunto: conjuntoId
        });
    }

    const total = nuevasPlazas.length;
    if (total > 1000) {
        throw new Error("El total de parqueaderos no puede exceder 1000");
    }

    await Parqueadero.insertMany(nuevasPlazas);

    const privados = nuevasPlazas.filter(p => p.categoria === 'PRIVADO').length;
    const visitantes = nuevasPlazas.filter(p => p.categoria === 'VISITANTE').length;

    return {
        total,
        privados,
        visitantes,
        torres: torres.length,
        pisos,
        apartamentosPorPiso,
        visitanteCarro,
        visitanteMoto,
        mensaje: `Creados ${privados} parqueaderos privados (${torres.length} torres × ${pisos} pisos × ${apartamentosPorPiso} aptos) y ${visitantes} de visitantes`
    };
};

// Obtener parqueaderos agrupados por torre (compatibilidad)
// y tambien agrupados por conjunto con desglose carro/moto
const obtenerParqueaderosPorTorre = async (tenantFilter) => {
    const parqueaderos = await Parqueadero.find(tenantFilter)
        .populate("residenteAsignado", "nombre apellido placaVehiculo torre apartamento")
        .populate("conjunto", "nombre")
        .sort({ categoria: 1, torre: 1, apartamento: 1, numero: 1 });

    // ===== Estructura legacy (todos los conjuntos juntos) =====
    const privados = parqueaderos.filter(p => p.categoria === 'PRIVADO');
    const visitantesCarro = parqueaderos.filter(p => p.categoria === 'VISITANTE' && p.tipoVehiculo === 'CARRO');
    const visitantesMoto = parqueaderos.filter(p => p.categoria === 'VISITANTE' && p.tipoVehiculo === 'MOTO');
    const privadosCarro = privados.filter(p => p.tipoVehiculo === 'CARRO');
    const privadosMoto = privados.filter(p => p.tipoVehiculo === 'MOTO');

    const porTorre = {};
    const torres = [...new Set(privados.map(p => p.torre).filter(Boolean))].sort();
    for (const torre of torres) {
        porTorre[torre] = privados
            .filter(p => p.torre === torre)
            .sort((a, b) => (a.apartamento || '').localeCompare(b.apartamento || ''));
    }

    // ===== Agrupación por conjunto =====
    // Primero inicializamos TODOS los conjuntos activos (aunque no tengan parqueaderos)
    // para que el frontend pueda mostrarlos como "0 plazas" en vez de ocultarlos.
    const conjuntosMap = {};

    // Si el tenantFilter restringe a un conjunto específico, solo traemos ese.
    // Si no hay filtro (superadmin), traemos todos los activos.
    const filtroConjuntos = { estado: 'activo' };
    if (tenantFilter && tenantFilter.conjunto) {
        filtroConjuntos._id = tenantFilter.conjunto;
    }
    const conjuntosActivos = await Conjunto.find(filtroConjuntos)
        .select('_id nombre')
        .lean();

    for (const c of conjuntosActivos) {
        const cId = c._id.toString();
        conjuntosMap[cId] = {
            _id: cId,
            nombre: c.nombre,
            privadosCarro: [],
            privadosMoto: [],
            visitantesCarro: [],
            visitantesMoto: []
        };
    }

    // Ahora llenamos con los parqueaderos existentes
    for (const p of parqueaderos) {
        const cId = p.conjunto?._id?.toString() || 'sin-conjunto';
        if (!conjuntosMap[cId]) {
            conjuntosMap[cId] = {
                _id: cId,
                nombre: p.conjunto?.nombre || 'Sin conjunto',
                privadosCarro: [],
                privadosMoto: [],
                visitantesCarro: [],
                visitantesMoto: []
            };
        }
        if (p.categoria === 'PRIVADO' && p.tipoVehiculo === 'CARRO') conjuntosMap[cId].privadosCarro.push(p);
        else if (p.categoria === 'PRIVADO' && p.tipoVehiculo === 'MOTO') conjuntosMap[cId].privadosMoto.push(p);
        else if (p.categoria === 'VISITANTE' && p.tipoVehiculo === 'CARRO') conjuntosMap[cId].visitantesCarro.push(p);
        else if (p.categoria === 'VISITANTE' && p.tipoVehiculo === 'MOTO') conjuntosMap[cId].visitantesMoto.push(p);
    }
    const conjuntos = Object.values(conjuntosMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
        porTorre,
        torres,
        privadosCarro,
        privadosMoto,
        visitantesCarro,
        visitantesMoto,
        conjuntos
    };
};

module.exports = {
    obtenerPlazas,
    obtenerEstadisticas,
    asignarVisitante,
    asignarResidente,
    liberarPlaza,
    registrarEntrada,
    buscarPlazaOcupadaPorVisitante,
    obtenerHistorial,
    obtenerEstadisticasHistorial,
    registrarSalida,
    registrarAccesoVehicular,
    crearPlazasConjunto,
    crearPlazasConfiguracion,
    eliminarPlaza,
    eliminarTodasLasPlazasDeConjunto,
    editarPlaza,
    obtenerPlazasConjunto,
    asignarParqueaderoApartamento,
    liberarParqueaderoResidente,
    obtenerParqueaderoPorApartamento,
    obtenerParqueaderosPorTorre
};