/**
 * Script de limpieza y poblado de base de datos.
 *
 * - Conserva: el superadmin existente y todos los conjuntos.
 * - Borra: usuarios (excepto superadmin), visitantes, parqueaderos, auditlogs e historialAccesos.
 * - Repuebla: usuarios (admin, portero, residentes), parqueaderos, visitantes,
 *   y un historial de accesos desde 2025-01-01 hasta hoy.
 *
 * Uso: node scripts/seed-database.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('Falta MONGO_URI en .env');
    process.exit(1);
}

const Conjunto = require('../models/conjunto');
const Usuario = require('../models/usuario');
const Visitante = require('../models/visitante');
const Parqueadero = require('../models/parqueadero');
const HistorialAcceso = require('../models/historialAcceso');
const AuditLog = require('../models/auditLog');

// ===== Datos base =====
const NOMBRES = ['Carlos', 'Maria', 'Andres', 'Laura', 'Diego', 'Camila', 'Javier', 'Valentina',
                 'Sebastian', 'Daniela', 'Jose', 'Sofia', 'Luis', 'Isabella', 'Miguel', 'Paula',
                 'David', 'Ana', 'Ricardo', 'Manuela', 'Felipe', 'Gabriela', 'Juan', 'Natalia'];
const APELLIDOS = ['Gomez', 'Rodriguez', 'Martinez', 'Lopez', 'Garcia', 'Hernandez', 'Perez',
                   'Sanchez', 'Ramirez', 'Torres', 'Diaz', 'Vargas', 'Castro', 'Ruiz', 'Morales',
                   'Ortiz', 'Rojas', 'Silva', 'Jimenez', 'Alvarez', 'Romero', 'Mendoza', 'Cruz'];
const TORRES = ['A', 'B', 'C'];

const FECHA_INICIO_HISTORIAL = new Date('2025-01-01T00:00:00Z');
const FECHA_FIN_HISTORIAL = new Date();

// ===== Utilidades =====
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

function generarPlaca() {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const l = () => letras[rand(26)];
    const n = () => rand(10);
    return `${l()}${l()}${l()}${n()}${n()}${n()}`;
}

function fechaAleatoriaEntre(inicio, fin) {
    const ms = inicio.getTime() + Math.random() * (fin.getTime() - inicio.getTime());
    return new Date(ms);
}

async function limpiarDatos() {
    console.log('\n[1/4] Limpiando datos...');
    const resUsuarios = await Usuario.deleteMany({ rol: { $ne: 'superadmin' } });
    const resVisitantes = await Visitante.deleteMany({});
    const resParqueaderos = await Parqueadero.deleteMany({});
    const resHistorial = await HistorialAcceso.deleteMany({});
    const resAuditoria = await AuditLog.deleteMany({});

    // Limpiar refs en superadmin (por si quedaron)
    await Usuario.updateMany(
        { rol: 'superadmin' },
        { $set: { parqueaderoAsignado: null } }
    );

    console.log(`  - Usuarios borrados (no superadmin): ${resUsuarios.deletedCount}`);
    console.log(`  - Visitantes borrados:               ${resVisitantes.deletedCount}`);
    console.log(`  - Parqueaderos borrados:             ${resParqueaderos.deletedCount}`);
    console.log(`  - Historial accesos borrado:         ${resHistorial.deletedCount}`);
    console.log(`  - Auditlogs borrados:                ${resAuditoria.deletedCount}`);
}

async function crearUsuariosPorConjunto(conjunto, contadorCedula) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const usuarios = [];

    // Admin
    usuarios.push({
        conjunto: conjunto._id,
        nombre: `Admin`,
        apellido: conjunto.nombre.split(' ')[0],
        cedula: String(contadorCedula.value++),
        apartamento: 'N/A',
        torre: 'N/A',
        password: passwordHash,
        rol: 'admin',
        tieneVehiculo: false,
        estadoExpensa: 'al dia'
    });

    // Portero
    usuarios.push({
        conjunto: conjunto._id,
        nombre: 'Portero',
        apellido: conjunto.nombre.split(' ')[0],
        cedula: String(contadorCedula.value++),
        apartamento: 'N/A',
        torre: 'N/A',
        password: passwordHash,
        rol: 'porteria',
        tieneVehiculo: false,
        estadoExpensa: 'al dia'
    });

    // Residentes (12)
    const numResidentes = 12;
    for (let i = 0; i < numResidentes; i++) {
        const tieneVehiculo = Math.random() < 0.75;
        const tieneSegundaPlaca = tieneVehiculo && Math.random() < 0.2;
        const torre = pick(TORRES);
        const apto = `${100 + i + rand(5)}`;
        usuarios.push({
            conjunto: conjunto._id,
            nombre: pick(NOMBRES),
            apellido: pick(APELLIDOS),
            cedula: String(contadorCedula.value++),
            apartamento: apto,
            torre,
            password: passwordHash,
            rol: 'residente',
            tieneVehiculo,
            placaVehiculo: tieneVehiculo ? generarPlaca() : null,
            placa2Vehiculo: tieneSegundaPlaca ? generarPlaca() : null,
            estadoExpensa: Math.random() < 0.85 ? 'al dia' : 'en mora',
            fechaIngreso: fechaAleatoriaEntre(new Date('2024-06-01'), FECHA_INICIO_HISTORIAL)
        });
    }

    return Usuario.insertMany(usuarios);
}

async function crearParqueaderos(conjunto, residentes) {
    const parqueaderos = [];
    let contador = 1;

    // Privados: uno por residente con vehículo
    for (const r of residentes) {
        if (!r.tieneVehiculo) continue;
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `P-${String(contador++).padStart(3, '0')}`,
            categoria: 'PRIVADO',
            tipoVehiculo: Math.random() < 0.85 ? 'CARRO' : 'MOTO',
            torre: r.torre,
            apartamento: r.apartamento,
            residenteAsignado: r._id,
            estado: 'DISPONIBLE'
        });
    }

    // Visitantes: 8 por conjunto
    for (let i = 0; i < 8; i++) {
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `V-${String(i + 1).padStart(3, '0')}`,
            categoria: 'VISITANTE',
            tipoVehiculo: Math.random() < 0.8 ? 'CARRO' : 'MOTO',
            tiempoMaximoHoras: 8,
            estado: 'DISPONIBLE'
        });
    }

    const creados = await Parqueadero.insertMany(parqueaderos);

    // Asignar parqueaderoAsignado a los residentes con privado
    for (const p of creados) {
        if (p.categoria === 'PRIVADO' && p.residenteAsignado) {
            await Usuario.updateOne(
                { _id: p.residenteAsignado },
                { $set: { parqueaderoAsignado: p._id } }
            );
        }
    }

    return creados;
}

async function crearVisitantes(conjunto, residentes, contadorCedula) {
    const visitantes = [];
    const residentesArr = residentes.filter(r => r.rol === 'residente');
    for (let i = 0; i < 15; i++) {
        const residente = pick(residentesArr);
        visitantes.push({
            conjunto: conjunto._id,
            nombre: pick(NOMBRES),
            apellido: pick(APELLIDOS),
            cedula: String(contadorCedula.value++),
            placaVehiculo: generarPlaca(),
            residenteId: residente._id,
            apartamentoDestino: residente.apartamento,
            torreDestino: residente.torre,
            motivoVisita: pick(['Visita familiar', 'Entrega', 'Servicio tecnico', 'Visita social', 'Domicilio']),
            estado: 'pendiente'
        });
    }
    return Visitante.insertMany(visitantes);
}

async function crearHistorialAccesos(conjunto, residentes, visitantes) {
    const accesos = [];
    const residentesConVehiculo = residentes.filter(r => r.tieneVehiculo && r.placaVehiculo);

    // Generar ~10 accesos por dia entre las fechas
    const dias = Math.floor((FECHA_FIN_HISTORIAL - FECHA_INICIO_HISTORIAL) / (1000 * 60 * 60 * 24));
    const accesosPorDia = 6 + rand(5); // 6-10 por día

    for (let d = 0; d < dias; d++) {
        const fechaBase = new Date(FECHA_INICIO_HISTORIAL.getTime() + d * 24 * 60 * 60 * 1000);
        const cantidadHoy = accesosPorDia + rand(4) - 2;

        for (let i = 0; i < cantidadHoy; i++) {
            const esResidente = Math.random() < 0.7;
            const horaEntrada = new Date(fechaBase);
            horaEntrada.setHours(6 + rand(16), rand(60), rand(60));

            let placa, nombreUsuario, tipoUsuario;
            if (esResidente && residentesConVehiculo.length > 0) {
                const r = pick(residentesConVehiculo);
                placa = r.placaVehiculo;
                nombreUsuario = `${r.nombre} ${r.apellido}`;
                tipoUsuario = 'residente';
            } else if (visitantes.length > 0) {
                const v = pick(visitantes);
                placa = v.placaVehiculo;
                nombreUsuario = `${v.nombre} ${v.apellido}`;
                tipoUsuario = 'visitante';
            } else {
                continue;
            }

            // Entrada
            accesos.push({
                conjunto: conjunto._id,
                placa,
                tipoAcceso: 'entrada',
                tipoUsuario,
                nombreUsuario,
                plaza: tipoUsuario === 'visitante' ? `V-${String(1 + rand(8)).padStart(3, '0')}` : null,
                fechaHora: horaEntrada
            });

            // Salida (90% de probabilidad, entre 1-10 horas después)
            if (Math.random() < 0.9) {
                const horaSalida = new Date(horaEntrada.getTime() + (1 + rand(9)) * 60 * 60 * 1000);
                if (horaSalida <= FECHA_FIN_HISTORIAL) {
                    accesos.push({
                        conjunto: conjunto._id,
                        placa,
                        tipoAcceso: 'salida',
                        tipoUsuario,
                        nombreUsuario,
                        plaza: tipoUsuario === 'visitante' ? `V-${String(1 + rand(8)).padStart(3, '0')}` : null,
                        fechaHora: horaSalida
                    });
                }
            }
        }
    }

    // Insertar en lotes de 1000
    const batchSize = 1000;
    let insertados = 0;
    for (let i = 0; i < accesos.length; i += batchSize) {
        const lote = accesos.slice(i, i + batchSize);
        await HistorialAcceso.insertMany(lote, { ordered: false });
        insertados += lote.length;
    }
    return insertados;
}

async function poblar() {
    console.log('\n[2/4] Cargando conjuntos existentes...');
    const conjuntos = await Conjunto.find({});
    console.log(`  Encontrados: ${conjuntos.length}`);
    if (conjuntos.length === 0) {
        console.log('  No hay conjuntos. Saliendo.');
        return;
    }

    const contadorCedula = { value: 1000000000 };

    console.log('\n[3/4] Creando usuarios y parqueaderos por conjunto...');
    const todosUsuarios = [];
    const conjuntosData = [];

    for (const c of conjuntos) {
        console.log(`  -> ${c.nombre}`);
        const usuarios = await crearUsuariosPorConjunto(c, contadorCedula);
        const parqueaderos = await crearParqueaderos(c, usuarios);
        const visitantes = await crearVisitantes(c, usuarios, contadorCedula);
        console.log(`     usuarios: ${usuarios.length}, parqueaderos: ${parqueaderos.length}, visitantes: ${visitantes.length}`);
        conjuntosData.push({ conjunto: c, usuarios, visitantes });
        todosUsuarios.push(...usuarios);
    }

    console.log('\n[4/4] Generando historial de accesos (2025-01-01 -> hoy)...');
    let totalAccesos = 0;
    for (const { conjunto, usuarios, visitantes } of conjuntosData) {
        const n = await crearHistorialAccesos(conjunto, usuarios, visitantes);
        console.log(`  ${conjunto.nombre}: ${n} accesos`);
        totalAccesos += n;
    }
    console.log(`  Total accesos: ${totalAccesos}`);
}

(async () => {
    try {
        console.log('Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Conectado.');

        await limpiarDatos();
        await poblar();

        console.log('\nListo. Resumen final:');
        const counts = await Promise.all([
            Usuario.countDocuments(),
            Conjunto.countDocuments(),
            Parqueadero.countDocuments(),
            Visitante.countDocuments(),
            HistorialAcceso.countDocuments(),
            AuditLog.countDocuments()
        ]);
        console.log(`  usuarios:         ${counts[0]}`);
        console.log(`  conjuntos:        ${counts[1]}`);
        console.log(`  parqueaderos:     ${counts[2]}`);
        console.log(`  visitantes:       ${counts[3]}`);
        console.log(`  historialAccesos: ${counts[4]}`);
        console.log(`  auditlogs:        ${counts[5]}`);
        console.log('\nPassword de todos los usuarios nuevos: password123');
    } catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
