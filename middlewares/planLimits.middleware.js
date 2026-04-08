/**
 * 📊 Middleware de Límites de Plan
 * Valida que no se excedan los límites según el plan del conjunto
 */

const Usuario = require("../models/usuario");
const Visitante = require("../models/visitante");
const Parqueadero = require("../models/parqueadero");
const Conjunto = require("../models/conjunto");

// Límites por defecto según tipo de plan
const LIMITES_POR_PLAN = {
    trial: {
        maxUsuarios: 20,
        maxParqueaderos: 10,
        maxVisitantes: 50
    },
    basico: {
        maxUsuarios: 100,
        maxParqueaderos: 30,
        maxVisitantes: 200
    },
    profesional: {
        maxUsuarios: 300,
        maxParqueaderos: 100,
        maxVisitantes: 500
    },
    enterprise: {
        maxUsuarios: Infinity,
        maxParqueaderos: Infinity,
        maxVisitantes: Infinity
    }
};

/**
 * Obtiene los límites efectivos de un conjunto
 * Usa los límites personalizados si existen, sino los por defecto del plan
 */
const obtenerLimitesConjunto = async (conjuntoId) => {
    const conjunto = await Conjunto.findById(conjuntoId).lean();

    if (!conjunto) {
        return null;
    }

    const tipoPlan = conjunto.plan?.tipo || 'trial';
    const limitesDefecto = LIMITES_POR_PLAN[tipoPlan] || LIMITES_POR_PLAN.trial;

    // Usar límites personalizados si existen, sino los por defecto
    return {
        maxUsuarios: conjunto.plan?.limites?.maxUsuarios || limitesDefecto.maxUsuarios,
        maxParqueaderos: conjunto.plan?.limites?.maxParqueaderos || limitesDefecto.maxParqueaderos,
        maxVisitantes: conjunto.plan?.limites?.maxVisitantes || limitesDefecto.maxVisitantes,
        tipoPlan,
        nombreConjunto: conjunto.nombre
    };
};

/**
 * Verifica el límite de usuarios antes de crear uno nuevo
 */
const verificarLimiteUsuarios = async (req, res, next) => {
    try {
        // SuperAdmin puede crear sin límites
        if (req.usuario?.rol === 'superadmin') {
            return next();
        }

        const conjuntoId = req.usuario?.conjuntoId || req.body?.conjuntoId;

        if (!conjuntoId) {
            return next(); // Sin conjunto, continuar (validación lo manejará)
        }

        const limites = await obtenerLimitesConjunto(conjuntoId);

        if (!limites) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Enterprise no tiene límites
        if (limites.maxUsuarios === Infinity) {
            return next();
        }

        // Contar usuarios actuales (excluyendo superadmin)
        const usuariosActuales = await Usuario.countDocuments({
            conjunto: conjuntoId,
            rol: { $ne: 'superadmin' }
        });

        if (usuariosActuales >= limites.maxUsuarios) {
            return res.status(403).json({
                error: "Límite de usuarios alcanzado",
                mensaje: `El plan ${limites.tipoPlan.toUpperCase()} permite máximo ${limites.maxUsuarios} usuarios. Actualmente hay ${usuariosActuales}.`,
                limite: limites.maxUsuarios,
                actual: usuariosActuales,
                plan: limites.tipoPlan
            });
        }

        next();
    } catch (error) {
        console.error("Error verificando límite de usuarios:", error);
        next(); // En caso de error, permitir continuar
    }
};

/**
 * Verifica el límite de parqueaderos antes de crear uno nuevo
 */
const verificarLimiteParqueaderos = async (req, res, next) => {
    try {
        // SuperAdmin puede crear sin límites
        if (req.usuario?.rol === 'superadmin') {
            return next();
        }

        const conjuntoId = req.usuario?.conjuntoId || req.body?.conjuntoId;

        if (!conjuntoId) {
            return next();
        }

        const limites = await obtenerLimitesConjunto(conjuntoId);

        if (!limites) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        if (limites.maxParqueaderos === Infinity) {
            return next();
        }

        const parqueaderosActuales = await Parqueadero.countDocuments({ conjunto: conjuntoId });

        if (parqueaderosActuales >= limites.maxParqueaderos) {
            return res.status(403).json({
                error: "Límite de parqueaderos alcanzado",
                mensaje: `El plan ${limites.tipoPlan.toUpperCase()} permite máximo ${limites.maxParqueaderos} parqueaderos. Actualmente hay ${parqueaderosActuales}.`,
                limite: limites.maxParqueaderos,
                actual: parqueaderosActuales,
                plan: limites.tipoPlan
            });
        }

        next();
    } catch (error) {
        console.error("Error verificando límite de parqueaderos:", error);
        next();
    }
};

/**
 * Verifica el límite de visitantes antes de crear uno nuevo
 */
const verificarLimiteVisitantes = async (req, res, next) => {
    try {
        // SuperAdmin puede crear sin límites
        if (req.usuario?.rol === 'superadmin') {
            return next();
        }

        const conjuntoId = req.usuario?.conjuntoId || req.body?.conjuntoId;

        if (!conjuntoId) {
            return next();
        }

        const limites = await obtenerLimitesConjunto(conjuntoId);

        if (!limites) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        if (limites.maxVisitantes === Infinity) {
            return next();
        }

        // Contar visitantes activos (no los históricos)
        const visitantesActuales = await Visitante.countDocuments({
            conjunto: conjuntoId,
            estado: { $in: ['pendiente', 'aprobado', 'en_instalaciones'] }
        });

        if (visitantesActuales >= limites.maxVisitantes) {
            return res.status(403).json({
                error: "Límite de visitantes alcanzado",
                mensaje: `El plan ${limites.tipoPlan.toUpperCase()} permite máximo ${limites.maxVisitantes} visitantes activos. Actualmente hay ${visitantesActuales}.`,
                limite: limites.maxVisitantes,
                actual: visitantesActuales,
                plan: limites.tipoPlan
            });
        }

        next();
    } catch (error) {
        console.error("Error verificando límite de visitantes:", error);
        next();
    }
};

/**
 * Obtiene información de uso vs límites de un conjunto
 * Útil para mostrar en dashboard
 */
const obtenerUsoPlan = async (conjuntoId) => {
    const limites = await obtenerLimitesConjunto(conjuntoId);

    if (!limites) return null;

    const [usuarios, parqueaderos, visitantes] = await Promise.all([
        Usuario.countDocuments({ conjunto: conjuntoId, rol: { $ne: 'superadmin' } }),
        Parqueadero.countDocuments({ conjunto: conjuntoId }),
        Visitante.countDocuments({ conjunto: conjuntoId, estado: { $in: ['pendiente', 'aprobado', 'en_instalaciones'] } })
    ]);

    return {
        plan: limites.tipoPlan,
        usuarios: {
            actual: usuarios,
            limite: limites.maxUsuarios,
            porcentaje: limites.maxUsuarios === Infinity ? 0 : Math.round((usuarios / limites.maxUsuarios) * 100)
        },
        parqueaderos: {
            actual: parqueaderos,
            limite: limites.maxParqueaderos,
            porcentaje: limites.maxParqueaderos === Infinity ? 0 : Math.round((parqueaderos / limites.maxParqueaderos) * 100)
        },
        visitantes: {
            actual: visitantes,
            limite: limites.maxVisitantes,
            porcentaje: limites.maxVisitantes === Infinity ? 0 : Math.round((visitantes / limites.maxVisitantes) * 100)
        }
    };
};

module.exports = {
    LIMITES_POR_PLAN,
    verificarLimiteUsuarios,
    verificarLimiteParqueaderos,
    verificarLimiteVisitantes,
    obtenerLimitesConjunto,
    obtenerUsoPlan
};
