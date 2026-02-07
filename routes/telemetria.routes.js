const express = require("express");
const router = express.Router();
const Instalacion = require("../config/models/Instalacion");
const Usuario = require("../config/models/usuario");
const Parqueadero = require("../config/models/parqueadero");
const { verificarToken, esSuperAdmin } = require("../middlewares/auth.middleware");

// ========================================
// 📡 ENDPOINTS PARA INSTALACIONES ON-PREMISE
// ========================================

/**
 * POST /api/telemetria/heartbeat
 * Recibir heartbeat de una instalación on-premise
 * (No requiere autenticación - usa instalacionId como token)
 */
router.post("/heartbeat", async (req, res) => {
    try {
        const { instalacionId, nombre, version, stats, salud } = req.body;

        if (!instalacionId) {
            return res.status(400).json({ error: "instalacionId requerido" });
        }

        // Obtener IP pública del cliente
        const ipPublica = req.headers["x-forwarded-for"] ||
            req.connection.remoteAddress ||
            req.ip;

        // Buscar o crear instalación
        let instalacion = await Instalacion.findOne({ instalacionId });

        if (!instalacion) {
            // Primera vez que reporta - crear registro
            instalacion = new Instalacion({
                instalacionId,
                nombre: nombre || `Instalación ${instalacionId.substring(0, 8)}`,
                version,
                ipPublica
            });
            await instalacion.save();
            console.log(`📡 Nueva instalación registrada: ${instalacionId}`);
        }

        // Actualizar con datos del heartbeat
        await instalacion.actualizarDesdeHeartbeat({
            version,
            stats,
            salud,
            ipPublica
        });

        // Responder con configuración actualizada
        res.json({
            success: true,
            configuracion: instalacion.configuracion,
            mensaje: instalacion.configuracion.mensajePersonalizado || null
        });

    } catch (error) {
        console.error("Error en heartbeat:", error);
        res.status(500).json({ error: "Error procesando heartbeat" });
    }
});

// ========================================
// 📊 ENDPOINTS PARA SUPERADMIN
// ========================================

/**
 * GET /api/telemetria/instalaciones
 * Listar todas las instalaciones (SuperAdmin)
 */
router.get("/instalaciones", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const instalaciones = await Instalacion.find()
            .select("-historialHeartbeats") // Excluir historial pesado
            .sort({ ultimoHeartbeat: -1 });

        // Agregar estado en línea
        const resultado = instalaciones.map(inst => ({
            ...inst.toJSON(),
            enLinea: (Date.now() - inst.ultimoHeartbeat) < 10 * 60 * 1000
        }));

        res.json(resultado);
    } catch (error) {
        console.error("Error listando instalaciones:", error);
        res.status(500).json({ error: "Error listando instalaciones" });
    }
});

/**
 * GET /api/telemetria/instalaciones/:id
 * Obtener detalle de una instalación (incluye historial)
 */
router.get("/instalaciones/:id", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const instalacion = await Instalacion.findOne({
            instalacionId: req.params.id
        });

        if (!instalacion) {
            return res.status(404).json({ error: "Instalación no encontrada" });
        }

        res.json({
            ...instalacion.toJSON(),
            enLinea: (Date.now() - instalacion.ultimoHeartbeat) < 10 * 60 * 1000
        });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo instalación" });
    }
});

/**
 * PUT /api/telemetria/instalaciones/:id/config
 * Actualizar configuración remota de una instalación
 */
router.put("/instalaciones/:id/config", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const { configuracion, notas, cliente } = req.body;

        const instalacion = await Instalacion.findOne({
            instalacionId: req.params.id
        });

        if (!instalacion) {
            return res.status(404).json({ error: "Instalación no encontrada" });
        }

        // Actualizar configuración
        if (configuracion) {
            instalacion.configuracion = {
                ...instalacion.configuracion.toObject(),
                ...configuracion
            };
        }

        if (notas !== undefined) {
            instalacion.notas = notas;
        }

        if (cliente) {
            instalacion.cliente = { ...instalacion.cliente, ...cliente };
        }

        await instalacion.save();

        res.json({
            success: true,
            message: "Configuración actualizada",
            instalacion: instalacion.toJSON()
        });
    } catch (error) {
        console.error("Error actualizando config:", error);
        res.status(500).json({ error: "Error actualizando configuración" });
    }
});

/**
 * PUT /api/telemetria/instalaciones/:id/estado
 * Activar/desactivar instalación
 */
router.put("/instalaciones/:id/estado", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const { activa } = req.body;

        const instalacion = await Instalacion.findOneAndUpdate(
            { instalacionId: req.params.id },
            { activa },
            { new: true }
        );

        if (!instalacion) {
            return res.status(404).json({ error: "Instalación no encontrada" });
        }

        res.json({
            success: true,
            message: activa ? "Instalación activada" : "Instalación desactivada"
        });
    } catch (error) {
        res.status(500).json({ error: "Error actualizando estado" });
    }
});

/**
 * DELETE /api/telemetria/instalaciones/:id
 * Eliminar una instalación
 */
router.delete("/instalaciones/:id", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const instalacion = await Instalacion.findOneAndDelete({
            instalacionId: req.params.id
        });

        if (!instalacion) {
            return res.status(404).json({ error: "Instalación no encontrada" });
        }

        res.json({ success: true, message: "Instalación eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error eliminando instalación" });
    }
});

/**
 * GET /api/telemetria/estadisticas
 * Estadísticas globales de todas las instalaciones
 */
router.get("/estadisticas", verificarToken, esSuperAdmin, async (req, res) => {
    try {
        const instalaciones = await Instalacion.find();

        const diezMinutos = 10 * 60 * 1000;
        const ahora = Date.now();

        const stats = {
            totalInstalaciones: instalaciones.length,
            enLinea: instalaciones.filter(i => (ahora - i.ultimoHeartbeat) < diezMinutos).length,
            offline: instalaciones.filter(i => (ahora - i.ultimoHeartbeat) >= diezMinutos).length,
            totales: {
                usuarios: 0,
                plazas: 0,
                plazasOcupadas: 0,
                accesosHoy: 0
            }
        };

        instalaciones.forEach(inst => {
            if (inst.stats) {
                stats.totales.usuarios += inst.stats.usuarios?.total || 0;
                stats.totales.plazas += inst.stats.plazas?.total || 0;
                stats.totales.plazasOcupadas += inst.stats.plazas?.ocupadas || 0;
                stats.totales.accesosHoy += inst.stats.accesos?.hoy || 0;
            }
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo estadísticas" });
    }
});

module.exports = router;
