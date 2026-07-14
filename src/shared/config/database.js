const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/adminResidencial';

        // useNewUrlParser/useUnifiedTopology son no-ops desde el driver que
        // empaqueta Mongoose 7+, y Mongoose 8 ya no los acepta como opciones.
        await mongoose.connect(uri);

        console.log(`🔥 Conectado a MongoDB en: ${uri}`);
    } catch (error) {
        console.error('❌ Error al conectar la base de datos:', error);
        process.exit(1);
    }
};

module.exports = conectarDB;