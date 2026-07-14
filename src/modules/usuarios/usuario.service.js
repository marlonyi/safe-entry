/**
 * Capa de servicio de Usuarios.
 * Contiene la lógica de negocio (consultas, validaciones de dominio) extraída
 * del controller, siguiendo el patrón de parqueadero.service.js /
 * visitante.service.js. Los handlers HTTP quedan como glue en el controller.
 *
 * Convención de errores: se lanza un Error con `.status` (código HTTP) y, si el
 * endpoint original devolvía una forma de respuesta especial, `.detalle` para
 * que el controller reproduzca EXACTAMENTE la misma respuesta.
 */
const mongoose = require('mongoose');
const Usuario = require('./usuario.model');
const Conjunto = require('../conjuntos/conjunto.model');

const errorHttp = (mensaje, status, detalle) => {
    const err = new Error(mensaje);
    err.status = status;
    if (detalle !== undefined) err.detalle = detalle;
    return err;
};

// SuperAdmin: cambiar el rol de un usuario.
const cambiarRol = async (id, nuevoRol) => {
    const rolesPermitidos = ['admin', 'porteria', 'residente'];
    if (!rolesPermitidos.includes(nuevoRol)) {
        throw errorHttp(`Rol no válido. Use: ${rolesPermitidos.join(', ')}`, 400);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw errorHttp('ID de usuario no válido', 400);
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) throw errorHttp('Usuario no encontrado', 404);
    if (usuario.rol === 'superadmin') {
        throw errorHttp('No se puede modificar el rol de un SuperAdmin', 403);
    }

    const rolAnterior = usuario.rol;
    usuario.rol = nuevoRol;
    await usuario.save();

    return { usuario, rolAnterior };
};

// SuperAdmin: mover un usuario a otro conjunto.
const moverAConjunto = async (id, conjuntoId) => {
    if (!conjuntoId || conjuntoId === '' || conjuntoId === 'null' || conjuntoId === 'undefined') {
        throw errorHttp('Debe seleccionar un conjunto válido', 400, `Valor recibido: "${conjuntoId}"`);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw errorHttp('ID de usuario no válido', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(conjuntoId)) {
        throw errorHttp('ID de conjunto no válido', 400, `El valor "${conjuntoId}" no es un ID de MongoDB válido`);
    }

    const conjunto = await Conjunto.findById(conjuntoId);
    if (!conjunto) throw errorHttp('Conjunto no encontrado', 404);

    const usuario = await Usuario.findById(id);
    if (!usuario) throw errorHttp('Usuario no encontrado', 404);
    if (usuario.rol === 'superadmin') throw errorHttp('No se puede mover a un SuperAdmin', 403);

    usuario.conjunto = conjuntoId;
    await usuario.save();

    return { usuario, conjunto };
};

module.exports = { cambiarRol, moverAConjunto };
