/**
 * Renombra los parqueaderos de moto con prefijos diferenciados:
 * - Privadas moto: P-XXX -> PM-XXX
 * - Visitantes moto: V-XXX -> VM-XXX
 *
 * Esto permite a Power BI detectar el tipo de vehiculo a partir
 * del prefijo de [numero] (sin depender del campo tipoVehiculo).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
const Conjunto = require('../models/conjunto');
const Parqueadero = require('../models/parqueadero');

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Conectado.');

        const conjuntos = await Conjunto.find({});
        let totalRenombrados = 0;

        for (const c of conjuntos) {
            console.log(`\n[${c.nombre}]`);
            const motos = await Parqueadero.find({
                conjunto: c._id,
                tipoVehiculo: 'MOTO'
            }).sort({ numero: 1 });

            let pmCount = 1;
            let vmCount = 1;
            for (const p of motos) {
                let nuevoNumero;
                if (p.categoria === 'PRIVADO') {
                    nuevoNumero = `PM-${String(pmCount++).padStart(3, '0')}`;
                } else {
                    nuevoNumero = `VM-${String(vmCount++).padStart(3, '0')}`;
                }
                if (p.numero !== nuevoNumero) {
                    await Parqueadero.updateOne(
                        { _id: p._id },
                        { $set: { numero: nuevoNumero } }
                    );
                    console.log(`  ${p.numero} -> ${nuevoNumero} (${p.categoria})`);
                    totalRenombrados++;
                }
            }
        }

        console.log(`\nTotal renombrados: ${totalRenombrados}`);

        // Resumen final
        console.log('\n=== Resumen por conjunto ===');
        for (const c of conjuntos) {
            const cP = await Parqueadero.countDocuments({ conjunto: c._id, numero: { $regex: '^P-' } });
            const cPM = await Parqueadero.countDocuments({ conjunto: c._id, numero: { $regex: '^PM-' } });
            const cV = await Parqueadero.countDocuments({ conjunto: c._id, numero: { $regex: '^V-' } });
            const cVM = await Parqueadero.countDocuments({ conjunto: c._id, numero: { $regex: '^VM-' } });
            console.log(`${c.nombre}: P-=${cP}, PM-=${cPM}, V-=${cV}, VM-=${cVM}`);
        }
    } catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
