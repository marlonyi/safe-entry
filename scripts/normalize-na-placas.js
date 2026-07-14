/**
 * Script de migración (OPCIONAL): normaliza a null los visitantes que quedaron
 * con placaVehiculo === 'N/A' (convención antigua) para dejar la data consistente
 * con el nuevo esquema (placa null para visitantes sin vehículo). Ver plan 013.
 *
 * Por defecto corre en modo DRY-RUN: solo cuenta cuántos documentos cambiaría,
 * SIN modificar nada. Para aplicar los cambios de verdad, pasar --apply.
 *
 * Uso:
 *   node scripts/normalize-na-placas.js            # dry-run (no modifica)
 *   node scripts/normalize-na-placas.js --apply    # aplica la migración
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/adminResidencial';
const APPLY = process.argv.includes('--apply');

(async () => {
    console.log('🔌 Conectando a:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado\n');

    const db = mongoose.connection.db;
    const filtro = { placaVehiculo: 'N/A' };

    const afectados = await db.collection('visitantes').countDocuments(filtro);
    console.log(`📊 Visitantes con placaVehiculo='N/A': ${afectados}`);

    if (afectados === 0) {
        console.log('👌 Nada que migrar.');
    } else if (!APPLY) {
        console.log(`\n🧪 DRY-RUN: se normalizarían ${afectados} documento(s) a placaVehiculo=null.`);
        console.log('   Ejecuta con --apply para aplicar los cambios.');
    } else {
        const res = await db.collection('visitantes').updateMany(filtro, { $set: { placaVehiculo: null } });
        console.log(`\n✅ Migrados ${res.modifiedCount} documento(s) a placaVehiculo=null.`);
    }

    await mongoose.connection.close();
    process.exit(0);
})().catch((err) => {
    console.error('❌ Error en la migración:', err.message);
    process.exit(1);
});
