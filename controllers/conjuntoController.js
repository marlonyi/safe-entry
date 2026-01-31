// controllers/conjuntoController.js
const Conjunto = require("../config/models/conjunto");
const Usuario = require("../config/models/usuario");
const Visitante = require("../config/models/visitante");
const Parqueadero = require("../config/models/parqueadero");
const AuditLog = require("../config/models/auditLog");
const logger = require("../config/logger");

// Verificar ambiente
const isProduction = process.env.NODE_ENV === 'production';

// Helper para manejar errores (oculta detalles en producción)
const getErrorDetails = (error) => {
    if (isProduction) {
        logger.error('Error en conjunto:', error.message);
        return undefined;
    }
    return error.message;
};

/**
 * Crear un nuevo conjunto residencial
 * Solo superadmin puede realizar esta acción
 */
const crearConjunto = async (req, res) => {
    try {
        const { nombre, nit, direccion, ciudad, departamento, telefono, email, configuracion, contactoAdmin } = req.body;

        // Validación básica
        if (!nombre || nombre.trim().length < 3) {
            return res.status(400).json({
                error: "El nombre del conjunto es requerido (mínimo 3 caracteres)"
            });
        }

        // Verificar que no exista otro conjunto con el mismo nombre
        const existeNombre = await Conjunto.findOne({ nombre: nombre.trim() });
        if (existeNombre) {
            return res.status(400).json({
                error: "Ya existe un conjunto con este nombre"
            });
        }

        // Verificar NIT único si se proporciona
        if (nit) {
            const existeNit = await Conjunto.findOne({ nit: nit.trim() });
            if (existeNit) {
                return res.status(400).json({
                    error: "Ya existe un conjunto con este NIT"
                });
            }
        }

        // Crear el conjunto
        const nuevoConjunto = new Conjunto({
            nombre: nombre.trim(),
            nit: nit?.trim() || null,
            direccion: direccion?.trim(),
            ciudad: ciudad?.trim(),
            departamento: departamento?.trim(),
            telefono: telefono?.trim(),
            email: email?.trim()?.toLowerCase(),
            configuracion: configuracion || {},
            contactoAdmin: contactoAdmin || {}
        });

        await nuevoConjunto.save();

        // Registrar en auditoría
        await AuditLog.registrar({
            conjunto: null, // Acción de superadmin
            usuario: {
                id: req.usuario.id,
                cedula: req.usuario.cedula,
                nombre: req.usuario.nombre,
                rol: req.usuario.rol
            },
            accion: 'CREATE_CONJUNTO',
            descripcion: `Creado conjunto: ${nuevoConjunto.nombre}`,
            recurso: {
                tipo: 'conjunto',
                id: nuevoConjunto._id.toString(),
                nombre: nuevoConjunto.nombre,
                datosNuevos: {
                    nombre: nuevoConjunto.nombre,
                    ciudad: nuevoConjunto.ciudad,
                    estado: nuevoConjunto.estado
                }
            },
            requestInfo: {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                method: req.method,
                path: req.originalUrl
            },
            resultado: 'SUCCESS'
        });

        res.status(201).json({
            mensaje: "Conjunto creado exitosamente",
            conjunto: nuevoConjunto
        });

    } catch (error) {
        logger.error("Error creando conjunto:", error);
        res.status(500).json({
            error: "Error interno al crear el conjunto",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Obtener todos los conjuntos (con paginación)
 * Solo superadmin
 */
const obtenerConjuntos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            estado,
            ciudad,
            busqueda
        } = req.query;

        let query = {};

        // Filtros opcionales
        if (estado) {
            query.estado = estado;
        }
        if (ciudad) {
            query.ciudad = new RegExp(ciudad, 'i');
        }
        if (busqueda) {
            query.$or = [
                { nombre: new RegExp(busqueda, 'i') },
                { nit: new RegExp(busqueda, 'i') },
                { direccion: new RegExp(busqueda, 'i') }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [conjuntos, total] = await Promise.all([
            Conjunto.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Conjunto.countDocuments(query)
        ]);

        // Obtener estadísticas básicas para cada conjunto
        const conjuntosConStats = await Promise.all(
            conjuntos.map(async (conjunto) => {
                const [usuarios, visitantes, parqueaderos] = await Promise.all([
                    Usuario.countDocuments({ conjunto: conjunto._id }),
                    Visitante.countDocuments({ conjunto: conjunto._id }),
                    Parqueadero.countDocuments({ conjunto: conjunto._id })
                ]);
                return {
                    ...conjunto,
                    stats: { usuarios, visitantes, parqueaderos }
                };
            })
        );

        res.json({
            conjuntos: conjuntosConStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error("Error obteniendo conjuntos:", error);
        res.status(500).json({
            error: "Error interno al obtener conjuntos",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Obtener un conjunto por ID con estadísticas completas
 */
const obtenerConjuntoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const conjunto = await Conjunto.findById(id).lean();

        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Obtener estadísticas detalladas
        const [usuarios, visitantes, parqueaderos, admins] = await Promise.all([
            Usuario.countDocuments({ conjunto: id }),
            Visitante.countDocuments({ conjunto: id }),
            Parqueadero.countDocuments({ conjunto: id }),
            Usuario.countDocuments({ conjunto: id, rol: 'admin' })
        ]);

        // Contar parqueaderos por estado
        const parqueaderosStats = await Parqueadero.aggregate([
            { $match: { conjunto: conjunto._id } },
            { $group: { _id: '$estado', count: { $sum: 1 } } }
        ]);

        res.json({
            ...conjunto,
            stats: {
                usuarios,
                visitantes,
                parqueaderos,
                admins,
                parqueaderosEstado: parqueaderosStats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        logger.error("Error obteniendo conjunto:", error);
        res.status(500).json({
            error: "Error interno al obtener conjunto",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Actualizar un conjunto
 */
const actualizarConjunto = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const conjunto = await Conjunto.findById(id);

        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        const datosAnteriores = conjunto.toObject();

        // Campos permitidos para actualizar
        const camposPermitidos = [
            'nombre', 'nit', 'direccion', 'ciudad', 'departamento',
            'telefono', 'email', 'logo', 'estado', 'configuracion',
            'contactoAdmin', 'notasInternas'
        ];

        // Aplicar solo cambios permitidos
        camposPermitidos.forEach(campo => {
            if (updates[campo] !== undefined) {
                conjunto[campo] = updates[campo];
            }
        });

        await conjunto.save();

        // Auditoría
        await AuditLog.registrar({
            conjunto: null,
            usuario: {
                id: req.usuario.id,
                cedula: req.usuario.cedula,
                nombre: req.usuario.nombre,
                rol: req.usuario.rol
            },
            accion: 'UPDATE_CONJUNTO',
            descripcion: `Actualizado conjunto: ${conjunto.nombre}`,
            recurso: {
                tipo: 'conjunto',
                id: conjunto._id.toString(),
                nombre: conjunto.nombre,
                datosAnteriores: {
                    nombre: datosAnteriores.nombre,
                    estado: datosAnteriores.estado
                },
                datosNuevos: {
                    nombre: conjunto.nombre,
                    estado: conjunto.estado
                }
            },
            requestInfo: {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                method: req.method,
                path: req.originalUrl
            },
            resultado: 'SUCCESS'
        });

        res.json({
            mensaje: "Conjunto actualizado exitosamente",
            conjunto
        });

    } catch (error) {
        logger.error("Error actualizando conjunto:", error);
        res.status(500).json({
            error: "Error interno al actualizar conjunto",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Eliminar (desactivar) un conjunto
 * Por seguridad, solo se desactiva, no se borra
 */
const eliminarConjunto = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmar } = req.body;

        const conjunto = await Conjunto.findById(id);

        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Verificar que no sea el único conjunto activo
        const conjuntosActivos = await Conjunto.countDocuments({ estado: 'activo' });
        if (conjuntosActivos <= 1 && conjunto.estado === 'activo') {
            return res.status(400).json({
                error: "No se puede desactivar el único conjunto activo del sistema"
            });
        }

        // Obtener estadísticas antes de desactivar
        const usuarios = await Usuario.countDocuments({ conjunto: id });

        if (usuarios > 0 && !confirmar) {
            return res.status(400).json({
                error: "Este conjunto tiene usuarios asociados",
                mensaje: "Envía { confirmar: true } para forzar la desactivación",
                stats: { usuarios }
            });
        }

        // Soft delete: cambiar estado a inactivo
        conjunto.estado = 'inactivo';
        await conjunto.save();

        // Auditoría
        await AuditLog.registrar({
            conjunto: null,
            usuario: {
                id: req.usuario.id,
                cedula: req.usuario.cedula,
                nombre: req.usuario.nombre,
                rol: req.usuario.rol
            },
            accion: 'DELETE_CONJUNTO',
            descripcion: `Desactivado conjunto: ${conjunto.nombre}`,
            recurso: {
                tipo: 'conjunto',
                id: conjunto._id.toString(),
                nombre: conjunto.nombre
            },
            requestInfo: {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                method: req.method,
                path: req.originalUrl
            },
            resultado: 'SUCCESS'
        });

        res.json({
            mensaje: "Conjunto desactivado exitosamente",
            conjunto: {
                id: conjunto._id,
                nombre: conjunto.nombre,
                estado: conjunto.estado
            }
        });

    } catch (error) {
        logger.error("Error eliminando conjunto:", error);
        res.status(500).json({
            error: "Error interno al eliminar conjunto",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Obtener estadísticas globales de todos los conjuntos
 * Solo superadmin
 */
const obtenerEstadisticasGlobales = async (req, res) => {
    try {
        const [
            totalConjuntos,
            conjuntosActivos,
            totalUsuarios,
            totalVisitantes,
            totalParqueaderos
        ] = await Promise.all([
            Conjunto.countDocuments(),
            Conjunto.countDocuments({ estado: 'activo' }),
            Usuario.countDocuments({ rol: { $ne: 'superadmin' } }),
            Visitante.countDocuments(),
            Parqueadero.countDocuments()
        ]);

        // Estadísticas por conjunto (top 10 por usuarios)
        const topConjuntos = await Usuario.aggregate([
            { $match: { conjunto: { $ne: null } } },
            { $group: { _id: '$conjunto', usuarios: { $sum: 1 } } },
            { $sort: { usuarios: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'conjuntos',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'conjunto'
                }
            },
            { $unwind: '$conjunto' },
            {
                $project: {
                    _id: 1,
                    nombre: '$conjunto.nombre',
                    ciudad: '$conjunto.ciudad',
                    estado: '$conjunto.estado',
                    usuarios: 1
                }
            }
        ]);

        res.json({
            resumen: {
                totalConjuntos,
                conjuntosActivos,
                conjuntosInactivos: totalConjuntos - conjuntosActivos,
                totalUsuarios,
                totalVisitantes,
                totalParqueaderos
            },
            topConjuntos
        });

    } catch (error) {
        logger.error("Error obteniendo estadísticas:", error);
        res.status(500).json({
            error: "Error interno al obtener estadísticas",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Obtener lista de conjuntos para selector (público para login)
 * Retorna solo nombre e id de conjuntos activos
 */
const listarConjuntosParaSelector = async (req, res) => {
    try {
        const conjuntos = await Conjunto.find({ estado: 'activo' })
            .select('nombre ciudad')
            .sort({ nombre: 1 })
            .lean();

        res.json(conjuntos);

    } catch (error) {
        logger.error("Error listando conjuntos:", error);
        res.status(500).json({
            error: "Error interno",
            detalle: getErrorDetails(error)
        });
    }
};

/**
 * Actualizar plan/suscripción de un conjunto
 * Solo superadmin
 */
const actualizarPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, fechaVencimiento, limites } = req.body;

        const conjunto = await Conjunto.findById(id);

        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        const planAnterior = { ...conjunto.plan?.toObject?.() || conjunto.plan };

        // Validar tipo de plan si se proporciona
        const tiposValidos = ['trial', 'basico', 'profesional', 'enterprise'];
        if (tipo && !tiposValidos.includes(tipo)) {
            return res.status(400).json({
                error: `Tipo de plan inválido. Opciones: ${tiposValidos.join(', ')}`
            });
        }

        // Actualizar campos del plan
        if (!conjunto.plan) {
            conjunto.plan = {};
        }

        if (tipo) {
            conjunto.plan.tipo = tipo;
            // Si se cambia el tipo, actualizar fecha de inicio
            if (tipo !== planAnterior?.tipo) {
                conjunto.plan.fechaInicio = new Date();
            }
        }

        if (fechaVencimiento) {
            conjunto.plan.fechaVencimiento = new Date(fechaVencimiento);
        }

        if (limites) {
            conjunto.plan.limites = {
                ...conjunto.plan.limites,
                ...limites
            };
        }

        await conjunto.save();

        // Auditoría
        try {
            await AuditLog.registrar({
                conjunto: null,
                usuario: {
                    id: req.usuario.id,
                    cedula: 'superadmin',
                    nombre: 'SuperAdmin',
                    rol: 'superadmin'
                },
                accion: 'UPDATE_PLAN',
                descripcion: `Actualizado plan de: ${conjunto.nombre}`,
                recurso: {
                    tipo: 'conjunto',
                    id: conjunto._id.toString(),
                    nombre: conjunto.nombre,
                    datosAnteriores: planAnterior,
                    datosNuevos: conjunto.plan
                },
                resultado: 'SUCCESS'
            });
        } catch (auditError) {
            logger.warn('Error registrando auditoría:', auditError.message);
        }

        res.json({
            mensaje: "Plan actualizado exitosamente",
            conjunto: {
                id: conjunto._id,
                nombre: conjunto.nombre,
                plan: conjunto.plan
            }
        });

    } catch (error) {
        logger.error("Error actualizando plan:", error);
        res.status(500).json({
            error: "Error interno al actualizar plan",
            detalle: getErrorDetails(error)
        });
    }
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

