/**
 * Distribuye los estados de los visitantes para mayor realismo:
 * - 50% pendiente (recien registrados, no han ingresado aun)
 * - 25% ingresado (estan dentro del conjunto en este momento)
 * - 25% salido (ya completaron su visita)
 *
 * Tambien asigna fechas de QR coherentes y motivos variados.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Visitante = require('../models/visitante');
const Conjunto = require('../models/conjunto');

const ESTADOS = ['pendiente', 'ingresado', 'salido'];
const PESOS = [0.50, 0.25, 0.25];

function pickEstado() {
    const r = Math.random();
    let acum = 0;
    for (let i = 0; i < ESTADOS.length; i++) {
        acum += PESOS[i];
        if (r <= acum) return ESTADOS[i];
    }
    return 'pendiente';
}

(async () => {
    try {
        console.log('Conectando...');
        await mongoose.connect(process.env.MONGO_URI);

        const conjuntos = await Conjunto.find({}).lean();
        console.log(`\nConjuntos: ${conjuntos.length}`);

        const ahora = Date.now();
        let stats = { pendiente: 0, ingresado: 0, salido: 0 };

        for (const c of conjuntos) {
            const visitantes = await Visitante.find({ conjunto: c._id });
            console.log(`\n[${c.nombre}] ${visitantes.length} visitantes`);

            for (const v of visitantes) {
                const nuevoEstado = pickEstado();
                const update = { estado: nuevoEstado };

                if (nuevoEstado === 'pendiente') {
                    // QR generado en las ultimas 24h, valido por 24h mas
                    update.qrToken = v.qrToken || require('crypto').randomBytes(16).toString('hex');
                    update.qrExpiracion = new Date(ahora + 24 * 60 * 60 * 1000);
                } else if (nuevoEstado === 'ingresado') {
                    // Entro hace 1-6 horas, QR vigente
                    update.qrToken = v.qrToken || require('crypto').randomBytes(16).toString('hex');
                    update.qrExpiracion = new Date(ahora + 12 * 60 * 60 * 1000);
                } else {
                    // Salio recientemente o hace dias, QR ya vencido
                    update.qrToken = v.qrToken || require('crypto').randomBytes(16).toString('hex');
                    update.qrExpiracion = new Date(ahora - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
                }

                await Visitante.updateOne({ _id: v._id }, { $set: update });
                stats[nuevoEstado]++;
            }
        }

        console.log('\n=== Resumen ===');
        console.log(`  pendiente:  ${stats.pendiente}`);
        console.log(`  ingresado:  ${stats.ingresado}`);
        console.log(`  salido:     ${stats.salido}`);
        console.log(`  total:      ${stats.pendiente + stats.ingresado + stats.salido}`);

        // Verificar por conjunto
        console.log('\n=== Por conjunto ===');
        for (const c of conjuntos) {
            const [p, i, s] = await Promise.all([
                Visitante.countDocuments({ conjunto: c._id, estado: 'pendiente' }),
                Visitante.countDocuments({ conjunto: c._id, estado: 'ingresado' }),
                Visitante.countDocuments({ conjunto: c._id, estado: 'salido' })
            ]);
            console.log(`  ${c.nombre}: pend=${p}, ingr=${i}, sal=${s}`);
        }
    } catch (e) {
        console.error('Error:', e);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
