/**
 * 🔧 Script de Diagnóstico y Corrección Multi-Tenant
 * 
 * Este script diagnostica y corrige problemas comunes:
 * 1. Parqueaderos sin conjunto asignado (muestran 0/0)
 * 2. Usuarios sin conjunto (no pueden ver datos)
 * 
 * Ejecutar con: node diagnostico-multitenant.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/adminResidencial';

const Conjunto = require('./models/conjunto');
const Usuario = require('./models/usuario');
const Visitante = require('./models/visitante');
const Parqueadero = require('./models/parqueadero');

async function diagnosticar() {
    console.log('🔧 DIAGNÓSTICO MULTI-TENANT');
    console.log('='.repeat(60));

    try {
        console.log('\n📡 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a:', MONGO_URI);

        // ========================================
        // 1. VERIFICAR CONJUNTOS EXISTENTES
        // ========================================
        console.log('\n📦 PASO 1: Verificando conjuntos...');
        const conjuntos = await Conjunto.find({}).lean();

        if (conjuntos.length === 0) {
            console.log('❌ NO HAY CONJUNTOS CREADOS');
            console.log('   Ejecuta primero: node migrate-multitenant.js');
            process.exit(1);
        }

        console.log(`   Encontrados ${conjuntos.length} conjunto(s):`);
        for (const c of conjuntos) {
            console.log(`   - ${c.nombre} (${c._id}) - Estado: ${c.estado}`);
        }

        const conjuntoPrincipal = conjuntos[0];

        // ========================================
        // 2. DIAGNOSTICAR PARQUEADEROS
        // ========================================
        console.log('\n🅿️ PASO 2: Diagnosticando parqueaderos...');

        const totalParqueaderos = await Parqueadero.countDocuments();
        const parqueaderosSinConjunto = await Parqueadero.countDocuments({
            $or: [
                { conjunto: null },
                { conjunto: { $exists: false } }
            ]
        });
        const parqueaderosConConjunto = await Parqueadero.countDocuments({
            conjunto: { $ne: null, $exists: true }
        });

        console.log(`   Total parqueaderos: ${totalParqueaderos}`);
        console.log(`   Con conjunto asignado: ${parqueaderosConConjunto}`);
        console.log(`   SIN conjunto (problema): ${parqueaderosSinConjunto}`);

        // Mostrar distribución por conjunto
        console.log('\n   Distribución por conjunto:');
        for (const c of conjuntos) {
            const count = await Parqueadero.countDocuments({ conjunto: c._id });
            console.log(`   - ${c.nombre}: ${count} plazas`);
        }

        // ========================================
        // 3. DIAGNOSTICAR USUARIOS
        // ========================================
        console.log('\n👥 PASO 3: Diagnosticando usuarios...');

        const totalUsuarios = await Usuario.countDocuments({ rol: { $ne: 'superadmin' } });
        const usuariosSinConjunto = await Usuario.countDocuments({
            rol: { $ne: 'superadmin' },
            $or: [
                { conjunto: null },
                { conjunto: { $exists: false } }
            ]
        });

        console.log(`   Total usuarios (sin superadmin): ${totalUsuarios}`);
        console.log(`   SIN conjunto (problema): ${usuariosSinConjunto}`);

        // Mostrar por rol
        const porRol = await Usuario.aggregate([
            { $group: { _id: '$rol', count: { $sum: 1 } } }
        ]);
        console.log('   Por rol:', porRol.map(r => `${r._id}: ${r.count}`).join(', '));

        // ========================================
        // 4. DIAGNOSTICAR VISITANTES
        // ========================================
        console.log('\n🚗 PASO 4: Diagnosticando visitantes...');

        const totalVisitantes = await Visitante.countDocuments();
        const visitantesSinConjunto = await Visitante.countDocuments({
            $or: [
                { conjunto: null },
                { conjunto: { $exists: false } }
            ]
        });

        console.log(`   Total visitantes: ${totalVisitantes}`);
        console.log(`   SIN conjunto (problema): ${visitantesSinConjunto}`);

        // ========================================
        // 5. RESUMEN Y CORRECCIONES
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN');
        console.log('='.repeat(60));

        const hayProblemas = parqueaderosSinConjunto > 0 ||
            usuariosSinConjunto > 0 ||
            visitantesSinConjunto > 0;

        if (!hayProblemas) {
            console.log('\n✅ Todo está correctamente configurado.');
            console.log('   Si el mapa de parqueo muestra 0/0, verifica que:');
            console.log('   1. Existan plazas de parqueadero creadas');
            console.log('   2. El usuario esté logueado en el conjunto correcto');
            console.log('   3. El token JWT contenga el conjuntoId correcto');
        } else {
            console.log('\n⚠️  HAY PROBLEMAS QUE REQUIEREN CORRECCIÓN:');
            if (parqueaderosSinConjunto > 0) {
                console.log(`   - ${parqueaderosSinConjunto} parqueaderos sin conjunto`);
            }
            if (usuariosSinConjunto > 0) {
                console.log(`   - ${usuariosSinConjunto} usuarios sin conjunto`);
            }
            if (visitantesSinConjunto > 0) {
                console.log(`   - ${visitantesSinConjunto} visitantes sin conjunto`);
            }

            console.log('\n¿Deseas corregir estos problemas? (asignará todo a:', conjuntoPrincipal.nombre, ')');
            console.log('   Ejecuta: node diagnostico-multitenant.js --fix');
        }

        // Si se pasó --fix, corregir
        if (process.argv.includes('--fix')) {
            console.log('\n🔧 APLICANDO CORRECCIONES...');

            if (parqueaderosSinConjunto > 0) {
                const result = await Parqueadero.updateMany(
                    { $or: [{ conjunto: null }, { conjunto: { $exists: false } }] },
                    { $set: { conjunto: conjuntoPrincipal._id } }
                );
                console.log(`   ✅ ${result.modifiedCount} parqueaderos corregidos`);
            }

            if (usuariosSinConjunto > 0) {
                const result = await Usuario.updateMany(
                    {
                        rol: { $ne: 'superadmin' },
                        $or: [{ conjunto: null }, { conjunto: { $exists: false } }]
                    },
                    { $set: { conjunto: conjuntoPrincipal._id } }
                );
                console.log(`   ✅ ${result.modifiedCount} usuarios corregidos`);
            }

            if (visitantesSinConjunto > 0) {
                const result = await Visitante.updateMany(
                    { $or: [{ conjunto: null }, { conjunto: { $exists: false } }] },
                    { $set: { conjunto: conjuntoPrincipal._id } }
                );
                console.log(`   ✅ ${result.modifiedCount} visitantes corregidos`);
            }

            console.log('\n✅ CORRECCIONES APLICADAS');
            console.log('   Recarga la aplicación para ver los cambios.');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Desconectado de MongoDB');
    }
}

diagnosticar();
