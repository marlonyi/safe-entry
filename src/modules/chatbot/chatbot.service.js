const process = require("process");
const Groq = require("groq-sdk");

const HistorialAcceso = require("../../shared/models/historialAcceso");
const Visitante = require("../visitantes/visitante.model");
const Usuario = require("../usuarios/usuario.model");
const Parqueadero = require("../parqueaderos/parqueadero.model");
const Conjunto = require("../../../models/conjunto");
const { escaparRegex } = require("../../shared/utils/regexHelper");

// ===== Definicion de herramientas (tool schemas) =====
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'buscarPorPlaca',
            description: 'Busca informacion de una placa de vehiculo: si pertenece a residente o visitante, sus ultimos accesos y datos asociados.',
            parameters: {
                type: 'object',
                properties: {
                    placa: { type: 'string', description: 'Placa a buscar (ej: ABC123)' }
                },
                required: ['placa']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscarResidente',
            description: 'Busca residentes por nombre, apellido, cedula, apartamento o torre. Devuelve lista con datos clave.',
            parameters: {
                type: 'object',
                properties: {
                    nombre: { type: 'string', description: 'Nombre o apellido (parcial)' },
                    cedula: { type: 'string', description: 'Cedula exacta o parcial' },
                    apartamento: { type: 'string', description: 'Numero de apartamento' },
                    torre: { type: 'string', description: 'Letra/codigo de torre (A, B, C, D)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscarVisitante',
            description: 'Busca visitantes registrados por nombre, cedula o placa.',
            parameters: {
                type: 'object',
                properties: {
                    nombre: { type: 'string' },
                    cedula: { type: 'string' },
                    placa: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'listarVisitantesPendientes',
            description: 'Lista los visitantes con estado pendiente (aun no han ingresado).',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'listarResidentesEnMora',
            description: 'Lista los residentes con estado de expensa "en mora".',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'accesosEnRango',
            description: 'Obtiene accesos en un rango de fechas con filtros opcionales. Devuelve conteos y muestras.',
            parameters: {
                type: 'object',
                properties: {
                    fechaInicio: { type: 'string', description: 'YYYY-MM-DD' },
                    fechaFin: { type: 'string', description: 'YYYY-MM-DD (opcional, default hoy)' },
                    tipoAcceso: { type: 'string', enum: ['entrada', 'salida'] },
                    tipoUsuario: { type: 'string', enum: ['residente', 'visitante'] },
                    placa: { type: 'string' }
                },
                required: ['fechaInicio']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'topPlacasFrecuentes',
            description: 'Devuelve las placas con mas accesos en los ultimos N dias.',
            parameters: {
                type: 'object',
                properties: {
                    diasAtras: { type: 'number', description: 'Cantidad de dias hacia atras desde hoy', default: 7 },
                    limite: { type: 'number', description: 'Cantidad de placas a devolver', default: 10 }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'estadoParqueaderos',
            description: 'Estado actual de parqueaderos: ocupados, libres, desglose por tipo y conjunto.',
            parameters: {
                type: 'object',
                properties: {
                    soloOcupados: { type: 'boolean', description: 'Si true devuelve solo los ocupados con detalle' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'statsConjunto',
            description: 'Devuelve estadisticas exactas y actualizadas de un conjunto especifico identificado por su nombre. USA esto cuando el usuario pregunte por datos de un conjunto en particular ("cuantos usuarios hay en Torres del parque", "ocupacion en socorro city", etc.).',
            parameters: {
                type: 'object',
                properties: {
                    nombreConjunto: { type: 'string', description: 'Nombre del conjunto (puede ser parcial, no es case sensitive)' }
                },
                required: ['nombreConjunto']
            }
        }
    }
];

class ChatbotService {
    constructor() {
        this.groq = null;
    }

    getGroqClient() {
        if (!this.groq && process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        return this.groq;
    }

    // ===== Helpers =====
    _baseFilter(conjuntoId) {
        return conjuntoId ? { conjunto: conjuntoId } : {};
    }

    // ===== Implementacion de herramientas =====
    async _toolBuscarPorPlaca(args, conjuntoId) {
        const placa = (args.placa || '').toUpperCase().replace(/\s|-/g, '');
        if (!placa) return { error: 'Placa requerida' };
        const baseF = this._baseFilter(conjuntoId);

        const [residente, visitante, ultimosAccesos] = await Promise.all([
            Usuario.findOne({
                ...baseF,
                $or: [{ placaVehiculo: placa }, { placa2Vehiculo: placa }]
            }).populate('conjunto', 'nombre').lean(),
            Visitante.findOne({ ...baseF, placaVehiculo: placa }).populate('conjunto', 'nombre').lean(),
            HistorialAcceso.find({ ...baseF, placa: { $regex: escaparRegex(placa), $options: 'i' } })
                .populate('conjunto', 'nombre')
                .sort({ fechaHora: -1 }).limit(5).lean()
        ]);

        return {
            placa,
            esResidente: !!residente,
            residente: residente ? {
                nombre: `${residente.nombre} ${residente.apellido}`,
                cedula: residente.cedula,
                apartamento: residente.apartamento,
                torre: residente.torre,
                conjunto: residente.conjunto?.nombre
            } : null,
            esVisitante: !!visitante,
            visitante: visitante ? {
                nombre: `${visitante.nombre} ${visitante.apellido}`,
                cedula: visitante.cedula,
                estado: visitante.estado,
                conjunto: visitante.conjunto?.nombre
            } : null,
            ultimosAccesos: ultimosAccesos.map(a => ({
                fecha: a.fechaHora,
                tipo: a.tipoAcceso,
                conjunto: a.conjunto?.nombre,
                plaza: a.plaza
            })),
            totalAccesosMostrados: ultimosAccesos.length
        };
    }

    async _toolBuscarResidente(args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const filter = { ...baseF, rol: 'residente' };
        const $and = [];
        if (args.nombre) {
            $and.push({
                $or: [
                    { nombre: { $regex: escaparRegex(args.nombre), $options: 'i' } },
                    { apellido: { $regex: escaparRegex(args.nombre), $options: 'i' } }
                ]
            });
        }
        if (args.cedula) $and.push({ cedula: { $regex: escaparRegex(args.cedula), $options: 'i' } });
        if (args.apartamento) $and.push({ apartamento: args.apartamento });
        if (args.torre) $and.push({ torre: args.torre.toUpperCase() });
        if ($and.length) filter.$and = $and;

        const residentes = await Usuario.find(filter, '-password -__v')
            .populate('conjunto', 'nombre').limit(20).lean();

        return {
            total: residentes.length,
            residentes: residentes.map(r => ({
                nombre: `${r.nombre} ${r.apellido}`,
                cedula: r.cedula,
                torre: r.torre,
                apartamento: r.apartamento,
                placaVehiculo: r.placaVehiculo,
                tieneVehiculo: r.tieneVehiculo,
                estadoExpensa: r.estadoExpensa,
                conjunto: r.conjunto?.nombre
            }))
        };
    }

    async _toolBuscarVisitante(args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const filter = { ...baseF };
        const $and = [];
        if (args.nombre) {
            $and.push({
                $or: [
                    { nombre: { $regex: escaparRegex(args.nombre), $options: 'i' } },
                    { apellido: { $regex: escaparRegex(args.nombre), $options: 'i' } }
                ]
            });
        }
        if (args.cedula) $and.push({ cedula: { $regex: escaparRegex(args.cedula), $options: 'i' } });
        if (args.placa) $and.push({ placaVehiculo: { $regex: escaparRegex(args.placa.toUpperCase()), $options: 'i' } });
        if ($and.length) filter.$and = $and;

        const visitantes = await Visitante.find(filter)
            .populate('conjunto', 'nombre')
            .populate('residenteId', 'nombre apellido')
            .limit(20).lean();

        return {
            total: visitantes.length,
            visitantes: visitantes.map(v => ({
                nombre: `${v.nombre} ${v.apellido}`,
                cedula: v.cedula,
                placa: v.placaVehiculo,
                estado: v.estado,
                motivoVisita: v.motivoVisita,
                aptoDestino: v.apartamentoDestino,
                torreDestino: v.torreDestino,
                autorizadoPor: v.residenteId ? `${v.residenteId.nombre} ${v.residenteId.apellido}` : null,
                conjunto: v.conjunto?.nombre
            }))
        };
    }

    async _toolListarVisitantesPendientes(_args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const visitantes = await Visitante.find({ ...baseF, estado: 'pendiente' })
            .populate('conjunto', 'nombre')
            .populate('residenteId', 'nombre apellido')
            .sort({ createdAt: -1 }).limit(30).lean();
        return {
            total: visitantes.length,
            visitantes: visitantes.map(v => ({
                nombre: `${v.nombre} ${v.apellido}`,
                placa: v.placaVehiculo,
                aptoDestino: v.apartamentoDestino,
                autorizadoPor: v.residenteId ? `${v.residenteId.nombre} ${v.residenteId.apellido}` : null,
                conjunto: v.conjunto?.nombre
            }))
        };
    }

    async _toolListarResidentesEnMora(_args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const residentes = await Usuario.find({ ...baseF, rol: 'residente', estadoExpensa: 'en mora' }, '-password -__v')
            .populate('conjunto', 'nombre').limit(50).lean();
        return {
            total: residentes.length,
            residentes: residentes.map(r => ({
                nombre: `${r.nombre} ${r.apellido}`,
                torre: r.torre,
                apartamento: r.apartamento,
                conjunto: r.conjunto?.nombre
            }))
        };
    }

    async _toolAccesosEnRango(args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const filter = { ...baseF };
        const inicio = new Date(args.fechaInicio);
        const fin = args.fechaFin ? new Date(args.fechaFin) : new Date();
        fin.setHours(23, 59, 59, 999);
        filter.fechaHora = { $gte: inicio, $lte: fin };
        if (args.tipoAcceso) filter.tipoAcceso = args.tipoAcceso;
        if (args.tipoUsuario) filter.tipoUsuario = args.tipoUsuario;
        if (args.placa) filter.placa = { $regex: escaparRegex(args.placa.toUpperCase()), $options: 'i' };

        const [total, entradas, salidas, residentes, visitantes, muestra] = await Promise.all([
            HistorialAcceso.countDocuments(filter),
            HistorialAcceso.countDocuments({ ...filter, tipoAcceso: 'entrada' }),
            HistorialAcceso.countDocuments({ ...filter, tipoAcceso: 'salida' }),
            HistorialAcceso.countDocuments({ ...filter, tipoUsuario: 'residente' }),
            HistorialAcceso.countDocuments({ ...filter, tipoUsuario: 'visitante' }),
            HistorialAcceso.find(filter).populate('conjunto', 'nombre').sort({ fechaHora: -1 }).limit(8).lean()
        ]);

        return {
            rango: { desde: inicio.toISOString(), hasta: fin.toISOString() },
            total, entradas, salidas, residentes, visitantes,
            ultimosAccesos: muestra.map(a => ({
                fecha: a.fechaHora,
                tipo: a.tipoAcceso,
                tipoUsuario: a.tipoUsuario,
                nombre: a.nombreUsuario,
                placa: a.placa,
                plaza: a.plaza,
                conjunto: a.conjunto?.nombre
            }))
        };
    }

    async _toolTopPlacasFrecuentes(args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);
        const dias = args.diasAtras || 7;
        const limite = Math.min(args.limite || 10, 25);
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);

        const matchStage = { ...baseF, fechaHora: { $gte: desde } };
        const top = await HistorialAcceso.aggregate([
            { $match: matchStage },
            { $group: { _id: '$placa', accesos: { $sum: 1 }, ultimoNombre: { $last: '$nombreUsuario' }, ultimoTipo: { $last: '$tipoUsuario' } } },
            { $sort: { accesos: -1 } },
            { $limit: limite }
        ]);

        return {
            diasAnalizados: dias,
            totalPlacasUnicas: top.length,
            top: top.map(t => ({
                placa: t._id,
                accesos: t.accesos,
                nombre: t.ultimoNombre,
                tipo: t.ultimoTipo
            }))
        };
    }

    async _toolEstadoParqueaderos(args, conjuntoId) {
        const baseF = this._baseFilter(conjuntoId);

        if (args.soloOcupados) {
            const ocupados = await Parqueadero.find({ ...baseF, estado: 'OCUPADO' })
                .populate('conjunto', 'nombre')
                .populate('visitante', 'nombre apellido')
                .populate('residenteAsignado', 'nombre apellido')
                .limit(40).lean();
            return {
                total: ocupados.length,
                ocupados: ocupados.map(p => ({
                    numero: p.numero,
                    categoria: p.categoria,
                    tipo: p.tipoVehiculo,
                    placa: p.placaVehiculo,
                    horaEntrada: p.horaEntrada,
                    visitante: p.visitante ? `${p.visitante.nombre} ${p.visitante.apellido}` : null,
                    residente: p.residenteAsignado ? `${p.residenteAsignado.nombre} ${p.residenteAsignado.apellido}` : null,
                    conjunto: p.conjunto?.nombre
                }))
            };
        }

        const conjuntos = conjuntoId ? [await Conjunto.findById(conjuntoId).lean()].filter(Boolean) : await Conjunto.find().lean();
        const out = [];
        for (const c of conjuntos) {
            const f = { conjunto: c._id };
            const [pcT, pcL, pmT, pmL, vcT, vcL, vmT, vmL, total, libres, ocupados] = await Promise.all([
                Parqueadero.countDocuments({ ...f, categoria: 'PRIVADO', tipoVehiculo: 'CARRO' }),
                Parqueadero.countDocuments({ ...f, categoria: 'PRIVADO', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' }),
                Parqueadero.countDocuments({ ...f, categoria: 'PRIVADO', tipoVehiculo: 'MOTO' }),
                Parqueadero.countDocuments({ ...f, categoria: 'PRIVADO', tipoVehiculo: 'MOTO', estado: 'DISPONIBLE' }),
                Parqueadero.countDocuments({ ...f, categoria: 'VISITANTE', tipoVehiculo: 'CARRO' }),
                Parqueadero.countDocuments({ ...f, categoria: 'VISITANTE', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' }),
                Parqueadero.countDocuments({ ...f, categoria: 'VISITANTE', tipoVehiculo: 'MOTO' }),
                Parqueadero.countDocuments({ ...f, categoria: 'VISITANTE', tipoVehiculo: 'MOTO', estado: 'DISPONIBLE' }),
                Parqueadero.countDocuments(f),
                Parqueadero.countDocuments({ ...f, estado: 'DISPONIBLE' }),
                Parqueadero.countDocuments({ ...f, estado: 'OCUPADO' })
            ]);
            out.push({
                conjunto: c.nombre,
                total, libres, ocupados,
                ocupacionPct: total > 0 ? Math.round((ocupados / total) * 100) : 0,
                privadoCarro: { total: pcT, libres: pcL },
                privadoMoto: { total: pmT, libres: pmL },
                visitanteCarro: { total: vcT, libres: vcL },
                visitanteMoto: { total: vmT, libres: vmL }
            });
        }
        return { conjuntos: out };
    }

    async _toolStatsConjunto(args, conjuntoIdSesion) {
        const nombre = (args.nombreConjunto || '').trim();
        if (!nombre) return { error: 'Nombre del conjunto requerido' };

        // Buscar conjunto por nombre (case insensitive, parcial)
        const conjunto = await Conjunto.findOne({
            nombre: { $regex: escaparRegex(nombre), $options: 'i' }
        }).lean();

        if (!conjunto) {
            return { error: `No se encontro un conjunto que coincida con "${nombre}"` };
        }

        // Si el usuario NO es superadmin, solo puede ver su propio conjunto
        if (conjuntoIdSesion && conjuntoIdSesion.toString() !== conjunto._id.toString()) {
            return { error: 'No tienes permisos para consultar ese conjunto' };
        }

        const stats = await this._statsConjunto({ conjunto: conjunto._id }, conjunto.nombre);
        const extra = await this._topYRecientes({ conjunto: conjunto._id });
        return {
            conjunto: conjunto.nombre,
            datos: stats,
            adicional: extra
        };
    }

    async _ejecutarTool(name, args, conjuntoId) {
        const map = {
            buscarPorPlaca: this._toolBuscarPorPlaca,
            buscarResidente: this._toolBuscarResidente,
            buscarVisitante: this._toolBuscarVisitante,
            listarVisitantesPendientes: this._toolListarVisitantesPendientes,
            listarResidentesEnMora: this._toolListarResidentesEnMora,
            accesosEnRango: this._toolAccesosEnRango,
            topPlacasFrecuentes: this._toolTopPlacasFrecuentes,
            estadoParqueaderos: this._toolEstadoParqueaderos,
            statsConjunto: this._toolStatsConjunto
        };
        const fn = map[name];
        if (!fn) return { error: `Herramienta desconocida: ${name}` };
        try {
            return await fn.call(this, args || {}, conjuntoId);
        } catch (e) {
            console.error(`Error ejecutando tool ${name}:`, e);
            return { error: e.message };
        }
    }

    // ===== Resumen detallado por conjunto =====
    async _statsConjunto(conjuntoFilter, label) {
        const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
        const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - 7); inicioSemana.setHours(0, 0, 0, 0);
        const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

        const queryHoy = { ...conjuntoFilter, fechaHora: { $gte: inicioHoy } };
        const querySem = { ...conjuntoFilter, fechaHora: { $gte: inicioSemana } };
        const queryMes = { ...conjuntoFilter, fechaHora: { $gte: inicioMes } };

        const [
            entHoy, salHoy, entSem, salSem, entMes, salMes,
            accResHoy, accVisHoy,
            resTotal, resVehiculo, resMora, adminsT, porterosT,
            visT, visPend, visIngr,
            parqT, parqL, parqO,
            pcT, pcL, pmT, pmL, vcT, vcL, vmT, vmL,
            torres
        ] = await Promise.all([
            HistorialAcceso.countDocuments({ ...queryHoy, tipoAcceso: 'entrada' }),
            HistorialAcceso.countDocuments({ ...queryHoy, tipoAcceso: 'salida' }),
            HistorialAcceso.countDocuments({ ...querySem, tipoAcceso: 'entrada' }),
            HistorialAcceso.countDocuments({ ...querySem, tipoAcceso: 'salida' }),
            HistorialAcceso.countDocuments({ ...queryMes, tipoAcceso: 'entrada' }),
            HistorialAcceso.countDocuments({ ...queryMes, tipoAcceso: 'salida' }),
            HistorialAcceso.countDocuments({ ...queryHoy, tipoUsuario: 'residente' }),
            HistorialAcceso.countDocuments({ ...queryHoy, tipoUsuario: 'visitante' }),
            Usuario.countDocuments({ ...conjuntoFilter, rol: 'residente' }),
            Usuario.countDocuments({ ...conjuntoFilter, rol: 'residente', tieneVehiculo: true }),
            Usuario.countDocuments({ ...conjuntoFilter, rol: 'residente', estadoExpensa: 'en mora' }),
            Usuario.countDocuments({ ...conjuntoFilter, rol: 'admin' }),
            Usuario.countDocuments({ ...conjuntoFilter, rol: 'porteria' }),
            Visitante.countDocuments(conjuntoFilter),
            Visitante.countDocuments({ ...conjuntoFilter, estado: 'pendiente' }),
            Visitante.countDocuments({ ...conjuntoFilter, estado: 'ingresado' }),
            Parqueadero.countDocuments(conjuntoFilter),
            Parqueadero.countDocuments({ ...conjuntoFilter, estado: 'DISPONIBLE' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, estado: 'OCUPADO' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'PRIVADO', tipoVehiculo: 'CARRO' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'PRIVADO', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'PRIVADO', tipoVehiculo: 'MOTO' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'PRIVADO', tipoVehiculo: 'MOTO', estado: 'DISPONIBLE' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'VISITANTE', tipoVehiculo: 'CARRO' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'VISITANTE', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'VISITANTE', tipoVehiculo: 'MOTO' }),
            Parqueadero.countDocuments({ ...conjuntoFilter, categoria: 'VISITANTE', tipoVehiculo: 'MOTO', estado: 'DISPONIBLE' }),
            Usuario.distinct('torre', { ...conjuntoFilter, rol: 'residente' })
        ]);

        const ocupPct = parqT > 0 ? Math.round((parqO / parqT) * 100) : 0;
        const torresList = torres.filter(t => t && t !== 'N/A').sort();

        return `${label ? `### ${label} ###\n` : ''}USUARIOS:
  - Residentes: ${resTotal} (con vehiculo: ${resVehiculo}, en mora: ${resMora})
  - Admins: ${adminsT} | Porteros: ${porterosT}
  - Torres: ${torresList.join(', ') || 'N/D'}
VISITANTES:
  - Registrados: ${visT} | Pendientes: ${visPend} | Dentro ahora: ${visIngr}
PARQUEADEROS (${parqT} total, ocupacion ${ocupPct}%):
  - Privados Carro: ${pcL}/${pcT} libres | Privados Moto: ${pmL}/${pmT} libres
  - Visitantes Carro: ${vcL}/${vcT} libres | Visitantes Moto: ${vmL}/${vmT} libres
  - Estado: ${parqL} libres, ${parqO} ocupados
ACCESOS HOY: entradas ${entHoy} / salidas ${salHoy} (residentes: ${accResHoy}, visitantes: ${accVisHoy})
ACCESOS 7 DIAS: entradas ${entSem} / salidas ${salSem}
ACCESOS MES: entradas ${entMes} / salidas ${salMes}`;
    }

    // ===== Top placas y ultimos accesos para contexto =====
    async _topYRecientes(conjuntoFilter) {
        const desde = new Date(); desde.setDate(desde.getDate() - 7);
        const [top, ultimos, ocupadosAhora] = await Promise.all([
            HistorialAcceso.aggregate([
                { $match: { ...conjuntoFilter, fechaHora: { $gte: desde } } },
                { $group: { _id: '$placa', accesos: { $sum: 1 } } },
                { $sort: { accesos: -1 } },
                { $limit: 5 }
            ]),
            HistorialAcceso.find(conjuntoFilter)
                .populate('conjunto', 'nombre')
                .sort({ fechaHora: -1 }).limit(5).lean(),
            Parqueadero.find({ ...conjuntoFilter, estado: 'OCUPADO' })
                .populate('conjunto', 'nombre')
                .limit(8).lean()
        ]);

        const topStr = top.length > 0
            ? top.map(t => `${t._id} (${t.accesos})`).join(', ')
            : 'sin datos';
        const ultStr = ultimos.length > 0
            ? ultimos.map(u => `${new Date(u.fechaHora).toLocaleString('es-CO')} ${u.tipoAcceso} ${u.placa} (${u.tipoUsuario})`).join('; ')
            : 'sin datos';
        const ocupStr = ocupadosAhora.length > 0
            ? ocupadosAhora.map(p => `${p.numero} (${p.placaVehiculo || 'sin placa'})`).join(', ')
            : 'ninguno';

        return `TOP 5 PLACAS 7d: ${topStr}
ULTIMOS 5 ACCESOS: ${ultStr}
PLAZAS OCUPADAS AHORA: ${ocupStr}`;
    }

    // ===== Contexto completo (dashboard + DB) =====
    async _resumenLiviano(conjuntoId) {
        const ahora = new Date().toLocaleString('es-CO');
        const conjuntos = conjuntoId
            ? [await Conjunto.findById(conjuntoId).lean()].filter(Boolean)
            : await Conjunto.find().lean();

        if (conjuntos.length === 0) {
            return `Sin conjuntos disponibles a las ${ahora}.`;
        }

        const partes = [`=== CONTEXTO COMPLETO DEL SISTEMA (${ahora}) ===`];

        // Si superadmin (sin conjuntoId), agregar TOTAL global primero
        if (!conjuntoId) {
            partes.push(await this._statsConjunto({}, 'TOTAL DEL SISTEMA (todos los conjuntos)'));
            partes.push(await this._topYRecientes({}));
        }

        // Bloques por conjunto
        for (const c of conjuntos) {
            partes.push(await this._statsConjunto({ conjunto: c._id }, c.nombre));
            partes.push(await this._topYRecientes({ conjunto: c._id }));
        }

        partes.push(`=== HERRAMIENTAS DISPONIBLES PARA CONSULTAS ESPECIFICAS ===
Si el usuario pregunta por: una placa concreta, un residente por nombre/apartamento, un visitante por nombre,
visitantes pendientes detallados, residentes en mora detallados, accesos en un rango especifico, top placas
mas alla de las 5 mostradas, o detalle de plazas ocupadas, USA las herramientas (tools) para obtener los datos.
Para preguntas sobre los numeros agregados arriba, responde directamente sin llamar herramientas.`);

        return partes.join('\n\n');
    }

    async processChatQuery(userQuery, conjuntoId) {
        const client = this.getGroqClient();
        if (!client) {
            throw new Error("El servicio de Chat no está habilitado. Verifica la variable GROQ_API_KEY.");
        }

        const resumen = await this._resumenLiviano(conjuntoId);
        const ambito = conjuntoId ? 'un conjunto especifico' : 'TODOS los conjuntos (vista superadmin)';

        const systemPrompt = `Eres el asistente virtual de "Admin Residencial" (SafeEntry).
Respondes consultas usando datos REALES de la base de datos en tiempo real.

Tienes acceso a ${ambito}. El alcance esta filtrado por permisos del usuario logueado.

==== REGLAS CRITICAS ====
1. SIEMPRE que la pregunta mencione un conjunto especifico por nombre ("Torres del parque", "socorro city", "Conjunto Principal"), DEBES llamar a la herramienta "statsConjunto" con ese nombre. NO uses los numeros agregados del contexto general para responder sobre un conjunto especifico.

2. SIEMPRE que la pregunta sea sobre una placa concreta, residente por nombre/apartamento, visitante por nombre, accesos en un rango de fechas, lista detallada de pendientes/mora, USA las herramientas correspondientes.

3. Para preguntas GLOBALES o agregadas (que no especifican conjunto), puedes usar el contexto precargado abajo.

4. NUNCA inventes datos. Si no tienes la info, dilo.

5. Despues de usar una herramienta, redacta la respuesta en lenguaje natural (no pegues JSON crudo).

6. Responde en espanol, claro, 2 a 6 oraciones.

==== HERRAMIENTAS CLAVE ====
- statsConjunto(nombreConjunto): para preguntas sobre un conjunto especifico
- buscarPorPlaca(placa): para una placa concreta
- buscarResidente(nombre/cedula/apartamento/torre): para residentes especificos
- buscarVisitante(nombre/cedula/placa): para visitantes especificos
- listarVisitantesPendientes(): lista detallada
- listarResidentesEnMora(): lista detallada
- accesosEnRango(fechaInicio, fechaFin): conteos en rango
- topPlacasFrecuentes(diasAtras): top placas
- estadoParqueaderos(): estado actual

Fecha/hora actual: ${new Date().toLocaleString('es-CO')}.

==== CONTEXTO PRECARGADO (datos en vivo) ====
${resumen}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ];

        const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

        // Bucle de tool calls (maximo 4 iteraciones)
        for (let i = 0; i < 4; i++) {
            const completion = await client.chat.completions.create({
                messages,
                model,
                temperature: 0.1,
                max_tokens: 500,
                tools: TOOLS,
                tool_choice: 'auto'
            });

            const msg = completion.choices[0]?.message;
            if (!msg) return 'Lo siento, no pude procesar la respuesta.';

            // Si hay tool calls, ejecutar y continuar
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                messages.push(msg);
                for (const call of msg.tool_calls) {
                    let parsed = {};
                    try { parsed = JSON.parse(call.function.arguments || '{}'); }
                    catch (e) { parsed = {}; }
                    const result = await this._ejecutarTool(call.function.name, parsed, conjuntoId);
                    messages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify(result).slice(0, 6000) // truncar por seguridad
                    });
                }
                continue;
            }

            return msg.content || 'Sin respuesta.';
        }

        return 'No pude completar la consulta tras varias iteraciones.';
    }
}

module.exports = new ChatbotService();
