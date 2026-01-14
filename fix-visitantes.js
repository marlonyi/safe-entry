const mongoose = require('mongoose');
const crypto = require('crypto');

mongoose.connect('mongodb://localhost:27017/adminResidencial').then(async () => {
    console.log('Conectado a MongoDB');

    const collection = mongoose.connection.db.collection('visitantes');

    // Obtener todos los visitantes
    const visitantes = await collection.find({}).toArray();
    console.log('Total visitantes:', visitantes.length);

    for (const v of visitantes) {
        // Generar un secreto ÚNICO y permanente
        const secretoFijo = crypto.randomBytes(16).toString('hex');

        // Actualizarlo directamente en MongoDB
        await collection.updateOne(
            { _id: v._id },
            { $set: { codigoSecreto: secretoFijo } }
        );

        console.log('Actualizado:', v.nombre, v.apellido, '| Nuevo secreto:', secretoFijo.substring(0, 8) + '...');
    }

    console.log('\n✅ Todos los visitantes actualizados con secretos fijos!');
    mongoose.disconnect();
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
