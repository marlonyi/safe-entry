/**
 * 🏢 Script de Migración Multi-Tenant
 * 
 * Este script migra los datos existentes al modelo multi-tenant:
 * 1. Crea un "Conjunto Principal" si no existe
 * 2. Asigna todos los usuarios/visitantes/parqueaderos existentes a ese conjunto
 * 3. Crea un superadmin si no existe
 * 
 * Ejecutar con: node migrate-multitenant.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Conexión directa a MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/adminResidencial';

// Importar modelos
const Conjunto = require('./config/models/conjunto');
const Usuario = require('./config/models/usuario');
const Visitante = require('./config/models/visitante');
const Parqueadero = require('./config/models/parqueadero');
const HistorialAcceso = require('./config/models/historialAcceso');
const AuditLog = require('./config/models/auditLog');

async function migrar() {
    console.log('🏢 MIGRACIÓN MULTI-TENANT');
    console.log('='.repeat(50));

    try {
        // Conectar a MongoDB
        console.log('\n📡 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a:', MONGO_URI);

        // ========================================
        // 1. CREAR CONJUNTO PRINCIPAL
        // ========================================
        console.log('\n📦 Paso 1: Verificando Conjunto Principal...');

        let conjuntoPrincipal = await Conjunto.findOne({ nombre: "Conjunto Principal" });

        if (!conjuntoPrincipal) {
            conjuntoPrincipal = new Conjunto({
                nombre: "Conjunto Principal",
                direccion: "Por configurar",
                ciudad: "Por configurar",
                estado: "activo",
                configuracion: {
                    maxParqueaderos: 100,
                    maxUsuarios: 500,
                    maxVisitantes: 1000,
                    permitirVisitantes: true
                }
            });
            await conjuntoPrincipal.save();
            console.log('✅ Conjunto Principal creado con ID:', conjuntoPrincipal._id);
        } else {
            console.log('ℹ️  Conjunto Principal ya existe con ID:', conjuntoPrincipal._id);
        }

        const conjuntoId = conjuntoPrincipal._id;

        // ========================================
        // 2. MIGRAR USUARIOS
        // ========================================
        console.log('\n👥 Paso 2: Migrando usuarios...');

        const usuariosSinConjunto = await Usuario.find({
            conjunto: { $exists: false },
            rol: { $ne: 'superadmin' }
        });

        console.log(`   Encontrados ${usuariosSinConjunto.length} usuarios sin conjunto`);

        if (usuariosSinConjunto.length > 0) {
            const resultUsuarios = await Usuario.updateMany(
                { conjunto: { $exists: false }, rol: { $ne: 'superadmin' } },
                { $set: { conjunto: conjuntoId } }
            );
            console.log(`✅ ${resultUsuarios.modifiedCount} usuarios migrados`);
        }

        // También actualizar usuarios con conjunto null (excepto superadmin)
        const usuariosConNull = await Usuario.updateMany(
            { conjunto: null, rol: { $ne: 'superadmin' } },
            { $set: { conjunto: conjuntoId } }
        );
        if (usuariosConNull.modifiedCount > 0) {
            console.log(`✅ ${usuariosConNull.modifiedCount} usuarios adicionales actualizados`);
        }

        // ========================================
        // 3. MIGRAR VISITANTES
        // ========================================
        console.log('\n🚗 Paso 3: Migrando visitantes...');

        const visitantesSinConjunto = await Visitante.countDocuments({
            conjunto: { $exists: false }
        });
        console.log(`   Encontrados ${visitantesSinConjunto} visitantes sin conjunto`);

        if (visitantesSinConjunto > 0) {
            const resultVisitantes = await Visitante.updateMany(
                { conjunto: { $exists: false } },
                { $set: { conjunto: conjuntoId } }
            );
            console.log(`✅ ${resultVisitantes.modifiedCount} visitantes migrados`);
        }

        // También con null
        const visitantesConNull = await Visitante.updateMany(
            { conjunto: null },
            { $set: { conjunto: conjuntoId } }
        );
        if (visitantesConNull.modifiedCount > 0) {
            console.log(`✅ ${visitantesConNull.modifiedCount} visitantes adicionales actualizados`);
        }

        // ========================================
        // 4. MIGRAR PARQUEADEROS
        // ========================================
        console.log('\n🅿️ Paso 4: Migrando parqueaderos...');

        const parqueaderosSinConjunto = await Parqueadero.countDocuments({
            conjunto: { $exists: false }
        });
        console.log(`   Encontrados ${parqueaderosSinConjunto} parqueaderos sin conjunto`);

        if (parqueaderosSinConjunto > 0) {
            const resultParqueaderos = await Parqueadero.updateMany(
                { conjunto: { $exists: false } },
                { $set: { conjunto: conjuntoId } }
            );
            console.log(`✅ ${resultParqueaderos.modifiedCount} parqueaderos migrados`);
        }

        const parqueaderosConNull = await Parqueadero.updateMany(
            { conjunto: null },
            { $set: { conjunto: conjuntoId } }
        );
        if (parqueaderosConNull.modifiedCount > 0) {
            console.log(`✅ ${parqueaderosConNull.modifiedCount} parqueaderos adicionales actualizados`);
        }

        // ========================================
        // 5. MIGRAR HISTORIAL DE ACCESOS
        // ========================================
        console.log('\n📋 Paso 5: Migrando historial de accesos...');

        const historialSinConjunto = await HistorialAcceso.countDocuments({
            conjunto: { $exists: false }
        });

        if (historialSinConjunto > 0) {
            const resultHistorial = await HistorialAcceso.updateMany(
                { conjunto: { $exists: false } },
                { $set: { conjunto: conjuntoId } }
            );
            console.log(`✅ ${resultHistorial.modifiedCount} registros de historial migrados`);
        }

        const historialConNull = await HistorialAcceso.updateMany(
            { conjunto: null },
            { $set: { conjunto: conjuntoId } }
        );
        if (historialConNull.modifiedCount > 0) {
            console.log(`✅ ${historialConNull.modifiedCount} registros adicionales actualizados`);
        }

        // ========================================
        // 6. MIGRAR AUDIT LOGS (opcional - los nuevos ya tendrán conjunto)
        // ========================================
        console.log('\n📝 Paso 6: Migrando logs de auditoría...');

        // Los audit logs viejos pueden quedarse sin conjunto (historial)
        // Solo actualizamos los que tengan usuario con conjunto asignado
        console.log('ℹ️  Los logs de auditoría históricos se mantienen sin conjunto (no hay forma de determinar a cuál pertenecían)');

        // ========================================
        // 7. CREAR/VERIFICAR SUPERADMIN
        // ========================================
        console.log('\n👑 Paso 7: Verificando SuperAdmin...');

        const superadminCedula = process.env.SUPERADMIN_CEDULA || process.env.ADMIN_CEDULA || "123456789";
        const superadminPassword = process.env.SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";

        let superadmin = await Usuario.findOne({ rol: 'superadmin' });

        if (!superadmin) {
            // Verificar si existe el admin anterior y actualizarlo
            const adminAnterior = await Usuario.findOne({ cedula: superadminCedula });

            if (adminAnterior) {
                adminAnterior.rol = 'superadmin';
                adminAnterior.conjunto = null;
                await adminAnterior.save();
                console.log('🔄 Admin existente actualizado a SuperAdmin');
            } else {
                const hashedPassword = await bcrypt.hash(superadminPassword, 10);
                superadmin = new Usuario({
                    nombre: "Super",
                    apellido: "Administrador",
                    cedula: superadminCedula,
                    apartamento: "N/A",
                    torre: "N/A",
                    password: hashedPassword,
                    rol: "superadmin",
                    conjunto: null
                });
                await superadmin.save();
                console.log('✅ SuperAdmin creado');
            }
        } else {
            console.log('ℹ️  SuperAdmin ya existe');
        }

        // ========================================
        // 8. RESUMEN FINAL
        // ========================================
        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMEN DE MIGRACIÓN');
        console.log('='.repeat(50));

        const stats = {
            conjuntos: await Conjunto.countDocuments(),
            usuarios: await Usuario.countDocuments({ rol: { $ne: 'superadmin' } }),
            superadmins: await Usuario.countDocuments({ rol: 'superadmin' }),
            visitantes: await Visitante.countDocuments(),
            parqueaderos: await Parqueadero.countDocuments(),
            historial: await HistorialAcceso.countDocuments()
        };

        console.log(`
   🏢 Conjuntos:     ${stats.conjuntos}
   👑 SuperAdmins:   ${stats.superadmins}
   👥 Usuarios:      ${stats.usuarios}
   🚗 Visitantes:    ${stats.visitantes}
   🅿️ Parqueaderos:  ${stats.parqueaderos}
   📋 Historial:     ${stats.historial}
        `);

        console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('\n⚠️  Recuerda:');
        console.log('   1. Puedes renombrar "Conjunto Principal" desde el panel SuperAdmin');
        console.log('   2. Las credenciales del SuperAdmin son las mismas del .env');
        console.log('   3. Accede a /superadmin para gestionar conjuntos\n');

    } catch (error) {
        console.error('\n❌ ERROR EN MIGRACIÓN:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Desconectado de MongoDB');
    }
}

// Ejecutar migración
migrar();
