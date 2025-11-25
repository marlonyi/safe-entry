const Usuario = require("../config/models/usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ADMIN_CEDULA = "99999999";
const ADMIN_PASSWORD = "admin123";
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

        if (cedula === ADMIN_CEDULA && password === ADMIN_PASSWORD) {
            const token = jwt.sign({ id: "admin", rol: "admin" }, "secreto", { expiresIn: "2h" });
            return res.json({ token, usuario: ADMIN_INFO });
        }

        const usuario = await Usuario.findOne({ cedula });
        if (!usuario) {
            return res.status(400).json({ error: "Usuario no encontrado" });
        }

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) {
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        const token = jwt.sign({ 
            id: usuario.id, 
            rol: usuario.rol || "residente" 
        }, "secreto", { expiresIn: "2h" });

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                cedula: usuario.cedula,
                rol: usuario.rol || "residente",
                placa: usuario.placaVehiculo || null
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};

// Obtener todos los usuarios y visitantes
exports.obtenerUsuarios = async (req, res) => {
    try {
        const Visitante = require("../config/models/visitante");

        const usuarios = await Usuario.find({}, '-password -__v');
        const visitantes = await Visitante.find({}, '-__v');

        console.log('Usuarios encontrados:', usuarios); // Depuración
        console.log('Visitantes encontrados:', visitantes); // Depuración

        const residentes = usuarios.filter(u => u.rol === 'residente');
        const porteros = usuarios.filter(u => u.rol === 'porteria');

        res.json({
            success: true,
            residentes,
            visitantes,
            porteros
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

    if (!usuarioActualizado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
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

        if (id === "admin") {
            return res.status(400).json({ error: "No puedes eliminar al administrador" });
        }

        let eliminado;

        if (tipo === "visitante") {
            eliminado = await Visitante.findByIdAndDelete(id);
        } else {
            eliminado = await Usuario.findByIdAndDelete(id);
        }

        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado" });
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
