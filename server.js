require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const conectarDB = require('./config/database');
const usuarioRoutes = require('./routes/usuario.routes');
const visitanteRoutes = require('./routes/visitante.routes');
const parqueaderoRoutes = require('./routes/parqueadero.routes'); 
const Usuario = require('./config/models/usuario');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 5000;

// Ruta para mostrar Hola Mundo
app.get('/hola', (req, res) => {
    res.sendFile(path.join(__dirname, 'Vista', 'holamundo.html'));
});

(async () => {
    try {
        await conectarDB();
        console.log("✅ Conectado a MongoDB");
        await crearAdminSiNoExiste();
    } catch (err) {
        console.error("❌ Error conectando a MongoDB:", err);
    }
})();

app.use(cors());
app.use(express.json());

// 📌 Rutas API
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/visitantes', visitanteRoutes);
app.use('/api/parqueaderos', parqueaderoRoutes);

// 📌 Archivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, 'Vista')));

// 📌 Rutas de vistas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'LandingPage', 'Landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vista.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaadmin.html')));
app.get('/residente', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaresidente.html')));
app.get('/porteria', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteria.html')));
app.get('/porteriaactualizar', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteriaactualizar.html')));
app.get('/porteriaregistrar', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'Vistaporteriaregistrar.html')));
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'mapa.html')));

// 📌 Nueva ruta para el mapa de parqueaderos
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, 'Vista', 'index.html')));

// 📌 Crear usuario admin si no existe
async function crearAdminSiNoExiste() {
    try {
        const adminExistente = await Usuario.findOne({ cedula: "123456789" });
        if (!adminExistente) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            const nuevoAdmin = new Usuario({
                nombre: "Admin",
                apellido: "Principal",
                cedula: "123456789",
                apartamento: "N/A",
                torre: "N/A",
                password: hashedPassword,
                rol: "admin"
            });
            await nuevoAdmin.save();
            console.log("✅ Usuario administrador creado con éxito");
        } else {
            console.log("👤 Usuario administrador ya existe");
        }
    } catch (error) {
        console.error("❌ Error al crear el usuario administrador:", error);
    }
}

// 🚀 Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
