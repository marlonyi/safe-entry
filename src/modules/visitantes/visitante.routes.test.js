const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Visitante = require('./visitante.model');
const Conjunto = require('../conjuntos/conjunto.model');
const visitanteRoutes = require('./visitante.routes');

let app;
let conjunto;

beforeAll(async () => {
    await connect();
    app = express();
    app.use(express.json());
    app.use('/api/visitantes', visitanteRoutes);
});
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

beforeEach(async () => {
    conjunto = await Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });
});

describe('POST /qr/ingresar/:token', () => {
    test('rechaza con 404 un QR expirado (buscarPorQR filtra qrExpiracion > now)', async () => {
        await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'ABC123',
            conjunto: conjunto._id,
            qrToken: 'token-expirado',
            qrExpiracion: new Date(Date.now() - 60 * 60 * 1000), // 1h en el pasado
        });

        const res = await request(app).post('/api/visitantes/qr/ingresar/token-expirado');

        expect(res.status).toBe(404);
        expect(res.body.valid).toBe(false);
    });

    test('rechaza con 404 un token inexistente', async () => {
        const res = await request(app).post('/api/visitantes/qr/ingresar/no-existe');
        expect(res.status).toBe(404);
    });
});

describe('POST /verificar-acceso', () => {
    // Regresión del plan 003: un visitante sin codigoSecreto genera uno al vuelo
    // (antes reasignaba una const y tiraba TypeError → 500). Ahora, con un código
    // incorrecto, debe responder 401 controlado, NO 500.
    test('con un visitante sin codigoSecreto y código incorrecto responde 401, no 500 (regresión plan 003)', async () => {
        await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '999', placaVehiculo: 'XYZ789',
            conjunto: conjunto._id,
            // codigoSecreto ausente a propósito (default null)
        });

        const res = await request(app)
            .post('/api/visitantes/verificar-acceso')
            .send({ cedula: '999', codigo: '000000' });

        expect(res.status).not.toBe(500);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('exige cédula y código (400 si faltan)', async () => {
        const res = await request(app)
            .post('/api/visitantes/verificar-acceso')
            .send({ cedula: '999' });
        expect(res.status).toBe(400);
    });
});
