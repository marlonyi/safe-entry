const express = require("express");
const router = express.Router();
const visitanteController = require("../controllers/visitanteController");
const Parqueadero = require("../config/models/parqueadero");
const Visitante = require("../config/models/visitante");
const { verificarToken, esPorteriaOAdmin } = require("../middlewares/auth.middleware");

// =======================================================
// 📌 Registrar visitante (con asignación automática de plaza)
// Requiere autenticación
// =======================================================
router.post("/", verificarToken, visitanteController.registrarVisitante);

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
// 📌 QR - Generar código QR para visitante
// =======================================================
router.post("/qr/generar/:visitanteId", async (req, res) => {
    try {
        const { visitanteId } = req.params;
        const { horasValidez = 24 } = req.body;

        const visitante = await Visitante.findById(visitanteId);
        if (!visitante) {
            return res.status(404).json({ error: "Visitante no encontrado" });
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
        console.error("Error generando QR:", error);
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
        console.error("Error verificando QR:", error);
        res.status(500).json({ valid: false, error: "Error verificando código QR" });
    }
});

// =======================================================
// 📌 QR - Marcar ingreso del visitante
// =======================================================
router.post("/qr/ingreso/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const visitante = await Visitante.buscarPorQR(token);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Código QR inválido o expirado"
            });
        }

        visitante.estado = 'ingresado';
        await visitante.save();

        res.json({
            success: true,
            mensaje: `Ingreso registrado para ${visitante.nombre} ${visitante.apellido}`,
            hora: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error registrando ingreso:", error);
        res.status(500).json({ success: false, error: "Error registrando ingreso" });
    }
});

// =======================================================
// 📌 QR - Marcar salida del visitante
// =======================================================
router.post("/qr/salida/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const visitante = await Visitante.buscarPorQR(token);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Código QR inválido o expirado"
            });
        }

        visitante.estado = 'salido';
        // Invalidar QR después de salir
        visitante.qrToken = null;
        visitante.qrExpiracion = null;
        await visitante.save();

        res.json({
            success: true,
            mensaje: `Salida registrada para ${visitante.nombre} ${visitante.apellido}`,
            hora: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error registrando salida:", error);
        res.status(500).json({ success: false, error: "Error registrando salida" });
    }
});

// =======================================================
// 📌 TOTP - Verificar acceso visitante (PÚBLICO - sin auth)
// =======================================================
router.post("/verificar-acceso", async (req, res) => {
    try {
        const { cedula, codigo } = req.body;

        if (!cedula || !codigo) {
            return res.status(400).json({
                success: false,
                error: "Se requiere cédula y código de acceso"
            });
        }

        // Buscar visitante por cédula
        const visitante = await Visitante.findOne({ cedula: cedula.trim() });
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

        // DEBUG: Log para diagnosticar
        const codigoEsperado = visitante.generarCodigoDinamico();
        console.log('🔐 DEBUG Verificación TOTP:');
        console.log('   Cédula:', cedula);
        console.log('   Visitante ID:', visitante._id);
        console.log('   Código enviado:', codigo);
        console.log('   Código esperado:', codigoEsperado);
        console.log('   codigoSecreto (primeros 8 chars):', visitante.codigoSecreto ? visitante.codigoSecreto.substring(0, 8) : 'NO EXISTE');

        // Verificar código dinámico
        if (!visitante.verificarCodigoDinamico(codigo.trim())) {
            console.log('   ❌ Código NO coincide');
            return res.status(401).json({
                success: false,
                error: "Código inválido o expirado. Solicite uno nuevo al residente."
            });
        }
        console.log('   ✅ Código VÁLIDO');

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
                url: `${baseUrl}/verificar/${visitante.qrToken}`,
                expiracion: visitante.qrExpiracion
            }
        });

    } catch (error) {
        console.error("Error verificando acceso:", error);
        res.status(500).json({ success: false, error: "Error en el servidor" });
    }
});

// =======================================================
// 📌 TOTP - Obtener código dinámico actual (para residente)
// =======================================================
router.get("/:visitanteId/codigo-actual", async (req, res) => {
    try {
        const { visitanteId } = req.params;

        let visitante = await Visitante.findById(visitanteId);
        if (!visitante) {
            return res.status(404).json({
                success: false,
                error: "Visitante no encontrado"
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

        // DEBUG log para comparar
        const codigoGenerado = visitante.generarCodigoDinamico();
        console.log('📋 DEBUG codigo-actual:');
        console.log('   Visitante ID:', visitante._id);
        console.log('   Código generado:', codigoGenerado);
        console.log('   codigoSecreto (primeros 8 chars):', visitante.codigoSecreto ? visitante.codigoSecreto.substring(0, 8) : 'NO EXISTE');

        res.json({
            success: true,
            codigo: codigoGenerado,
            expiraEn: visitante.tiempoRestanteCodigo(),
            intervalo: 600, // 10 minutos en segundos
            visitante: {
                nombre: visitante.nombre,
                apellido: visitante.apellido
            }
        });

    } catch (error) {
        console.error("Error obteniendo código:", error);
        res.status(500).json({ success: false, error: "Error en el servidor" });
    }
});

module.exports = router;

