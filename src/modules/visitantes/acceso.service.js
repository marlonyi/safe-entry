/**
 * Servicio de Acceso de Visitantes
 *
 * Dueño único del ciclo validar → idempotencia → cambio de estado →
 * registro en historial. Antes este esqueleto estaba duplicado ~5 veces
 * como closures inline en visitante.routes.js, con formas de HistorialAcceso
 * divergentes y sin liberar la plaza de forma consistente.
 *
 * Los handlers HTTP quedan como adaptadores delgados sobre estas funciones.
 */
const Visitante = require('./visitante.model');
const HistorialAcceso = require('../../shared/models/historialAcceso');
const parqueaderoService = require('../parqueaderos/parqueadero.service');

const nombreCompleto = (v) => `${v.nombre} ${v.apellido}`;

/**
 * Registra el ingreso de un visitante (QR o manual).
 * Idempotente: si ya está 'ingresado' devuelve { yaIngreso: true } sin duplicar historial.
 */
const registrarIngresoVisitante = async (visitante, { metodo }) => {
    if (visitante.estado === 'ingresado') {
        return { visitante, yaIngreso: true };
    }

    visitante.estado = 'ingresado';
    await visitante.save();

    await HistorialAcceso.registrar({
        conjunto: visitante.conjunto,
        placa: visitante.placaVehiculo,
        tipoAcceso: 'entrada',
        tipoUsuario: 'visitante',
        nombreUsuario: nombreCompleto(visitante),
        metodo
    });

    return { visitante, yaIngreso: false };
};

/**
 * Registra la salida de un visitante (flujo manual de portería).
 * Devuelve { yaSalio: true } si ya estaba 'salido' (sin escribir historial).
 * Libera la plaza asociada vía el dueño de la máquina de estados.
 */
const registrarSalidaVisitante = async (visitante, { metodo }) => {
    if (visitante.estado === 'salido') {
        return { visitante, yaSalio: true };
    }

    visitante.estado = 'salido';
    await visitante.save();

    if (visitante.parqueadero) {
        await parqueaderoService.liberarPlazaVisitante(visitante.parqueadero);
        visitante.parqueadero = null;
        await visitante.save();
    }

    await HistorialAcceso.registrar({
        conjunto: visitante.conjunto,
        placa: visitante.placaVehiculo,
        tipoAcceso: 'salida',
        tipoUsuario: 'visitante',
        nombreUsuario: nombreCompleto(visitante),
        metodo
    });

    return { visitante, yaSalio: false };
};

/**
 * Salida por QR: transición ATÓMICA (solo una request concurrente pasa de
 * !salido→salido), invalida el QR, libera la plaza y registra historial.
 * Devuelve { yaSalio: true } si otra request ya registró la salida.
 */
const registrarSalidaPorQR = async (visitante) => {
    const actualizado = await Visitante.findOneAndUpdate(
        { _id: visitante._id, estado: { $ne: 'salido' } },
        { $set: { estado: 'salido', qrToken: null, qrExpiracion: null } },
        { new: true }
    );

    if (!actualizado) {
        return { visitante, yaSalio: true };
    }

    if (actualizado.parqueadero) {
        await parqueaderoService.liberarPlazaVisitante(actualizado.parqueadero);
    }

    await HistorialAcceso.registrar({
        conjunto: actualizado.conjunto,
        placa: actualizado.placaVehiculo,
        tipoAcceso: 'salida',
        tipoUsuario: 'visitante',
        nombreUsuario: nombreCompleto(actualizado),
        metodo: 'qr_scan'
    });

    return { visitante: actualizado, yaSalio: false };
};

module.exports = {
    registrarIngresoVisitante,
    registrarSalidaVisitante,
    registrarSalidaPorQR
};
