/**
 * Script de mantenimiento: libera plazas que quedaron OCUPADO pero
 * cuyo visitante ya salió o fue eliminado.
 *
 * Uso:
 *   docker exec -it safeentry-backend node scripts/fix-plazas-atascadas.js
 *   (o local: node scripts/fix-plazas-atascadas.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/adminResidencial';

(async () => {
    console.log('🔌 Conectando a:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado\n');

    const db = mongoose.connection.db;

    const plazasOcupadas = await db.collection('parqueaderos').find({
        estado: 'OCUPADO',
        categoria: 'VISITANTE'
    }).toArray();

    console.log(`📊 Plazas de visitantes OCUPADO: ${plazasOcupadas.length}\n`);

    let liberadas = 0;
    for (const plaza of plazasOcupadas) {
        let liberar = false;
        let razon = '';

        if (!plaza.visitante) {
            liberar = true;
            razon = 'sin visitante asignado';
        } else {
            const visitante = await db.collection('visitantes').findOne({ _id: plaza.visitante });
            if (!visitante) {
                liberar = true;
                razon = 'visitante eliminado';
            } else if (visitante.estado === 'salido') {
                liberar = true;
                razon = `visitante ${visitante.nombre} ${visitante.apellido} ya salió`;
            }
        }

        if (liberar) {
            await db.collection('parqueaderos').updateOne(
                { _id: plaza._id },
                {
                    $set: {
                        estado: 'DISPONIBLE',
                        visitante: null,
                        horaAsignacion: null,
                        horaEntrada: null,
                        placaVehiculo: null
                    }
                }
            );
            // Limpiar referencia en el visitante también
            if (plaza.visitante) {
                await db.collection('visitantes').updateOne(
                    { _id: plaza.visitante },
                    { $set: { parqueadero: null } }
                );
            }
            liberadas++;
            console.log(`  🔓 Liberada plaza ${plaza.numero} (${razon})`);
        }
    }

    console.log(`\n✅ Total plazas liberadas: ${liberadas}`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
