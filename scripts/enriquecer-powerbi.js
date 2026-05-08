/**
 * Enriquece los datos para que Power BI tenga distribuciones representativas:
 * - Garantiza varias motos por conjunto (privadas y visitantes).
 * - Marca ~30% de parqueaderos como OCUPADO con horaEntrada y placa.
 * - Normaliza placas a mayusculas en parqueaderos, usuarios y visitantes.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
const Conjunto = require('../models/conjunto');
const Usuario = require('../models/usuario');
const Visitante = require('../models/visitante');
const Parqueadero = require('../models/parqueadero');

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

async function asegurarMotosPorConjunto(conjuntoId) {
    const privados = await Parqueadero.find({ conjunto: conjuntoId, categoria: 'PRIVADO' });
    const visitantes = await Parqueadero.find({ conjunto: conjuntoId, categoria: 'VISITANTE' });

    const privadosMoto = privados.filter(p => p.tipoVehiculo === 'MOTO');
    const privadosCarro = privados.filter(p => p.tipoVehiculo === 'CARRO');
    const visitMoto = visitantes.filter(p => p.tipoVehiculo === 'MOTO');
    const visitCarro = visitantes.filter(p => p.tipoVehiculo === 'CARRO');

    // Apuntar a >=3 motos privadas y >=2 visitantes moto
    const objetivoPrivMoto = 3;
    const objetivoVisMoto = 2;

    const cambiosPriv = Math.max(0, objetivoPrivMoto - privadosMoto.length);
    const cambiosVis = Math.max(0, objetivoVisMoto - visitMoto.length);

    let actualizadosMoto = 0;
    for (let i = 0; i < cambiosPriv && i < privadosCarro.length; i++) {
        await Parqueadero.updateOne({ _id: privadosCarro[i]._id }, { $set: { tipoVehiculo: 'MOTO' } });
        actualizadosMoto++;
    }
    for (let i = 0; i < cambiosVis && i < visitCarro.length; i++) {
        await Parqueadero.updateOne({ _id: visitCarro[i]._id }, { $set: { tipoVehiculo: 'MOTO' } });
        actualizadosMoto++;
    }
    return actualizadosMoto;
}

async function ocuparParqueaderos(conjuntoId) {
    const todos = await Parqueadero.find({ conjunto: conjuntoId });
    const usuariosVehiculo = await Usuario.find({
        conjunto: conjuntoId,
        rol: 'residente',
        tieneVehiculo: true,
        placaVehiculo: { $ne: null }
    });
    const visitantes = await Visitante.find({ conjunto: conjuntoId });

    let ocupados = 0;
    const ahora = Date.now();

    for (const p of todos) {
        if (Math.random() > 0.35) continue; // 35% ocupados

        // Hora de entrada entre 30 min y 6 horas atras
        const minutosAtras = 30 + rand(330);
        const horaEntrada = new Date(ahora - minutosAtras * 60 * 1000);

        let placa = null;
        let visitanteRef = null;

        if (p.categoria === 'PRIVADO' && p.residenteAsignado) {
            const r = usuariosVehiculo.find(u => u._id.toString() === p.residenteAsignado.toString());
            if (r) placa = (r.placaVehiculo || '').toUpperCase();
        } else if (p.categoria === 'VISITANTE' && visitantes.length > 0) {
            const v = pick(visitantes);
            placa = (v.placaVehiculo || '').toUpperCase();
            visitanteRef = v._id;
        }

        if (!placa) continue;

        await Parqueadero.updateOne(
            { _id: p._id },
            {
                $set: {
                    estado: 'OCUPADO',
                    horaEntrada,
                    placaVehiculo: placa,
                    visitante: visitanteRef
                }
            }
        );
        ocupados++;
    }
    return ocupados;
}

async function normalizarPlacas() {
    // Todas las placas a mayusculas
    const usuarios = await Usuario.find({ placaVehiculo: { $ne: null } });
    for (const u of usuarios) {
        const updates = {};
        if (u.placaVehiculo) updates.placaVehiculo = u.placaVehiculo.toUpperCase();
        if (u.placa2Vehiculo) updates.placa2Vehiculo = u.placa2Vehiculo.toUpperCase();
        if (Object.keys(updates).length > 0) {
            await Usuario.updateOne({ _id: u._id }, { $set: updates });
        }
    }
    const visitantes = await Visitante.find({});
    for (const v of visitantes) {
        if (v.placaVehiculo) {
            await Visitante.updateOne(
                { _id: v._id },
                { $set: { placaVehiculo: v.placaVehiculo.toUpperCase() } }
            );
        }
    }
    return { usuarios: usuarios.length, visitantes: visitantes.length };
}

(async () => {
    try {
        console.log('Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        console.log('\n[1] Normalizando placas a mayusculas...');
        const norm = await normalizarPlacas();
        console.log(`  Usuarios revisados: ${norm.usuarios}, visitantes: ${norm.visitantes}`);

        console.log('\n[2] Asegurando motos por conjunto...');
        const conjuntos = await Conjunto.find({});
        for (const c of conjuntos) {
            const cambios = await asegurarMotosPorConjunto(c._id);
            console.log(`  ${c.nombre}: parqueaderos convertidos a MOTO = ${cambios}`);
        }

        console.log('\n[3] Generando ocupacion actual (~35%)...');
        for (const c of conjuntos) {
            const ocup = await ocuparParqueaderos(c._id);
            console.log(`  ${c.nombre}: ${ocup} parqueaderos ocupados`);
        }

        console.log('\n[4] Resumen por conjunto:');
        for (const c of conjuntos) {
            const total = await Parqueadero.countDocuments({ conjunto: c._id });
            const ocupados = await Parqueadero.countDocuments({ conjunto: c._id, estado: 'OCUPADO' });
            const privCarro = await Parqueadero.countDocuments({ conjunto: c._id, categoria: 'PRIVADO', tipoVehiculo: 'CARRO' });
            const privMoto = await Parqueadero.countDocuments({ conjunto: c._id, categoria: 'PRIVADO', tipoVehiculo: 'MOTO' });
            const visCarro = await Parqueadero.countDocuments({ conjunto: c._id, categoria: 'VISITANTE', tipoVehiculo: 'CARRO' });
            const visMoto = await Parqueadero.countDocuments({ conjunto: c._id, categoria: 'VISITANTE', tipoVehiculo: 'MOTO' });
            console.log(`  ${c.nombre}:`);
            console.log(`    total ${total}, ocupados ${ocupados}`);
            console.log(`    PRIV: carro ${privCarro}, moto ${privMoto}`);
            console.log(`    VIS:  carro ${visCarro}, moto ${visMoto}`);
        }
    } catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
