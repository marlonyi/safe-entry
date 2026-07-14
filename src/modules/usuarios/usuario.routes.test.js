const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Usuario = require('./usuario.model');
const Conjunto = require('../conjuntos/conjunto.model');
const usuarioRoutes = require('./usuario.routes');

let app;

beforeAll(async () => {
    await connect();
    await Usuario.init(); // construir índices únicos (conjunto+cedula)
    app = express();
    app.use(express.json());
    app.use('/api/usuarios', usuarioRoutes);
});
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

async function crearResidente({ cedula = '12345', password = 'secreta1' } = {}) {
    const conjunto = await Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });
    const usuario = await Usuario.create({
        conjunto: conjunto._id,
        nombre: 'Ana', apellido: 'Gómez', cedula,
        password: await bcrypt.hash(password, 10),
        rol: 'residente',
    });
    return { conjunto, usuario };
}

describe('POST /api/usuarios/login', () => {
    test('login correcto de un residente devuelve token y datos del usuario', async () => {
        await crearResidente({ cedula: '12345', password: 'secreta1' });

        const res = await request(app)
            .post('/api/usuarios/login')
            .send({ cedula: '12345', password: 'secreta1' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect(res.body.refreshToken).toBeTruthy();
        expect(res.body.usuario.cedula).toBe('12345');
        expect(res.body.usuario.rol).toBe('residente');
    });

    test('contraseña incorrecta responde 400', async () => {
        await crearResidente({ cedula: '12345', password: 'secreta1' });

        const res = await request(app)
            .post('/api/usuarios/login')
            .send({ cedula: '12345', password: 'incorrecta' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/incorrecta/i);
    });

    test('usuario inexistente responde 400', async () => {
        const res = await request(app)
            .post('/api/usuarios/login')
            .send({ cedula: '999999', password: 'loquesea' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no encontrado/i);
    });

    test('conjunto suspendido bloquea el login con 403', async () => {
        const conjunto = await Conjunto.create({ nombre: 'Susp', direccion: 'x', ciudad: 'x', estado: 'suspendido' });
        await Usuario.create({
            conjunto: conjunto._id, nombre: 'B', apellido: 'B', cedula: '55555',
            password: await bcrypt.hash('secreta1', 10), rol: 'residente',
        });

        const res = await request(app)
            .post('/api/usuarios/login')
            .send({ cedula: '55555', password: 'secreta1' });

        expect(res.status).toBe(403);
    });
});
