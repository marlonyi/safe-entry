const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/adminResidencial', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(' Conectado a la base de datos local');
    } catch (error) {
        console.error(' Error al conectar la base de datos:', error);
    }
};

module.exports = conectarDB;
