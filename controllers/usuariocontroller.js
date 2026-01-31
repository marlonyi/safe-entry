const Usuario = require("../config/models/usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AuditLog = require("../config/models/auditLog");
const logger = require("../config/logger");

// Verificar ambiente
const isProduction = process.env.NODE_ENV === 'production';

// Credenciales admin desde variables de entorno
// En desarrollo usa valores por defecto, en producción DEBE configurarse
const ADMIN_CEDULA = process.env.ADMIN_CEDULA || "99999999";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isProduction ? null : "admin123");
const JWT_SECRET = process.env.JWT_SECRET || "secreto"; // Debe coincidir con auth.middleware.js

// Validar configuración crítica en producción
if (isProduction && !ADMIN_PASSWORD) {
    console.error('⚠️ SEGURIDAD CRÍTICA: ADMIN_PASSWORD no configurado en producción');
}
if (isProduction && !JWT_SECRET) {
    console.error('⚠️ SEGURIDAD CRÍTICA: JWT_SECRET no configurado en producción');
}

const ADMIN_INFO = {
    id: "admin",
    nombre: "Administrador",
    apellido: "Sistema",
    cedula: ADMIN_CEDULA,
    rol: "admin"
};

// Helper para manejar errores (oculta detalles en producción)
const getErrorDetails = (error) => {
    if (isProduction) {
        logger.error('Error:', error.message);
        return undefined; // No exponer detalles en producción
    }
    return error.message;
};

// Crear un nuevo usuario
exports.crearUsuario = async (req, res) => {
    try {
        let {
            nombre, apellido, cedula, apartamento, torre,
            fechaIngreso, fechaRetiro, estadoExpensa,
            tieneVehiculo, placaVehiculo, password, rol
        } = req.body;

        // ========== VALIDACIÓN Y SANITIZACIÓN DE ENTRADA ==========
        // Sanitizar strings para prevenir XSS
        const sanitize = (str) => str ? String(str).trim().replace(/<[^>]*>/g, '') : '';
        nombre = sanitize(nombre);
        apellido = sanitize(apellido);
        cedula = sanitize(cedula);
        apartamento = sanitize(apartamento);
        torre = sanitize(torre);
        placaVehiculo = placaVehiculo ? sanitize(placaVehiculo).toUpperCase() : null;

        // Validar campos requeridos
        if (!nombre || nombre.length < 2) {
            return res.status(400).json({ error: "El nombre debe tener al menos 2 caracteres" });
        }
        if (!apellido || apellido.length < 2) {
            return res.status(400).json({ error: "El apellido debe tener al menos 2 caracteres" });
        }
        if (!cedula || !/^\d{6,12}$/.test(cedula.replace(/\D/g, ''))) {
            return res.status(400).json({ error: "La cédula debe tener entre 6 y 12 dígitos" });
        }
        if (!password || password.length < 4) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 4 caracteres" });
        }

        // Validar formato de placa colombiana (opcional)
        if (placaVehiculo && !/^[A-Z]{3}-?\d{3}$/.test(placaVehiculo)) {
            return res.status(400).json({ error: "Formato de placa inválido. Use: ABC123 o ABC-123" });
        }

        // Log solo en desarrollo
        if (!isProduction) {
            logger.debug("Datos recibidos:", { nombre, apellido, cedula, rol, tieneVehiculo, placaVehiculo });
        }

        const estadosPermitidos = ['al dia', 'en mora'];
        if (estadoExpensa && !estadosPermitidos.includes(estadoExpensa)) {
            return res.status(400).json({
                error: `Estado de expensa no válido. Use: ${estadosPermitidos.join(' o ')}`
            });
        }

        if (cedula === ADMIN_CEDULA) {
            return res.status(400).json({ error: "No puedes registrar un usuario con esta cédula" });
        }

        const usuarioExistente = await Usuario.findOne({ cedula });
        if (usuarioExistente) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }

        tieneVehiculo = tieneVehiculo === "Si" || tieneVehiculo === true;

        if (tieneVehiculo && !placaVehiculo) {
            return res.status(400).json({ error: "Debe ingresar la placa del vehículo" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Para porteros, apartamento y torre pueden estar vacíos
        // Para otros roles, usamos valores por defecto si no vienen
        const nuevoUsuario = new Usuario({
            nombre,
            apellido,
            cedula,
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

        // Registrar en auditoría - obtener info del usuario que ejecuta la acción
        const usuarioEjecutor = req.usuarioLogueado || req.body.ejecutadoPor || null;
        if (usuarioEjecutor) {
            await AuditLog.registrar({
                usuario: {
                    id: usuarioEjecutor.id,
                    cedula: usuarioEjecutor.cedula,
                    nombre: usuarioEjecutor.nombre,
                    rol: usuarioEjecutor.rol
                },
                accion: 'CREATE_USER',
                descripcion: `Creó usuario: ${nombre} ${apellido} (${rol || 'residente'})`,
                recurso: {
                    tipo: 'usuario',
                    id: nuevoUsuario._id.toString(),
                    nombre: `${nombre} ${apellido}`,
                    datosAnteriores: null,
                    datosNuevos: {
                        nombre,
                        apellido,
                        cedula,
                        apartamento: nuevoUsuario.apartamento,
                        torre: nuevoUsuario.torre,
                        rol: nuevoUsuario.rol,
                        placaVehiculo: nuevoUsuario.placaVehiculo
                    }
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        }

        res.status(201).json({
            mensaje: "Usuario creado exitosamente",
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                cedula: nuevoUsuario.cedula,
                rol: nuevoUsuario.rol
            }
        });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        res.status(500).json({
            error: "Error al crear el usuario",
            detalles: getErrorDetails(error)
        });
    }
};

// Login de usuario
exports.loginUsuario = async (req, res) => {
    try {
        const { cedula, password, conjuntoId } = req.body; // conjuntoId opcional para casos de múltiples matches
        const { audit } = require('../middlewares/audit.middleware');
        const { recordFailedLogin, resetLoginAttempts } = require('../middlewares/rateLimit.middleware');

        // Helper para generar tokens (ahora incluye conjuntoId)
        const generateTokens = (payload) => {
            const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
            const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: "7d" });
            return { accessToken, refreshToken };
        };

        // ========== BUSCAR USUARIO(S) POR CÉDULA ==========
        // Puede haber múltiples usuarios con la misma cédula en diferentes conjuntos
        const usuarios = await Usuario.find({ cedula }).populate('conjunto', 'nombre estado');

        if (usuarios.length === 0) {
            // También verificar login de admin hardcoded (legacy)
            if (cedula === ADMIN_CEDULA && password === ADMIN_PASSWORD) {
                const { accessToken, refreshToken } = generateTokens({
                    id: "admin",
                    rol: "superadmin",
                    conjuntoId: null // SuperAdmin no tiene conjunto
                });
                resetLoginAttempts(req);
                await audit.loginSuccess(req, { ...ADMIN_INFO, rol: 'superadmin' });
                return res.json({
                    token: accessToken,
                    refreshToken,
                    expiresIn: 7200,
                    usuario: { ...ADMIN_INFO, rol: 'superadmin' }
                });
            }

            const result = recordFailedLogin(req);
            await audit.loginFailed(req, cedula, 'Usuario no encontrado');
            return res.status(400).json({
                error: "Usuario no encontrado",
                attemptsRemaining: result.attemptsRemaining
            });
        }

        // ========== MANEJO DE MÚLTIPLES CONJUNTOS ==========
        // Si hay múltiples usuarios con la misma cédula en diferentes conjuntos
        if (usuarios.length > 1 && !conjuntoId) {
            // Si no se especificó conjunto, devolver lista para que el usuario elija
            const conjuntosDisponibles = usuarios
                .filter(u => u.conjunto && u.conjunto.estado === 'activo')
                .map(u => ({
                    conjuntoId: u.conjunto._id,
                    conjuntoNombre: u.conjunto.nombre
                }));

            if (conjuntosDisponibles.length === 0) {
                return res.status(400).json({
                    error: "No hay conjuntos activos para este usuario"
                });
            }

            return res.status(300).json({
                mensaje: "Seleccione el conjunto al que desea ingresar",
                conjuntos: conjuntosDisponibles,
                requiereSeleccion: true
            });
        }

        // Seleccionar el usuario correcto
        let usuario;
        if (conjuntoId) {
            // Si se especificó conjunto, buscar ese específicamente
            usuario = usuarios.find(u =>
                u.conjunto && u.conjunto._id.toString() === conjuntoId
            );
            if (!usuario) {
                return res.status(400).json({ error: "Usuario no encontrado en ese conjunto" });
            }
        } else {
            // Un solo usuario encontrado o es superadmin
            usuario = usuarios[0];
        }

        // ========== VERIFICAR CONTRASEÑA ==========
        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) {
            const result = recordFailedLogin(req);
            await audit.loginFailed(req, cedula, 'Contraseña incorrecta');
            return res.status(400).json({
                error: "Contraseña incorrecta",
                attemptsRemaining: result.attemptsRemaining
            });
        }

        // ========== VERIFICAR ESTADO DEL CONJUNTO (si aplica) ==========
        if (usuario.rol !== 'superadmin' && usuario.conjunto) {
            if (usuario.conjunto.estado !== 'activo') {
                return res.status(403).json({
                    error: "El conjunto residencial está suspendido o inactivo. Contacte al administrador."
                });
            }
        }

        // ========== LOGIN EXITOSO ==========
        resetLoginAttempts(req);

        const payload = {
            id: usuario.id,
            rol: usuario.rol || "residente",
            conjuntoId: usuario.conjunto ? usuario.conjunto._id : null // SuperAdmin tiene null
        };
        const { accessToken, refreshToken } = generateTokens(payload);

        await audit.loginSuccess(req, {
            cedula: usuario.cedula,
            nombre: usuario.nombre,
            rol: usuario.rol
        });

        res.json({
            token: accessToken,
            refreshToken,
            expiresIn: 7200,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula,
                rol: usuario.rol || "residente",
                placa: usuario.placaVehiculo || null,
                apartamento: usuario.apartamento || null,
                torre: usuario.torre || null,
                fotoPerfil: usuario.fotoPerfil || null,
                // Datos del conjunto (si aplica)
                conjuntoId: usuario.conjunto?._id || null,
                conjuntoNombre: usuario.conjunto?.nombre || null
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};

// Refrescar token de acceso
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token requerido" });
        }

        // Verificar refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: "Token inválido" });
        }

        // Generar nuevo access token
        const newAccessToken = jwt.sign(
            { id: decoded.id, rol: decoded.rol },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            token: newAccessToken,
            expiresIn: 7200
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Refresh token expirado. Inicie sesión nuevamente." });
        }
        console.error("Error refrescando token:", error);
        res.status(401).json({ error: "Token inválido" });
    }
};

// Obtener todos los usuarios y visitantes (con paginación opcional)
exports.obtenerUsuarios = async (req, res) => {
    try {
        const Visitante = require("../config/models/visitante");

        // Parámetros de paginación y búsqueda (opcionales)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 0; // 0 = sin límite (comportamiento original)
        const search = req.query.search?.trim() || '';
        const rol = req.query.rol || 'todos';

        // Construir query de búsqueda
        let query = {};
        if (search) {
            query.$or = [
                { nombre: { $regex: search, $options: 'i' } },
                { apellido: { $regex: search, $options: 'i' } },
                { cedula: { $regex: search, $options: 'i' } },
                { placaVehiculo: { $regex: search, $options: 'i' } }
            ];
        }
        if (rol !== 'todos') {
            query.rol = rol;
        }

        // Usar Promise.all para queries paralelas y .lean() para mejor rendimiento
        let usuariosQuery = Usuario.find(query, '-password -__v');
        let visitantesQuery = Visitante.find(search ? {
            $or: [
                { nombre: { $regex: search, $options: 'i' } },
                { apellido: { $regex: search, $options: 'i' } },
                { cedula: { $regex: search, $options: 'i' } },
                { placaVehiculo: { $regex: search, $options: 'i' } }
            ]
        } : {}, '-__v');

        // Aplicar paginación si se especifica límite
        if (limit > 0) {
            const skip = (page - 1) * limit;
            usuariosQuery = usuariosQuery.skip(skip).limit(limit);
            visitantesQuery = visitantesQuery.skip(skip).limit(limit);
        }

        const [usuarios, visitantes, totalUsuarios, totalVisitantes] = await Promise.all([
            usuariosQuery.lean(),
            visitantesQuery.lean(),
            Usuario.countDocuments(query),
            Visitante.countDocuments(search ? {
                $or: [
                    { nombre: { $regex: search, $options: 'i' } },
                    { cedula: { $regex: search, $options: 'i' } }
                ]
            } : {})
        ]);

        const residentes = usuarios.filter(u => u.rol === 'residente');
        const porteros = usuarios.filter(u => u.rol === 'porteria');
        const admins = usuarios.filter(u => u.rol === 'admin');
        const superadmins = usuarios.filter(u => u.rol === 'superadmin');

        res.json({
            success: true,
            // Para compatibilidad con vistas existentes
            residentes,
            visitantes,
            porteros,
            admins,
            // Para SuperAdmin: lista completa de usuarios
            data: usuarios,
            _meta: {
                totalResidentes: residentes.length,
                totalVisitantes: visitantes.length,
                totalPorteros: porteros.length,
                totalAdmins: admins.length,
                totalSuperAdmins: superadmins.length,
                totalUsuarios,
                totalVisitantesDB: totalVisitantes,
                page,
                limit: limit || 'all',
                hasMore: limit > 0 && (usuarios.length === limit || visitantes.length === limit)
            }
        });
    } catch (error) {
        console.error("Error al obtener usuarios/visitantes:", error);
        res.status(500).json({
            error: "Error al obtener los usuarios y visitantes",
            detalles: getErrorDetails(error)
        });
    }
};

// Obtener usuario por ID
exports.obtenerUsuarioPorId = async (req, res) => {
    try {
        if (req.params.id === "admin") {
            return res.json(ADMIN_INFO);
        }

        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(usuario);
    } catch (error) {
        console.error("Error al obtener usuario:", error);
        res.status(500).json({
            error: "Error al obtener el usuario",
            detalles: getErrorDetails(error)
        });
    }
};

// ✅ Actualizar usuario (corrige problema de borrar campos no enviados)
exports.actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const datos = { ...req.body };

        // Obtener estado anterior ANTES de actualizar
        const usuarioAnterior = await Usuario.findById(id).lean();
        if (!usuarioAnterior) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Extraer info del ejecutor si viene
        const usuarioEjecutor = datos.ejecutadoPor;
        delete datos.ejecutadoPor;

        // Quitar undefined o vacíos para no sobreescribir
        Object.keys(datos).forEach(key => {
            if (datos[key] === undefined || datos[key] === "") {
                delete datos[key];
            }
        });

        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            id,
            { $set: datos },
            { new: true, runValidators: true }
        );

        // Registrar cambios en auditoría
        // Detectar qué campos cambiaron
        const cambios = {};
        Object.keys(datos).forEach(key => {
            if (usuarioAnterior[key] !== datos[key]) {
                cambios[key] = { antes: usuarioAnterior[key], despues: datos[key] };
            }
        });

        // Siempre intentar registrar, usando usuario ejecutor o datos de req.body
        const logUsuario = usuarioEjecutor ? {
            id: usuarioEjecutor.id,
            cedula: usuarioEjecutor.cedula,
            nombre: usuarioEjecutor.nombre,
            rol: usuarioEjecutor.rol
        } : null;

        if (logUsuario) {
            logger.debug('📝 Registrando auditoría UPDATE_USER por:', logUsuario.nombre, '(', logUsuario.rol, ')');
            await AuditLog.registrar({
                usuario: logUsuario,
                accion: 'UPDATE_USER',
                descripcion: `Editó usuario: ${usuarioAnterior.nombre} ${usuarioAnterior.apellido} - Campos: ${Object.keys(cambios).join(', ')}`,
                recurso: {
                    tipo: 'usuario',
                    id: id,
                    nombre: `${usuarioAnterior.nombre} ${usuarioAnterior.apellido}`,
                    datosAnteriores: {
                        nombre: usuarioAnterior.nombre,
                        apellido: usuarioAnterior.apellido,
                        cedula: usuarioAnterior.cedula,
                        apartamento: usuarioAnterior.apartamento,
                        torre: usuarioAnterior.torre,
                        placaVehiculo: usuarioAnterior.placaVehiculo,
                        estadoExpensa: usuarioAnterior.estadoExpensa
                    },
                    datosNuevos: {
                        nombre: usuarioActualizado.nombre,
                        apellido: usuarioActualizado.apellido,
                        cedula: usuarioActualizado.cedula,
                        apartamento: usuarioActualizado.apartamento,
                        torre: usuarioActualizado.torre,
                        placaVehiculo: usuarioActualizado.placaVehiculo,
                        estadoExpensa: usuarioActualizado.estadoExpensa
                    }
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        } else {
            logger.debug('⚠️ No se recibió ejecutadoPor para auditoría de UPDATE_USER');
        }

        res.json({
            mensaje: "Usuario actualizado correctamente",
            usuario: usuarioActualizado
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error al actualizar el usuario.", detalles: getErrorDetails(error) });
    }
};

// Eliminar usuario o visitante
exports.eliminarUsuario = async (req, res) => {
    try {
        const Visitante = require("../config/models/visitante");
        const { id, tipo } = req.params;
        const usuarioEjecutor = req.body?.ejecutadoPor || null;

        if (id === "admin") {
            return res.status(400).json({ error: "No puedes eliminar al administrador" });
        }

        let eliminado;
        let tipoRecurso = tipo === "visitante" ? "visitante" : "usuario";

        // Obtener datos ANTES de eliminar para el log
        if (tipo === "visitante") {
            eliminado = await Visitante.findById(id).lean();
            if (eliminado) {
                await Visitante.findByIdAndDelete(id);
            }
        } else {
            eliminado = await Usuario.findById(id).lean();
            if (eliminado) {
                await Usuario.findByIdAndDelete(id);
            }
        }

        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado" });
        }

        // Registrar en auditoría
        if (usuarioEjecutor) {
            await AuditLog.registrar({
                usuario: {
                    id: usuarioEjecutor.id,
                    cedula: usuarioEjecutor.cedula,
                    nombre: usuarioEjecutor.nombre,
                    rol: usuarioEjecutor.rol
                },
                accion: tipoRecurso === 'visitante' ? 'DELETE_VISITANTE' : 'DELETE_USER',
                descripcion: `Eliminó ${tipoRecurso}: ${eliminado.nombre} ${eliminado.apellido || ''}`,
                recurso: {
                    tipo: tipoRecurso,
                    id: id,
                    nombre: `${eliminado.nombre} ${eliminado.apellido || ''}`,
                    datosAnteriores: {
                        nombre: eliminado.nombre,
                        apellido: eliminado.apellido,
                        cedula: eliminado.cedula,
                        apartamento: eliminado.apartamento || eliminado.apartamentoDestino,
                        torre: eliminado.torre || eliminado.torreDestino,
                        placaVehiculo: eliminado.placaVehiculo
                    },
                    datosNuevos: null
                },
                requestInfo: {
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    method: req.method,
                    path: req.originalUrl
                },
                resultado: 'SUCCESS'
            });
        }

        res.json({ mensaje: "Eliminado exitosamente", eliminado });
    } catch (error) {
        console.error("Error al eliminar usuario/visitante:", error);
        res.status(500).json({
            error: "Error al eliminar",
            detalles: getErrorDetails(error)
        });
    }
};

// Obtener perfil del usuario autenticado
exports.obtenerMiPerfil = async (req, res) => {
    try {
        const { id } = req.params;

        // Si es admin hardcoded
        if (id === "admin") {
            return res.json({
                ...ADMIN_INFO,
                apartamento: "N/A",
                torre: "N/A",
                fotoPerfil: null
            });
        }

        const usuario = await Usuario.findById(id, '-password -__v');
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(usuario);
    } catch (error) {
        console.error("Error al obtener perfil:", error);
        res.status(500).json({
            error: "Error al obtener el perfil",
            detalles: getErrorDetails(error)
        });
    }
};

// Actualizar foto de perfil
exports.actualizarFotoPerfil = async (req, res) => {
    try {
        const { id } = req.params;
        const { fotoPerfil } = req.body;

        logger.debug('📸 Actualizando foto de perfil para ID:', id);

        if (id === "admin") {
            return res.status(400).json({ error: "No se puede modificar el perfil del administrador del sistema" });
        }

        // Validar que el ID sea un ObjectId válido
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.debug('❌ ID no válido:', id);
            return res.status(400).json({ error: "ID de usuario no válido" });
        }

        if (!fotoPerfil) {
            return res.status(400).json({ error: "No se proporcionó una imagen" });
        }

        // Validar que sea base64 de imagen
        const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
        if (!base64Regex.test(fotoPerfil)) {
            return res.status(400).json({ error: "Formato de imagen no válido. Use JPG, PNG, GIF o WebP" });
        }

        // Limitar tamaño (aprox 2MB en base64)
        if (fotoPerfil.length > 2800000) {
            return res.status(400).json({ error: "La imagen es demasiado grande. Máximo 2MB" });
        }

        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            id,
            { fotoPerfil },
            { new: true, select: '-password -__v' }
        );

        if (!usuarioActualizado) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({
            mensaje: "Foto de perfil actualizada",
            fotoPerfil: usuarioActualizado.fotoPerfil
        });
    } catch (error) {
        console.error("Error al actualizar foto de perfil:", error);
        res.status(500).json({
            error: "Error al actualizar la foto de perfil",
            detalles: getErrorDetails(error)
        });
    }
};

// 🏢 SUPERADMIN: Cambiar rol de un usuario
exports.cambiarRol = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevoRol } = req.body;

        // Validar roles permitidos
        const rolesPermitidos = ['admin', 'porteria', 'residente'];
        if (!rolesPermitidos.includes(nuevoRol)) {
            return res.status(400).json({
                error: `Rol no válido. Use: ${rolesPermitidos.join(', ')}`
            });
        }

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de usuario no válido" });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // No permitir cambiar rol de superadmin
        if (usuario.rol === 'superadmin') {
            return res.status(403).json({ error: "No se puede modificar el rol de un SuperAdmin" });
        }

        const rolAnterior = usuario.rol;
        usuario.rol = nuevoRol;
        await usuario.save();

        // Registrar en auditoría
        try {
            await AuditLog.registrar({
                accion: 'CAMBIO_ROL',
                entidad: 'Usuario',
                entidadId: usuario._id,
                descripcion: `Rol cambiado de ${rolAnterior} a ${nuevoRol}`,
                datosAnteriores: { rol: rolAnterior },
                datosNuevos: { rol: nuevoRol },
                ejecutadoPor: req.usuario ? { id: req.usuario.id, cedula: req.usuario.cedula } : null,
                ip: req.ip
            });
        } catch (e) {
            logger.warn('No se pudo registrar auditoría:', e.message);
        }

        res.json({
            mensaje: `Rol actualizado de ${rolAnterior} a ${nuevoRol}`,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error("Error al cambiar rol:", error);
        res.status(500).json({ error: "Error al cambiar rol", detalles: getErrorDetails(error) });
    }
};

// 🏢 SUPERADMIN: Mover usuario a otro conjunto
exports.moverAConjunto = async (req, res) => {
    try {
        const { id } = req.params;
        const { conjuntoId } = req.body;

        logger.debug('📦 moverAConjunto - ID usuario:', id, '| conjuntoId:', conjuntoId);

        // Validar que se recibió un conjuntoId
        if (!conjuntoId || conjuntoId === '' || conjuntoId === 'null' || conjuntoId === 'undefined') {
            return res.status(400).json({
                error: "Debe seleccionar un conjunto válido",
                detalle: `Valor recibido: "${conjuntoId}"`
            });
        }

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de usuario no válido" });
        }
        if (!mongoose.Types.ObjectId.isValid(conjuntoId)) {
            return res.status(400).json({
                error: "ID de conjunto no válido",
                detalle: `El valor "${conjuntoId}" no es un ID de MongoDB válido`
            });
        }

        const Conjunto = require('../config/models/conjunto');
        const conjunto = await Conjunto.findById(conjuntoId);
        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        if (usuario.rol === 'superadmin') {
            return res.status(403).json({ error: "No se puede mover a un SuperAdmin" });
        }

        const conjuntoAnterior = usuario.conjunto;
        usuario.conjunto = conjuntoId;
        await usuario.save();

        logger.debug('✅ Usuario movido exitosamente:', usuario.nombre, '->', conjunto.nombre);

        res.json({
            mensaje: `Usuario movido a ${conjunto.nombre}`,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                conjunto: conjunto.nombre
            }
        });
    } catch (error) {
        console.error("❌ Error al mover usuario:", error);
        res.status(500).json({ error: "Error al mover usuario", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 CREAR ADMIN RÁPIDO (SuperAdmin only)
// ========================================
exports.crearAdminRapido = async (req, res) => {
    try {
        const { conjuntoId, nombre, apellido, cedula, email } = req.body;
        const Conjunto = require("../config/models/conjunto");

        // Validar que el conjunto existe
        const conjunto = await Conjunto.findById(conjuntoId);
        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Validar campos requeridos
        if (!nombre || !apellido || !cedula) {
            return res.status(400).json({ error: "Nombre, apellido y cédula son requeridos" });
        }

        // Verificar si ya existe un usuario con esa cédula en ese conjunto
        const existente = await Usuario.findOne({ cedula, conjunto: conjuntoId });
        if (existente) {
            return res.status(400).json({ error: "Ya existe un usuario con esa cédula en este conjunto" });
        }

        // Generar contraseña temporal (8 caracteres alfanuméricos)
        const generarPassword = () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            let password = '';
            for (let i = 0; i < 8; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        };

        const passwordTemporal = generarPassword();
        const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

        // Crear el admin
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

        // Registrar en audit log
        try {
            await AuditLog.registrar({
                usuario: {
                    id: req.usuario.id,
                    cedula: 'superadmin',
                    nombre: 'SuperAdmin',
                    rol: 'superadmin'
                },
                accion: 'CREAR_ADMIN_RAPIDO',
                entidad: {
                    tipo: 'usuario',
                    id: nuevoAdmin._id.toString(),
                    nombre: `${nombre} ${apellido}`
                },
                resultado: 'SUCCESS'
            });
        } catch (auditError) {
            logger.warn('Error registrando auditoría:', auditError.message);
        }

        res.status(201).json({
            mensaje: "Administrador creado exitosamente",
            admin: {
                id: nuevoAdmin._id,
                nombre: nuevoAdmin.nombre,
                apellido: nuevoAdmin.apellido,
                cedula: nuevoAdmin.cedula,
                email: nuevoAdmin.email,
                conjunto: conjunto.nombre
            },
            credenciales: {
                cedula: nuevoAdmin.cedula,
                passwordTemporal: passwordTemporal,
                advertencia: "Guarde esta contraseña, no se mostrará de nuevo"
            }
        });
    } catch (error) {
        console.error("Error al crear admin rápido:", error);
        res.status(500).json({ error: "Error al crear administrador", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 EXPORTAR DATOS DE CONJUNTO (SuperAdmin only)
// ========================================
exports.exportarDatosConjunto = async (req, res) => {
    try {
        const { id } = req.params;
        const { formato = 'json' } = req.query;

        const Conjunto = require("../config/models/conjunto");
        const Visitante = require("../config/models/visitante");
        const Parqueadero = require("../config/models/parqueadero");

        // Verificar que el conjunto existe
        const conjunto = await Conjunto.findById(id);
        if (!conjunto) {
            return res.status(404).json({ error: "Conjunto no encontrado" });
        }

        // Obtener todos los datos del conjunto
        const [usuarios, visitantes, parqueaderos] = await Promise.all([
            Usuario.find({ conjunto: id }).select('-password -__v').lean(),
            Visitante.find({ conjunto: id }).select('-__v').lean(),
            Parqueadero.find({ conjunto: id }).select('-__v').lean()
        ]);

        const datos = {
            conjunto: {
                nombre: conjunto.nombre,
                nit: conjunto.nit,
                direccion: conjunto.direccion,
                ciudad: conjunto.ciudad,
                estado: conjunto.estado,
                plan: conjunto.plan,
                exportadoEn: new Date().toISOString()
            },
            estadisticas: {
                totalUsuarios: usuarios.length,
                totalVisitantes: visitantes.length,
                totalParqueaderos: parqueaderos.length,
                usuariosPorRol: {
                    admins: usuarios.filter(u => u.rol === 'admin').length,
                    residentes: usuarios.filter(u => u.rol === 'residente').length,
                    porteros: usuarios.filter(u => u.rol === 'porteria').length
                }
            },
            usuarios,
            visitantes,
            parqueaderos
        };

        if (formato === 'csv') {
            // Generar CSV básico de usuarios
            let csv = 'Tipo,Nombre,Apellido,Cedula,Rol,Apartamento,Torre,Placa\n';
            usuarios.forEach(u => {
                csv += `Usuario,"${u.nombre}","${u.apellido}","${u.cedula}","${u.rol}","${u.apartamento || ''}","${u.torre || ''}","${u.placaVehiculo || ''}"\n`;
            });
            visitantes.forEach(v => {
                csv += `Visitante,"${v.nombre}","${v.apellido}","${v.cedula}","visitante","${v.apartamentoDestino || ''}","${v.torreDestino || ''}","${v.placaVehiculo || ''}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${conjunto.nombre.replace(/\s+/g, '_')}_export.csv"`);
            return res.send('\ufeff' + csv); // BOM para Excel
        }

        // Formato JSON por defecto
        res.json(datos);
    } catch (error) {
        console.error("Error al exportar datos:", error);
        res.status(500).json({ error: "Error al exportar datos", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 GENERAR QR DE ACCESO PARA RESIDENTE
// GET /api/usuarios/:id/qr-acceso
// ========================================
exports.generarQRAcceso = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el usuario solicita su propio QR o es admin
        if (req.usuario.id !== id && req.usuario.rol !== 'admin' && req.usuario.rol !== 'superadmin') {
            return res.status(403).json({ error: "No tienes permiso para generar este QR" });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Si ya tiene QR, devolverlo; si no, generar uno nuevo
        if (!usuario.qrAcceso?.token) {
            usuario.generarQRAcceso();
            await usuario.save();
        }

        // Generar URL para el QR
        const baseUrl = process.env.FRONTEND_URL_PROD || `http://localhost:${process.env.PORT || 5000}`;
        const qrUrl = `${baseUrl}/api/usuarios/verificar-qr/${usuario.qrAcceso.token}`;

        res.json({
            success: true,
            qr: {
                token: usuario.qrAcceso.token,
                url: qrUrl,
                fechaGeneracion: usuario.qrAcceso.fechaGeneracion,
                usuario: {
                    nombre: `${usuario.nombre} ${usuario.apellido}`,
                    cedula: usuario.cedula,
                    apartamento: usuario.apartamento,
                    torre: usuario.torre
                }
            }
        });
    } catch (error) {
        console.error("Error al generar QR:", error);
        res.status(500).json({ error: "Error al generar QR", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 REGENERAR QR DE ACCESO (nuevo token)
// POST /api/usuarios/:id/qr-acceso/regenerar
// ========================================
exports.regenerarQRAcceso = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.usuario.id !== id && req.usuario.rol !== 'admin' && req.usuario.rol !== 'superadmin') {
            return res.status(403).json({ error: "No tienes permiso para regenerar este QR" });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Generar nuevo token (invalida el anterior)
        usuario.generarQRAcceso();
        await usuario.save();

        const baseUrl = process.env.FRONTEND_URL_PROD || `http://localhost:${process.env.PORT || 5000}`;
        const qrUrl = `${baseUrl}/api/usuarios/verificar-qr/${usuario.qrAcceso.token}`;

        res.json({
            success: true,
            mensaje: "QR regenerado exitosamente",
            qr: {
                token: usuario.qrAcceso.token,
                url: qrUrl,
                fechaGeneracion: usuario.qrAcceso.fechaGeneracion
            }
        });
    } catch (error) {
        console.error("Error al regenerar QR:", error);
        res.status(500).json({ error: "Error al regenerar QR", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 VERIFICAR QR DE ACCESO (para portería)
// GET /api/usuarios/verificar-qr/:token
// ========================================
exports.verificarQRAcceso = async (req, res) => {
    try {
        const { token } = req.params;

        const usuario = await Usuario.buscarPorQR(token);
        if (!usuario) {
            return res.status(404).json({
                valid: false,
                error: "Código QR inválido o no registrado"
            });
        }

        res.json({
            valid: true,
            mensaje: "Residente autorizado",
            residente: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula,
                apartamento: usuario.apartamento,
                torre: usuario.torre,
                placa: usuario.placaVehiculo,
                conjunto: usuario.conjunto?.nombre || 'Sin asignar',
                fechaQR: usuario.qrAcceso.fechaGeneracion
            }
        });
    } catch (error) {
        console.error("Error al verificar QR:", error);
        res.status(500).json({ valid: false, error: "Error al verificar QR" });
    }
};

// ========================================
// 📌 CAMBIAR CONTRASEÑA (usuario autenticado)
// PUT /api/usuarios/me/password
// ========================================
exports.cambiarPassword = async (req, res) => {
    try {
        const userId = req.usuario.id;
        const { passwordActual, passwordNueva } = req.body;

        // Validar que se enviaron ambos campos
        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({
                error: "Debe proporcionar la contraseña actual y la nueva contraseña"
            });
        }

        // Validar longitud mínima de nueva contraseña
        if (passwordNueva.length < 6) {
            return res.status(400).json({
                error: "La nueva contraseña debe tener al menos 6 caracteres"
            });
        }

        // Buscar usuario en BD
        const usuario = await Usuario.findById(userId).select('+password');
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Verificar contraseña actual
        const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ error: "La contraseña actual es incorrecta" });
        }

        // Hashear nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(passwordNueva, salt);

        // Actualizar contraseña
        usuario.password = passwordHasheada;
        await usuario.save();

        // Registrar en auditoría
        try {
            await AuditLog.create({
                accion: 'CAMBIO_PASSWORD',
                usuario: userId,
                conjunto: usuario.conjunto,
                detalles: { mensaje: 'Usuario cambió su contraseña' },
                ip: req.ip || req.connection?.remoteAddress
            });
        } catch (auditError) {
            console.error("Error al registrar auditoría:", auditError);
        }

        logger.debug(`🔐 Usuario ${usuario.cedula} cambió su contraseña`);
        res.json({ mensaje: "Contraseña actualizada correctamente" });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        res.status(500).json({ error: "Error al cambiar contraseña", detalles: getErrorDetails(error) });
    }
};

// ========================================
// 📌 RESTABLECER CONTRASEÑA (SuperAdmin only)
// PUT /api/usuarios/:id/restablecer-password
// ========================================
exports.restablecerPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevaPassword } = req.body;

        // Si no se proporciona contraseña, generar una temporal
        let password = nuevaPassword;
        if (!password) {
            // Generar contraseña temporal de 8 caracteres
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            password = '';
            for (let i = 0; i < 8; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }

        // Validar longitud
        if (password.length < 6) {
            return res.status(400).json({
                error: "La contraseña debe tener al menos 6 caracteres"
            });
        }

        // Buscar usuario
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de usuario no válido" });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Hashear nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        // Actualizar
        usuario.password = passwordHasheada;
        await usuario.save();

        // Registrar en auditoría
        try {
            await AuditLog.create({
                accion: 'RESTABLECER_PASSWORD',
                usuario: req.usuario.id,
                conjunto: usuario.conjunto,
                detalles: {
                    usuarioAfectado: usuario._id.toString(),
                    cedulaAfectado: usuario.cedula,
                    mensaje: `SuperAdmin restableció contraseña de ${usuario.nombre} ${usuario.apellido}`
                },
                ip: req.ip || req.connection?.remoteAddress
            });
        } catch (auditError) {
            console.error("Error al registrar auditoría:", auditError);
        }

        logger.debug(`🔐 SuperAdmin restableció contraseña de ${usuario.cedula}`);

        res.json({
            mensaje: `Contraseña restablecida para ${usuario.nombre} ${usuario.apellido}`,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula
            },
            // Solo devolver la contraseña temporal si fue generada automáticamente
            passwordTemporal: !nuevaPassword ? password : undefined
        });

    } catch (error) {
        console.error("Error al restablecer contraseña:", error);
        res.status(500).json({ error: "Error al restablecer contraseña", detalles: getErrorDetails(error) });
    }
};



