const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/adminResidencial';

        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log(`🔥 Conectado a MongoDB en: ${uri}`);
    } catch (error) {
        console.error('❌ Error al conectar la base de datos:', error);
        process.exit(1);
    }
};

module.exports = conectarDB;