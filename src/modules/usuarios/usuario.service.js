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
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Usuario = require('./usuario.model');
const Conjunto = require('../conjuntos/conjunto.model');
const Visitante = require('../visitantes/visitante.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');
const { escaparRegex } = require('../../shared/utils/regexHelper');

// String aleatorio CRIPTOGRÁFICAMENTE seguro (passwords temporales).
// crypto.randomInt (sin sesgo de módulo), no Math.random().
const generarStringAleatorioSeguro = (chars, length) => {
    let resultado = '';
    for (let i = 0; i < length; i++) {
        resultado += chars.charAt(crypto.randomInt(chars.length));
    }
    return resultado;
};

const errorHttp = (mensaje, status, detalle) => {
    const err = new Error(mensaje);
    err.status = status;
    if (detalle !== undefined) err.detalle = detalle;
    return err;
};

/**
 * Autenticación por cédula/password con desambiguación multi-conjunto.
 * NO toca HTTP ni auditoría ni rate-limit (eso queda en el controller):
 * devuelve un resultado discriminado que el controller mapea a respuestas.
 *
 * resultado ∈ {
 *   'ok'                  → { usuario, esSuperadminDirecto? }
 *   'no_encontrado'       → cédula sin usuarios
 *   'seleccion_requerida' → { conjuntos } múltiples perfiles activos
 *   'sin_conjuntos_activos'
 *   'no_en_conjunto'      → conjuntoId dado no matchea
 *   'password_incorrecta'
 *   'conjunto_inactivo'
 * }
 */
const login = async ({ cedula, password, conjuntoId }) => {
    // Puede haber múltiples usuarios con la misma cédula en diferentes conjuntos
    const usuarios = await Usuario.find({ cedula }).populate('conjunto', 'nombre estado');

    if (usuarios.length === 0) {
        return { resultado: 'no_encontrado' };
    }

    // Atajo: si hay un superadmin y la contraseña coincide, entrar directo.
    // El superadmin no pertenece a un conjunto; no tiene sentido pedirle elegir uno.
    if (!conjuntoId) {
        const superadminMatch = usuarios.find(u => u.rol === 'superadmin');
        if (superadminMatch && await bcrypt.compare(password, superadminMatch.password)) {
            return { resultado: 'ok', usuario: superadminMatch, esSuperadminDirecto: true };
        }
    }

    // Desambiguación cuando la cédula existe en múltiples conjuntos
    if (usuarios.length > 1 && !conjuntoId) {
        const conjuntosDisponibles = usuarios
            .filter(u => u.rol !== 'superadmin')
            .map(u => (u.conjunto && u.conjunto.estado === 'activo')
                ? { conjuntoId: u.conjunto._id.toString(), conjuntoNombre: u.conjunto.nombre }
                : null)
            .filter(c => c !== null);

        if (conjuntosDisponibles.length === 0) {
            return { resultado: 'sin_conjuntos_activos' };
        }

        if (conjuntosDisponibles.length === 1) {
            const unicoUsuario = usuarios.find(u =>
                u.rol !== 'superadmin' &&
                u.conjunto && u.conjunto._id.toString() === conjuntosDisponibles[0].conjuntoId
            );
            if (unicoUsuario) {
                usuarios.length = 0;
                usuarios.push(unicoUsuario);
            } else {
                return { resultado: 'seleccion_requerida', conjuntos: conjuntosDisponibles };
            }
        } else {
            return { resultado: 'seleccion_requerida', conjuntos: conjuntosDisponibles };
        }
    }

    // Seleccionar el usuario correcto
    let usuario;
    if (conjuntoId) {
        usuario = conjuntoId === 'superadmin'
            ? usuarios.find(u => u.rol === 'superadmin')
            : usuarios.find(u => u.conjunto && u.conjunto._id.toString() === conjuntoId);
        if (!usuario) return { resultado: 'no_en_conjunto' };
    } else {
        usuario = usuarios[0];
    }

    if (!await bcrypt.compare(password, usuario.password)) {
        return { resultado: 'password_incorrecta' };
    }

    if (usuario.rol !== 'superadmin' && usuario.conjunto && usuario.conjunto.estado !== 'activo') {
        return { resultado: 'conjunto_inactivo' };
    }

    return { resultado: 'ok', usuario };
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

// El propio usuario cambia su contraseña (verificando la actual).
const cambiarPassword = async (userId, passwordActual, passwordNueva) => {
    if (!passwordActual || !passwordNueva) {
        throw errorHttp('Debe proporcionar la contraseña actual y la nueva contraseña', 400);
    }
    if (passwordNueva.length < 6) {
        throw errorHttp('La nueva contraseña debe tener al menos 6 caracteres', 400);
    }

    const usuario = await Usuario.findById(userId).select('+password');
    if (!usuario) throw errorHttp('Usuario no encontrado', 404);

    const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
    if (!passwordValida) {
        // El endpoint original respondía { error } (sin success:false) → customError.
        const err = errorHttp('La contraseña actual es incorrecta', 401);
        err.customError = true;
        throw err;
    }

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(passwordNueva, salt);
    await usuario.save();

    return usuario;
};

/**
 * Crear usuario: sanitización, validaciones de dominio, unicidad por conjunto,
 * hash y persistencia. `adminCedula` es la cédula reservada del sistema.
 */
const crearUsuario = async (body, { conjuntoId, adminCedula }) => {
    let {
        nombre, apellido, cedula, apartamento, torre,
        fechaIngreso, fechaRetiro, estadoExpensa,
        tieneVehiculo, placaVehiculo, password, rol
    } = body;

    // Sanitizar strings para prevenir XSS
    const sanitize = (str) => str ? String(str).trim().replace(/<[^>]*>/g, '') : '';
    nombre = sanitize(nombre);
    apellido = sanitize(apellido);
    cedula = sanitize(cedula);
    apartamento = sanitize(apartamento);
    torre = sanitize(torre);
    placaVehiculo = placaVehiculo ? sanitize(placaVehiculo).toUpperCase() : null;

    if (!nombre || nombre.length < 2) {
        throw errorHttp("El nombre debe tener al menos 2 caracteres", 400);
    }
    if (!apellido || apellido.length < 2) {
        throw errorHttp("El apellido debe tener al menos 2 caracteres", 400);
    }
    if (!cedula || !/^\d{6,12}$/.test(cedula.replace(/\D/g, ''))) {
        throw errorHttp("La cédula debe tener entre 6 y 12 dígitos", 400);
    }
    if (!password || password.length < 4) {
        throw errorHttp("La contraseña debe tener al menos 4 caracteres", 400);
    }
    // Placa colombiana: ABC123, ABC-123, ABC12D (motos/eléctricos)
    if (placaVehiculo && !/^[A-Z]{3}-?(\d{3}|\d{2}[A-Z])$/.test(placaVehiculo)) {
        throw errorHttp("Formato de placa inválido. Use: ABC123, ABC-123 o ABC12D", 400);
    }

    const estadosPermitidos = ['al dia', 'en mora'];
    if (estadoExpensa && !estadosPermitidos.includes(estadoExpensa)) {
        throw errorHttp(`Estado de expensa no válido. Use: ${estadosPermitidos.join(' o ')}`, 400);
    }

    if (cedula === adminCedula) {
        throw errorHttp("No puedes registrar un usuario con esta cédula", 400);
    }

    const usuarioExistente = await Usuario.findOne({ cedula, conjunto: conjuntoId });
    if (usuarioExistente) {
        throw errorHttp("El usuario ya existe en este conjunto", 400);
    }

    tieneVehiculo = tieneVehiculo === "Si" || tieneVehiculo === true;
    if (tieneVehiculo && !placaVehiculo) {
        throw errorHttp("Debe ingresar la placa del vehículo", 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = new Usuario({
        conjunto: conjuntoId,
        nombre,
        apellido,
        cedula,
        // Para porteros, apartamento y torre pueden estar vacíos
        apartamento: apartamento || (rol === 'porteria' ? 'N/A' : ''),
        torre: torre || (rol === 'porteria' ? 'N/A' : ''),
        fechaIngreso,
        fechaRetiro: fechaRetiro || null,
        estadoExpensa: estadoExpensa || 'al dia',
        tieneVehiculo,
        placaVehiculo: tieneVehiculo ? placaVehiculo : null,
        password: passwordHash,
        rol: rol || 'residente'
    });

    await nuevoUsuario.save();
    return nuevoUsuario;
};

/**
 * Listado combinado de usuarios y visitantes con búsqueda segura ($regex
 * escapado), filtro de rol, tenant y paginación opcional.
 */
const listarUsuariosYVisitantes = async (tenantFilter, { page = 1, limit = 0, search = '', rol = 'todos' }) => {
    const searchSeguro = escaparRegex(search);
    const camposBusqueda = (s) => ([
        { nombre: { $regex: s, $options: 'i' } },
        { apellido: { $regex: s, $options: 'i' } },
        { cedula: { $regex: s, $options: 'i' } },
        { placaVehiculo: { $regex: s, $options: 'i' } }
    ]);

    let query = { ...tenantFilter };
    if (search) {
        query.$or = camposBusqueda(searchSeguro);
        // Si hay búsqueda Y filtro de tenant, combinar con $and
        if (tenantFilter.conjunto) {
            query = { $and: [tenantFilter, { $or: camposBusqueda(searchSeguro) }] };
        }
    }
    if (rol !== 'todos') {
        if (query.$and) {
            query.$and.push({ rol });
        } else {
            query.rol = rol;
        }
    }

    let visitantesFilter = { ...tenantFilter };
    if (search) {
        if (tenantFilter.conjunto) {
            visitantesFilter = { $and: [tenantFilter, { $or: camposBusqueda(searchSeguro) }] };
        } else {
            visitantesFilter.$or = camposBusqueda(searchSeguro);
        }
    }

    // Se excluye fotoPerfil (base64 de hasta ~2.8MB por usuario) del listado.
    let usuariosQuery = Usuario.find(query, '-password -__v -fotoPerfil').populate('conjunto', 'nombre');
    let visitantesQuery = Visitante.find(visitantesFilter, '-__v').populate('conjunto', 'nombre');

    if (limit > 0) {
        const skip = (page - 1) * limit;
        usuariosQuery = usuariosQuery.skip(skip).limit(limit);
        visitantesQuery = visitantesQuery.skip(skip).limit(limit);
    }

    const [usuarios, visitantes, totalUsuarios, totalVisitantes] = await Promise.all([
        usuariosQuery.lean(),
        visitantesQuery.lean(),
        Usuario.countDocuments(query),
        Visitante.countDocuments(visitantesFilter)
    ]);

    return { usuarios, visitantes, totalUsuarios, totalVisitantes };
};

/**
 * Aplicar actualización con whitelist anti-escalada. `puedeCamposPrivilegiados`
 * habilita rol/cedula/estadoExpensa (solo admin/superadmin). conjunto y
 * password nunca por esta vía (endpoints dedicados).
 * Devuelve { anterior, actualizado, cambios }.
 */
const actualizarUsuario = async (id, body, { puedeCamposPrivilegiados }) => {
    const CAMPOS_BASICOS = ['nombre', 'apellido', 'apartamento', 'torre', 'tieneVehiculo', 'placaVehiculo', 'placa2Vehiculo'];
    const CAMPOS_PRIVILEGIADOS = ['rol', 'cedula', 'estadoExpensa'];

    const datos = {};
    for (const campo of CAMPOS_BASICOS) {
        if (body[campo] !== undefined) datos[campo] = body[campo];
    }
    if (puedeCamposPrivilegiados) {
        for (const campo of CAMPOS_PRIVILEGIADOS) {
            if (body[campo] !== undefined) datos[campo] = body[campo];
        }
    }

    // Quitar undefined o vacíos para no sobreescribir
    Object.keys(datos).forEach(key => {
        if (datos[key] === undefined || datos[key] === "") {
            delete datos[key];
        }
    });

    const anterior = await Usuario.findById(id).lean();
    if (!anterior) throw errorHttp("Usuario no encontrado", 404);

    const actualizado = await Usuario.findByIdAndUpdate(
        id,
        { $set: datos },
        { new: true, runValidators: true }
    );

    const cambios = {};
    Object.keys(datos).forEach(key => {
        if (anterior[key] !== datos[key]) {
            cambios[key] = { antes: anterior[key], despues: datos[key] };
        }
    });

    return { anterior, actualizado, cambios };
};

/**
 * SuperAdmin: crear admin de un conjunto con password temporal cripto-segura.
 * Devuelve { nuevoAdmin, conjunto, passwordTemporal }.
 */
const crearAdminRapido = async ({ conjuntoId, nombre, apellido, cedula, email }) => {
    if (!conjuntoId) throw errorHttp("El ID del conjunto es requerido", 400);
    if (!mongoose.Types.ObjectId.isValid(conjuntoId)) throw errorHttp("ID de conjunto inválido", 400);

    const conjunto = await Conjunto.findById(conjuntoId);
    if (!conjunto) throw errorHttp("Conjunto no encontrado", 404);

    if (!nombre || !apellido || !cedula) {
        throw errorHttp("Nombre, apellido y cédula son requeridos", 400);
    }

    const existente = await Usuario.findOne({ cedula, conjunto: conjuntoId });
    if (existente) throw errorHttp("Ya existe un usuario con esa cédula en este conjunto", 400);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const passwordTemporal = generarStringAleatorioSeguro(chars, 8);
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

    const nuevoAdmin = new Usuario({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cedula: cedula.trim(),
        email: email?.trim() || null,
        password: hashedPassword,
        rol: 'admin',
        conjunto: conjuntoId
    });
    await nuevoAdmin.save();

    return { nuevoAdmin, conjunto, passwordTemporal };
};

/**
 * SuperAdmin: restablecer contraseña (genera temporal si no se provee).
 * Devuelve { usuario, passwordTemporal } — passwordTemporal solo si fue generada.
 */
const restablecerPassword = async (id, nuevaPassword) => {
    let password = nuevaPassword;
    if (!password) {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        password = generarStringAleatorioSeguro(chars, 8);
    }

    if (password.length < 6) {
        throw errorHttp("La contraseña debe tener al menos 6 caracteres", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw errorHttp("ID de usuario no válido", 400);
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) throw errorHttp("Usuario no encontrado", 404);

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(password, salt);
    await usuario.save();

    return { usuario, passwordTemporal: !nuevaPassword ? password : undefined };
};

/**
 * SuperAdmin: snapshot completo de un conjunto para exportación.
 * La serialización (JSON/CSV, headers) es del controller.
 */
const exportarDatosConjunto = async (conjuntoId) => {
    const conjunto = await Conjunto.findById(conjuntoId);
    if (!conjunto) throw errorHttp("Conjunto no encontrado", 404);

    const [usuarios, visitantes, parqueaderos] = await Promise.all([
        Usuario.find({ conjunto: conjuntoId }).select('-password -__v').lean(),
        Visitante.find({ conjunto: conjuntoId }).select('-__v').lean(),
        Parqueadero.find({ conjunto: conjuntoId }).select('-__v').lean()
    ]);

    return { conjunto, usuarios, visitantes, parqueaderos };
};

module.exports = {
    login,
    crearUsuario,
    listarUsuariosYVisitantes,
    actualizarUsuario,
    cambiarRol,
    moverAConjunto,
    cambiarPassword,
    crearAdminRapido,
    restablecerPassword,
    exportarDatosConjunto,
    generarStringAleatorioSeguro
};
