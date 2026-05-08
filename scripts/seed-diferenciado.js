/**
 * Seed con 3 perfiles diferenciados por conjunto.
 * - Limpia usuarios (excepto superadmin), visitantes, parqueaderos, accesos, auditlogs.
 * - Mantiene los conjuntos existentes.
 * - Genera datos coherentes con los perfiles definidos abajo.
 *
 * Uso: node scripts/seed-diferenciado.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('Falta MONGO_URI'); process.exit(1); }

const Conjunto = require('../models/conjunto');
const Usuario = require('../models/usuario');
const Visitante = require('../models/visitante');
const Parqueadero = require('../models/parqueadero');
const HistorialAcceso = require('../models/historialAcceso');
const AuditLog = require('../models/auditLog');

// ===== Perfiles por conjunto =====
const PERFILES = {
    'Conjunto Principal': {
        torres: ['A', 'B', 'C'],
        residentes: 25,
        pctConVehiculo: 0.80,
        pctSegundaPlaca: 0.15,
        privadosCarro: 16,
        privadosMoto: 4,
        visitantesCarro: 8,
        visitantesMoto: 4,
        visitantesRegistrados: 20,
        ocupacion: 0.50,
        accesosDia: [18, 22],
        pctAlDia: 0.85
    },
    'Torres del parque': {
        torres: ['A', 'B', 'C', 'D'],
        residentes: 40,
        pctConVehiculo: 0.90,
        pctSegundaPlaca: 0.25,
        privadosCarro: 28,
        privadosMoto: 7,
        visitantesCarro: 12,
        visitantesMoto: 6,
        visitantesRegistrados: 32,
        ocupacion: 0.65,
        accesosDia: [28, 35],
        pctAlDia: 0.95
    },
    'socorro city': {
        torres: ['A', 'B'],
        residentes: 15,
        pctConVehiculo: 0.70,
        pctSegundaPlaca: 0.10,
        privadosCarro: 8,
        privadosMoto: 2,
        visitantesCarro: 5,
        visitantesMoto: 3,
        visitantesRegistrados: 12,
        ocupacion: 0.30,
        accesosDia: [8, 12],
        pctAlDia: 0.75
    }
};

const NOMBRES = ['Carlos', 'Maria', 'Andres', 'Laura', 'Diego', 'Camila', 'Javier', 'Valentina',
                 'Sebastian', 'Daniela', 'Jose', 'Sofia', 'Luis', 'Isabella', 'Miguel', 'Paula',
                 'David', 'Ana', 'Ricardo', 'Manuela', 'Felipe', 'Gabriela', 'Juan', 'Natalia',
                 'Mateo', 'Lucia', 'Santiago', 'Emma', 'Daniel', 'Mariana', 'Tomas', 'Antonia',
                 'Nicolas', 'Catalina', 'Samuel', 'Salome', 'Martin', 'Renata', 'Emilio', 'Julieta'];
const APELLIDOS = ['Gomez', 'Rodriguez', 'Martinez', 'Lopez', 'Garcia', 'Hernandez', 'Perez',
                   'Sanchez', 'Ramirez', 'Torres', 'Diaz', 'Vargas', 'Castro', 'Ruiz', 'Morales',
                   'Ortiz', 'Rojas', 'Silva', 'Jimenez', 'Alvarez', 'Romero', 'Mendoza', 'Cruz',
                   'Reyes', 'Moreno', 'Gutierrez', 'Suarez', 'Pardo', 'Cardenas'];
const MOTIVOS = ['Visita familiar', 'Entrega domicilio', 'Servicio tecnico', 'Visita social',
                 'Mantenimiento', 'Reunion', 'Mudanza', 'Trabajo'];

const FECHA_INICIO = new Date('2025-11-01T00:00:00Z');
const FECHA_FIN = new Date(); // hoy

// Distribucion horaria realista (mas accesos en horas pico)
// pesos por hora 0-23
const PESO_HORA = [
    1, 1, 1, 1, 1, 2,         // 0-5 (madrugada)
    4, 8, 9, 6, 4, 4,         // 6-11 (mañana, pico 7-9)
    7, 8, 5, 4, 4, 7,         // 12-17 (almuerzo, salida)
    9, 8, 6, 4, 3, 2          // 18-23 (regreso, noche)
];

const rand = (n) => Math.floor(Math.random() * n);
const randRange = (min, max) => min + rand(max - min + 1);
const pick = (arr) => arr[rand(arr.length)];

function generarPlaca() {
    const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return `${L[rand(26)]}${L[rand(26)]}${L[rand(26)]}${rand(10)}${rand(10)}${rand(10)}`;
}

function horaRealista(fechaBase) {
    const total = PESO_HORA.reduce((a, b) => a + b, 0);
    let r = rand(total);
    let hora = 0;
    for (let h = 0; h < 24; h++) {
        if (r < PESO_HORA[h]) { hora = h; break; }
        r -= PESO_HORA[h];
    }
    const d = new Date(fechaBase);
    d.setHours(hora, rand(60), rand(60), 0);
    return d;
}

async function limpiar() {
    console.log('\n[1/5] Limpiando...');
    const r1 = await Usuario.deleteMany({ rol: { $ne: 'superadmin' } });
    const r2 = await Visitante.deleteMany({});
    const r3 = await Parqueadero.deleteMany({});
    const r4 = await HistorialAcceso.deleteMany({});
    const r5 = await AuditLog.deleteMany({});
    await Usuario.updateMany({ rol: 'superadmin' }, { $set: { parqueaderoAsignado: null } });
    console.log(`  usuarios:${r1.deletedCount} visit:${r2.deletedCount} parq:${r3.deletedCount} hist:${r4.deletedCount} audit:${r5.deletedCount}`);
}

async function crearUsuarios(conjunto, perfil, contadorCedula) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const usuarios = [];

    // Admin
    usuarios.push({
        conjunto: conjunto._id,
        nombre: 'Admin',
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

    // Residentes con apartamentos coherentes (1 por apto, distribuidos en torres)
    const aptosPorTorre = Math.ceil(perfil.residentes / perfil.torres.length);
    let resCount = 0;
    for (let t = 0; t < perfil.torres.length && resCount < perfil.residentes; t++) {
        for (let a = 0; a < aptosPorTorre && resCount < perfil.residentes; a++) {
            const piso = Math.floor(a / 2) + 1;
            const numApto = (a % 2) + 1;
            const apto = `${piso}0${numApto}`;
            const tieneVehiculo = Math.random() < perfil.pctConVehiculo;
            const tieneSegunda = tieneVehiculo && Math.random() < perfil.pctSegundaPlaca;
            usuarios.push({
                conjunto: conjunto._id,
                nombre: pick(NOMBRES),
                apellido: pick(APELLIDOS),
                cedula: String(contadorCedula.value++),
                apartamento: apto,
                torre: perfil.torres[t],
                password: passwordHash,
                rol: 'residente',
                tieneVehiculo,
                placaVehiculo: tieneVehiculo ? generarPlaca() : null,
                placa2Vehiculo: tieneSegunda ? generarPlaca() : null,
                estadoExpensa: Math.random() < perfil.pctAlDia ? 'al dia' : 'en mora',
                fechaIngreso: new Date(FECHA_INICIO.getTime() - rand(180) * 24 * 60 * 60 * 1000)
            });
            resCount++;
        }
    }
    return Usuario.insertMany(usuarios);
}

async function crearParqueaderos(conjunto, perfil, residentes) {
    const parqueaderos = [];
    const residentesConVehiculo = residentes.filter(u => u.rol === 'residente' && u.tieneVehiculo);

    let pCarroIdx = 1, pMotoIdx = 1, vCarroIdx = 1, vMotoIdx = 1;

    // Asignar privados carro a residentes con vehiculo (los primeros)
    for (let i = 0; i < perfil.privadosCarro; i++) {
        const r = residentesConVehiculo[i] || null;
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `P-${String(pCarroIdx++).padStart(3, '0')}`,
            categoria: 'PRIVADO',
            tipoVehiculo: 'CARRO',
            torre: r?.torre || pick(perfil.torres),
            apartamento: r?.apartamento || null,
            residenteAsignado: r?._id || null,
            estado: 'DISPONIBLE'
        });
    }
    // Privados moto (asignar a residentes con vehiculo restantes)
    for (let i = 0; i < perfil.privadosMoto; i++) {
        const idx = perfil.privadosCarro + i;
        const r = residentesConVehiculo[idx] || null;
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `PM-${String(pMotoIdx++).padStart(3, '0')}`,
            categoria: 'PRIVADO',
            tipoVehiculo: 'MOTO',
            torre: r?.torre || pick(perfil.torres),
            apartamento: r?.apartamento || null,
            residenteAsignado: r?._id || null,
            estado: 'DISPONIBLE'
        });
    }
    // Visitantes carro
    for (let i = 0; i < perfil.visitantesCarro; i++) {
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `V-${String(vCarroIdx++).padStart(3, '0')}`,
            categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO',
            tiempoMaximoHoras: 8,
            estado: 'DISPONIBLE'
        });
    }
    // Visitantes moto
    for (let i = 0; i < perfil.visitantesMoto; i++) {
        parqueaderos.push({
            conjunto: conjunto._id,
            numero: `VM-${String(vMotoIdx++).padStart(3, '0')}`,
            categoria: 'VISITANTE',
            tipoVehiculo: 'MOTO',
            tiempoMaximoHoras: 6,
            estado: 'DISPONIBLE'
        });
    }

    const creados = await Parqueadero.insertMany(parqueaderos);

    // Actualizar refs en usuarios
    for (const p of creados) {
        if (p.categoria === 'PRIVADO' && p.residenteAsignado) {
            await Usuario.updateOne({ _id: p.residenteAsignado }, { $set: { parqueaderoAsignado: p._id } });
        }
    }
    return creados;
}

async function crearVisitantes(conjunto, perfil, residentes, contadorCedula) {
    const visitantes = [];
    const residentesArr = residentes.filter(r => r.rol === 'residente');
    for (let i = 0; i < perfil.visitantesRegistrados; i++) {
        const r = pick(residentesArr);
        visitantes.push({
            conjunto: conjunto._id,
            nombre: pick(NOMBRES),
            apellido: pick(APELLIDOS),
            cedula: String(contadorCedula.value++),
            placaVehiculo: generarPlaca(),
            residenteId: r?._id,
            apartamentoDestino: r?.apartamento || '',
            torreDestino: r?.torre || '',
            motivoVisita: pick(MOTIVOS),
            estado: 'pendiente'
        });
    }
    return Visitante.insertMany(visitantes);
}

async function ocuparParqueaderos(conjunto, perfil, residentes, visitantes) {
    const todos = await Parqueadero.find({ conjunto: conjunto._id });
    const residentesPlaca = residentes.filter(u => u.tieneVehiculo && u.placaVehiculo);

    const ahora = Date.now();
    let ocupados = 0;
    for (const p of todos) {
        if (Math.random() > perfil.ocupacion) continue;

        const minutosAtras = randRange(30, 360);
        const horaEntrada = new Date(ahora - minutosAtras * 60 * 1000);

        let placa = null;
        let visitanteRef = null;
        if (p.categoria === 'PRIVADO' && p.residenteAsignado) {
            const r = residentesPlaca.find(u => u._id.toString() === p.residenteAsignado.toString());
            if (r) placa = r.placaVehiculo.toUpperCase();
        } else if (p.categoria === 'VISITANTE' && visitantes.length > 0) {
            const v = pick(visitantes);
            placa = v.placaVehiculo.toUpperCase();
            visitanteRef = v._id;
        }
        if (!placa) continue;

        await Parqueadero.updateOne({ _id: p._id }, {
            $set: {
                estado: 'OCUPADO',
                horaEntrada,
                placaVehiculo: placa,
                visitante: visitanteRef
            }
        });
        ocupados++;
    }
    return ocupados;
}

async function crearHistorial(conjunto, perfil, residentes, visitantes) {
    const accesos = [];
    const residentesPlaca = residentes.filter(u => u.tieneVehiculo && u.placaVehiculo);

    const dias = Math.floor((FECHA_FIN - FECHA_INICIO) / (1000 * 60 * 60 * 24));

    for (let d = 0; d <= dias; d++) {
        const fechaBase = new Date(FECHA_INICIO);
        fechaBase.setDate(fechaBase.getDate() + d);
        if (fechaBase > FECHA_FIN) break;

        const cantidad = randRange(perfil.accesosDia[0], perfil.accesosDia[1]);

        for (let i = 0; i < cantidad; i++) {
            const esResidente = Math.random() < 0.7;
            const horaEntrada = horaRealista(fechaBase);
            if (horaEntrada > FECHA_FIN) continue;

            let placa, nombreUsuario, tipoUsuario, plaza = null;
            if (esResidente && residentesPlaca.length > 0) {
                const r = pick(residentesPlaca);
                placa = r.placaVehiculo;
                nombreUsuario = `${r.nombre} ${r.apellido}`;
                tipoUsuario = 'residente';
            } else if (visitantes.length > 0) {
                const v = pick(visitantes);
                placa = v.placaVehiculo;
                nombreUsuario = `${v.nombre} ${v.apellido}`;
                tipoUsuario = 'visitante';
                const tipoVehiculo = Math.random() < 0.7 ? 'V' : 'VM';
                const max = tipoVehiculo === 'V' ? perfil.visitantesCarro : perfil.visitantesMoto;
                if (max > 0) plaza = `${tipoVehiculo}-${String(1 + rand(max)).padStart(3, '0')}`;
            } else continue;

            accesos.push({
                conjunto: conjunto._id,
                placa,
                tipoAcceso: 'entrada',
                tipoUsuario,
                nombreUsuario,
                plaza,
                fechaHora: horaEntrada
            });

            // Salida 90% (entre 1 y 12 horas despues)
            if (Math.random() < 0.9) {
                const horaSalida = new Date(horaEntrada.getTime() + randRange(1, 12) * 60 * 60 * 1000);
                if (horaSalida <= FECHA_FIN) {
                    accesos.push({
                        conjunto: conjunto._id,
                        placa,
                        tipoAcceso: 'salida',
                        tipoUsuario,
                        nombreUsuario,
                        plaza,
                        fechaHora: horaSalida
                    });
                }
            }
        }
    }

    // Insertar en lotes
    const batch = 1000;
    let total = 0;
    for (let i = 0; i < accesos.length; i += batch) {
        await HistorialAcceso.insertMany(accesos.slice(i, i + batch), { ordered: false });
        total += Math.min(batch, accesos.length - i);
    }
    return total;
}

(async () => {
    try {
        console.log('Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        await limpiar();

        console.log('\n[2/5] Cargando conjuntos...');
        const conjuntos = await Conjunto.find({});
        console.log(`  Encontrados: ${conjuntos.map(c => c.nombre).join(', ')}`);

        const contadorCedula = { value: 1000000000 };
        const datos = [];

        console.log('\n[3/5] Creando usuarios, parqueaderos y visitantes por conjunto...');
        for (const c of conjuntos) {
            const perfil = PERFILES[c.nombre];
            if (!perfil) {
                console.log(`  [SKIP] ${c.nombre} sin perfil definido`);
                continue;
            }
            console.log(`\n  >> ${c.nombre} (${perfil.residentes} residentes objetivo)`);
            const usuarios = await crearUsuarios(c, perfil, contadorCedula);
            const parqueaderos = await crearParqueaderos(c, perfil, usuarios);
            const visitantes = await crearVisitantes(c, perfil, usuarios, contadorCedula);
            console.log(`     usuarios: ${usuarios.length}, parqueaderos: ${parqueaderos.length}, visitantes: ${visitantes.length}`);
            datos.push({ conjunto: c, perfil, usuarios, parqueaderos, visitantes });
        }

        console.log('\n[4/5] Generando ocupacion actual...');
        for (const d of datos) {
            const oc = await ocuparParqueaderos(d.conjunto, d.perfil, d.usuarios, d.visitantes);
            console.log(`  ${d.conjunto.nombre}: ${oc} ocupados (objetivo ${Math.round(d.perfil.ocupacion * 100)}%)`);
        }

        console.log('\n[5/5] Generando historial de accesos (nov 2025 -> hoy)...');
        let totalAccesos = 0;
        for (const d of datos) {
            const n = await crearHistorial(d.conjunto, d.perfil, d.usuarios, d.visitantes);
            console.log(`  ${d.conjunto.nombre}: ${n.toLocaleString()} accesos`);
            totalAccesos += n;
        }

        console.log('\n=== RESUMEN FINAL ===');
        const cnt = await Promise.all([
            Usuario.countDocuments(),
            Conjunto.countDocuments(),
            Parqueadero.countDocuments(),
            Visitante.countDocuments(),
            HistorialAcceso.countDocuments()
        ]);
        console.log(`  usuarios:         ${cnt[0]}`);
        console.log(`  conjuntos:        ${cnt[1]}`);
        console.log(`  parqueaderos:     ${cnt[2]}`);
        console.log(`  visitantes:       ${cnt[3]}`);
        console.log(`  historialAccesos: ${cnt[4].toLocaleString()}`);
        console.log('\nPassword usuarios nuevos: password123');
    } catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
