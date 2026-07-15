const express = require("express");
const router = express.Router();
// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { models, middlewares, logger } = require('../../index');
const { Visitante } = models;
const { verificarToken, esPorteriaOAdmin, getTenantFilter } = middlewares.auth;
const { verificarLimiteVisitantes } = middlewares.planLimits;
const { validateCreateVisitante, validateMongoId } = middlewares.validation;
const visitanteController = require('./visitante.controller');
const accesoService = require('./acceso.service');
const isProduction = process.env.NODE_ENV === 'production';

// Aislamiento tenant para handlers que operan sobre un visitante por ID:
// devuelve true si el solicitante puede actuar sobre ese visitante.
const perteneceAlConjunto = (req, visitante) => {
    if (!req.usuario || req.usuario.rol === 'superadmin') return true;
    const cSolic = req.usuario.conjunto?.toString() || req.usuario.conjuntoId?.toString();
    const cVis = visitante.conjunto?.toString();
    return !(cSolic && cVis && cSolic !== cVis);
};

// =======================================================
// 📌 Registrar visitante (con asignación automática de plaza)
// Requiere autenticación + verificar límite de plan
// =======================================================
router.post("/", verificarToken, verificarLimiteVisitantes, visitanteController.registrarVisitante);

// =======================================================
// 📌 Obtener todos los visitantes
// Requiere ser portero o admin
// =======================================================
router.get("/", verificarToken, esPorteriaOAdmin, visitanteController.obtenerVisitantes);

// =======================================================
// 📌 Obtener visitantes de un residente
// Requiere autenticación (residente ve sus propios visitantes)
// =======================================================
router.get("/misVisitantes/:residenteId", verificarToken, visitanteController.obtenerVisitantesPorResidente);

// =======================================================
// 📌 Eliminar visitante y liberar plaza
// Requiere autenticación
// =======================================================
router.delete("/eliminarVisitante/:residenteId/:visitanteId", verificarToken, visitanteController.eliminarVisitante);

// =======================================================
// 📌 Ver todas las plazas con visitantes
// Requiere ser portero o admin
// =======================================================
router.get("/parqueaderos", verificarToken, esPorteriaOAdmin, visitanteController.obtenerPlazasConVisitantes);

// =======================================================
// 📌 Editar visitante
// Requiere autenticación
// =======================================================
router.put("/editarVisitante/:visitanteId", verificarToken, visitanteController.editarVisitante);

// =======================================================
// 📌 QR - Generar código QR para visitante (Solo Admin)
// Este endpoint es para uso exclusivo de administradores.
// NOTA: Cada QR generado invalida el anterior.
// Para residentes, usar el flujo TOTP: GET /:visitanteId/codigo-actual
// luego el visitante verifica con POST /verificar-acceso
// =======================================================
router.post("/qr/generar/:visitanteId", verificarToken, esPorteriaOAdmin, async (req, res) => {
    try {
        const { visitanteId } = req.params;
        const { horasValidez = 24 } = req.body;

        const visitante = await Visitante.findById(visitanteId);
        if (!visitante) {
            return res.status(404).json({ error: "Visitante no encontrado" });
        }

        // 🏢 Un portero/admin solo genera QR de visitantes de su conjunto
        if (!perteneceAlConjunto(req, visitante)) {
            return res.status(403).json({ error: "No tienes permisos sobre este visitante" });
        }

        const token = visitante.generarQR(horasValidez);
        await visitante.save();

        // Generar URL del QR
        const baseUrl = process.env.FRONTEND_URL_PROD || `http://localhost:${process.env.PORT || 5000}`;
        const qrUrl = `${baseUrl}/api/visitantes/qr/verificar/${token}`;

        res.json({
            success: true,
            mensaje: "Código QR generado exitosamente",
            qr: {
                token,
                url: qrUrl,
                expiracion: visitante.qrExpiracion,
                visitante: {
                    id: visitante._id,
                    nombre: `${visitante.nombre} ${visitante.apellido}`,
                    placa: visitante.placaVehiculo
                }
            }
        });
    } catch (error) {
        logger.error("Error generando QR:", error);
        res.status(500).json({ error: "Error generando código QR", detalles: error.message });
    }
});

// =======================================================
// 📌 QR - Verificar código QR (escaneo en portería)
// =======================================================
router.get("/qr/verificar/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const visitante = await Visitante.buscarPorQR(token);
        if (!visitante) {
            return res.status(404).json({
                valid: false,
                error: "Código QR inválido o expirado"
            });
        }

        res.json({
            valid: true,
            mensaje: "Visitante autorizado",
            visitante: {
                id: visitante._id,
                nombre: visitante.nombre,
                apellido: visitante.apellido,
                cedula: visitante.cedula,
                placa: visitante.placaVehiculo,
                apartamentoDestino: visitante.apartamentoDestino,
                torreDestino: visitante.torreDestino,
                motivoVisita: visitante.motivoVisita,
                estado: visitante.estado,
                expiracion: visitante.qrExpiracion
            }
        });
    } catch (error) {
        logger.error("Error verificando QR:", error);
        res.status(500).json({ valid: false, error: "Error verificando código QR" });
    }
});

// =======================================================
// 📌 QR - Verificar Y registrar ingreso (público, usado por script Python)
// El token del QR actúa como autenticación: solo quien tiene el QR puede llamarlo.
// =======================================================
router.post("/qr/ingresar/:token", async (req, res) => {
    try {
        const visitante = await Visitante.buscarPorQR(req.params.token);
        if (!visitante) {
            return res.status(404).json({ valid: false, error: "QR inválido o expirado" });
        }

        const { yaIngreso } = await accesoService.registrarIngresoVisitante(visitante, { metodo: 'qr_scan' });

        return res.json({
            valid: true,
            ...(yaIngreso && { yaIngreso: true }),
            mensaje: yaIngreso
                ? `${visitante.nombre} ${visitante.apellido} ya se encuentra dentro`
                : `Ingreso registrado: ${visitante.nombre} ${visitante.apellido}`,
            visitante: {
                id: visitante._id,
                nombre: visitante.nombre,
                apellido: visitante.apellido,
                placa: visitante.placaVehiculo,
                estado: visitante.estado
            }
        });
    } catch (error) {
        logger.error("Error registrando ingreso por QR:", error);
        return res.status(500).json({ valid: false, error: error.message });
    }
});

// =======================================================
// 📌 PORTERIA - Registrar entrada del visitante por ID
// (cambia estado a 'ingresado' y crea HistorialAcceso)
// =======================================================
router.post("/:visitanteId/registrar-ingreso", verificarToken, esPorteriaOAdmin, async (req, res) => {
    try {
        const visitante = await Visitante.findById(req.params.visitanteId);
        if (!visitante) return res.status(404).json({ success: false, error: "Visitante no encontrado" });

        if (!perteneceAlConjunto(req, visitante)) {
            return res.status(403).json({ success: false, error: "No tienes permisos sobre este visitante" });
        }

        const { yaIngreso } = await accesoService.registrarIngresoVisitante(visitante, { metodo: 'manual_porteria' });
        if (yaIngreso) {
            return res.status(400).json({ success: false, error: "El visitante ya está dentro" });
        }

        res.json({ success: true, mensaje: `Ingreso registrado para ${visitante.nombre} ${visitante.apellido}` });
    } catch (error) {
        logger.error("Error registrando ingreso:", error);
        res.status(500).json({ success: false, error: "Error registrando ingreso" });
    }
});

// =======================================================
// 📌 PORTERIA - Registrar salida del visitante por ID
// =======================================================
router.post("/:visitanteId/registrar-salida", verificarToken, esPorteriaOAdmin, async (req, res) => {
    try {
        const visitante = await Visitante.findById(req.params.visitanteId);
        if (!visitante) return res.status(404).json({ success: false, error: "Visitante no encontrado" });

        if (!perteneceAlConjunto(req, visitante)) {
            return res.status(403).json({ success: false, error: "No tienes permisos sobre este visitante" });
        }

        const { yaSalio } = await accesoService.registrarSalidaVisitante(visitante, { metodo: 'manual_porteria' });
        if (yaSalio) {
            return res.status(400).json({ success: false, error: "El visitante ya salió" });
        }

        res.json({ success: true, mensaje: `Salida registrada para ${visitante.nombre} ${visitante.apellido}` });
    } catch (error) {
        logger.error("Error registrando salida:", error);
        res.status(500).json({ success: false, error: "Error registrando salida" });
    }
});

// =======================================================
// 📌 QR - Marcar ingreso del visitante
// =======================================================
router.post("/qr/ingreso/:token", async (req, res) => {
    try {
        const visitante = await Visitante.buscarPorQR(req.params.token);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Código QR inválido o expirado"
            });
        }

        // Ahora pasa por el servicio de acceso: gana idempotencia y registro
        // en historial (antes esta variante no escribía historialaccesos).
        await accesoService.registrarIngresoVisitante(visitante, { metodo: 'qr_scan' });

        res.json({
            success: true,
            mensaje: `Ingreso registrado para ${visitante.nombre} ${visitante.apellido}`,
            hora: new Date().toISOString()
        });
    } catch (error) {
        logger.error("Error registrando ingreso:", error);
        res.status(500).json({ success: false, error: "Error registrando ingreso" });
    }
});

// =======================================================
// 📌 QR - Marcar salida del visitante
// =======================================================
router.post("/qr/salida/:token", async (req, res) => {
    try {
        const visitante = await Visitante.buscarPorQR(req.params.token);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Código QR inválido o expirado"
            });
        }

        const { visitante: actualizado, yaSalio } = await accesoService.registrarSalidaPorQR(visitante);

        if (yaSalio) {
            // Otra request concurrente ya registró la salida → responder idempotente.
            return res.status(200).json({ success: true, mensaje: 'Salida ya estaba registrada' });
        }

        res.json({
            success: true,
            mensaje: `Salida registrada para ${actualizado.nombre} ${actualizado.apellido}`,
            hora: new Date().toISOString()
        });
    } catch (error) {
        logger.error("Error registrando salida:", error);
        res.status(500).json({ success: false, error: "Error registrando salida" });
    }
});

// =======================================================
// 📌 TOTP - Verificar acceso visitante (PÚBLICO - sin auth)
// =======================================================
router.post("/verificar-acceso", async (req, res) => {
    try {
        const { cedula, codigo, conjuntoId } = req.body;

        if (!cedula || !codigo) {
            return res.status(400).json({
                success: false,
                error: "Se requiere cédula y código de acceso"
            });
        }

        // Buscar visitante por cédula, acotando al conjunto si el cliente lo provee.
        // NOTA: el frontend público (VisitanteAcceso.jsx) aún no envía conjuntoId;
        // mientras tanto, si dos conjuntos comparten una cédula, findOne es no
        // determinista. Cerrar esto del todo requiere codificar el conjunto en la
        // URL/QR del visitante (decisión de producto — ver plan 007, fuera de alcance).
        const filtro = { cedula: cedula.trim() };
        if (conjuntoId) {
            filtro.conjunto = conjuntoId;
        }
        let visitante = await Visitante.findOne(filtro);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "No se encontró un visitante registrado con esa cédula"
            });
        }

        // Generar codigoSecreto si no existe (operación atómica para evitar race condition)
        if (!visitante.codigoSecreto) {
            const crypto = require('crypto');
            const nuevoSecreto = crypto.randomBytes(16).toString('hex');

            // Usar findOneAndUpdate para crear secreto si no existe
            const visitanteActualizado = await Visitante.findOneAndUpdate(
                { _id: visitante._id, $or: [{ codigoSecreto: null }, { codigoSecreto: { $exists: false } }] },
                { $set: { codigoSecreto: nuevoSecreto } },
                { new: true }
            );

            // Si se actualizó, usar el nuevo; si no, recargar con el existente
            if (visitanteActualizado) {
                visitante = visitanteActualizado;
            } else {
                // Otro proceso ya generó el secreto, recargar
                visitante = await Visitante.findById(visitante._id);
            }
        }

        // Log solo en desarrollo
        if (!isProduction) {
            const codigoEsperado = visitante.generarCodigoDinamico();
            logger.debug('Verificación TOTP:', { cedula, visitanteId: visitante._id, codigoEnviado: codigo, codigoEsperado });
        }

        // Verificar código dinámico
        if (!visitante.verificarCodigoDinamico(codigo.trim())) {
            return res.status(401).json({
                success: false,
                error: "Código inválido o expirado. Solicite uno nuevo al residente."
            });
        }

        // Generar QR válido por 24 horas
        visitante.generarQR(24);
        await visitante.save();

        // Construir URL de verificación
        const baseUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));

        res.json({
            success: true,
            visitante: {
                nombre: visitante.nombre,
                apellido: visitante.apellido,
                cedula: visitante.cedula,
                placa: visitante.placaVehiculo || null
            },
            qr: {
                token: visitante.qrToken,
                url: `${baseUrl}/api/visitantes/qr/verificar/${visitante.qrToken}`,
                expiracion: visitante.qrExpiracion
            }
        });

    } catch (error) {
        logger.error("Error verificando acceso:", error);
        res.status(500).json({ success: false, error: "Error en el servidor" });
    }
});

// =======================================================
// 📌 TOTP - Obtener código dinámico actual (para residente)
// =======================================================
router.get("/:visitanteId/codigo-actual", verificarToken, async (req, res) => {
    try {
        const { visitanteId } = req.params;

        // 🏢 Acotar al conjunto del solicitante (superadmin ve todos)
        const tenantFilter = getTenantFilter(req);
        let visitante = await Visitante.findOne({ _id: visitanteId, ...tenantFilter });
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Visitante no encontrado"
            });
        }

        // 🔒 Solo el residente que lo registró, o staff, pueden ver el código TOTP
        const esDueno = visitante.residenteId?.toString() === req.usuario?.id;
        const esStaff = ['admin', 'superadmin', 'porteria'].includes(req.usuario?.rol);
        if (!esDueno && !esStaff) {
            return res.status(403).json({
                success: false,
                error: "No tienes permisos para ver este código"
            });
        }

        // Generar codigoSecreto si no existe (operación atómica para evitar race condition)
        if (!visitante.codigoSecreto) {
            const crypto = require('crypto');
            const nuevoSecreto = crypto.randomBytes(16).toString('hex');

            const visitanteActualizado = await Visitante.findOneAndUpdate(
                { _id: visitante._id, $or: [{ codigoSecreto: null }, { codigoSecreto: { $exists: false } }] },
                { $set: { codigoSecreto: nuevoSecreto } },
                { new: true }
            );

            if (visitanteActualizado) {
                visitante = visitanteActualizado;
            } else {
                // El secreto ya existe, recargar
                visitante = await Visitante.findById(visitante._id);
            }
        }

        const codigoGenerado = visitante.generarCodigoDinamico();

        // Log solo en desarrollo
        if (!isProduction) {
            logger.debug('codigo-actual:', { visitanteId: visitante._id, codigoGenerado });
        }

        res.json({
            success: true,
            message: "Código generado",
            data: {
                codigo: codigoGenerado,
                expiraEn: visitante.tiempoRestanteCodigo(),
                intervalo: 600,
                visitante: {
                    nombre: visitante.nombre,
                    apellido: visitante.apellido
                }
            }
        });

    } catch (error) {
        logger.error("Error obteniendo código:", error);
        res.status(500).json({ success: false, error: "Error en el servidor" });
    }
});

module.exports = router;


