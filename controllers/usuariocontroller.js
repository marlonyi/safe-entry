const Usuario = require("../config/models/usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AuditLog = require("../config/models/auditLog");

// Credenciales admin desde variables de entorno
const ADMIN_CEDULA = process.env.ADMIN_CEDULA || "99999999";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "secreto";

const ADMIN_INFO = {
    id: "admin",
    nombre: "Administrador",
    apellido: "Sistema",
    cedula: ADMIN_CEDULA,
    rol: "admin"
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

        console.log("Datos recibidos:", { nombre, apellido, cedula, rol, tieneVehiculo, placaVehiculo });

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
            detalles: error.message
        });
    }
};

// Login de usuario
exports.loginUsuario = async (req, res) => {
    try {
        const { cedula, password } = req.body;
        const { audit } = require('../middlewares/audit.middleware');
        const { recordFailedLogin, resetLoginAttempts } = require('../middlewares/rateLimit.middleware');

        // Helper para generar tokens
        const generateTokens = (payload) => {
            const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
            const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: "7d" });
            return { accessToken, refreshToken };
        };

        // Login de admin hardcoded
        if (cedula === ADMIN_CEDULA && password === ADMIN_PASSWORD) {
            const { accessToken, refreshToken } = generateTokens({ id: "admin", rol: "admin" });
            resetLoginAttempts(req);
            await audit.loginSuccess(req, ADMIN_INFO);
            return res.json({
                token: accessToken,
                refreshToken,
                expiresIn: 7200, // 2 horas en segundos
                usuario: ADMIN_INFO
            });
        }

        const usuario = await Usuario.findOne({ cedula });
        if (!usuario) {
            const result = recordFailedLogin(req);
            await audit.loginFailed(req, cedula, 'Usuario no encontrado');
            return res.status(400).json({
                error: "Usuario no encontrado",
                attemptsRemaining: result.attemptsRemaining
            });
        }

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) {
            const result = recordFailedLogin(req);
            await audit.loginFailed(req, cedula, 'Contraseña incorrecta');
            return res.status(400).json({
                error: "Contraseña incorrecta",
                attemptsRemaining: result.attemptsRemaining
            });
        }

        // Login exitoso
        resetLoginAttempts(req);

        const payload = {
            id: usuario.id,
            rol: usuario.rol || "residente"
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
            expiresIn: 7200, // 2 horas en segundos
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula,
                rol: usuario.rol || "residente",
                placa: usuario.placaVehiculo || null,
                apartamento: usuario.apartamento || null,
                torre: usuario.torre || null,
                fotoPerfil: usuario.fotoPerfil || null
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

        res.json({
            success: true,
            residentes,
            visitantes,
            porteros,
            _meta: {
                totalResidentes: residentes.length,
                totalVisitantes: visitantes.length,
                totalPorteros: porteros.length,
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
            detalles: error.message
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
            detalles: error.message
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
            console.log('📝 Registrando auditoría UPDATE_USER por:', logUsuario.nombre, '(', logUsuario.rol, ')');
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
            console.log('⚠️ No se recibió ejecutadoPor para auditoría de UPDATE_USER');
        }

        res.json({
            mensaje: "Usuario actualizado correctamente",
            usuario: usuarioActualizado
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error al actualizar el usuario.", detalles: error.message });
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
            detalles: error.message
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
            detalles: error.message
        });
    }
};

// Actualizar foto de perfil
exports.actualizarFotoPerfil = async (req, res) => {
    try {
        const { id } = req.params;
        const { fotoPerfil } = req.body;

        console.log('📸 Actualizando foto de perfil para ID:', id);

        if (id === "admin") {
            return res.status(400).json({ error: "No se puede modificar el perfil del administrador del sistema" });
        }

        // Validar que el ID sea un ObjectId válido
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('❌ ID no válido:', id);
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
            detalles: error.message
        });
    }
};
