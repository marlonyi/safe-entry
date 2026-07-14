const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Visitante = require('./visitante.model');
const Conjunto = require('../conjuntos/conjunto.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');
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

describe('POST /qr/salida/:token', () => {
    // Plan 011: la salida por QR ahora libera la plaza asociada (antes quedaba
    // OCUPADA para siempre con una referencia colgante al visitante que ya salió).
    test('registra la salida y libera la plaza asociada (vuelve a DISPONIBLE)', async () => {
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V9', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO', placaVehiculo: 'ABC123',
        });
        const visitante = await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'ABC123',
            conjunto: conjunto._id, estado: 'ingresado', parqueadero: plaza._id,
            qrToken: 'token-salida', qrExpiracion: new Date(Date.now() + 60 * 60 * 1000),
        });
        plaza.visitante = visitante._id;
        await plaza.save();

        const res = await request(app).post('/api/visitantes/qr/salida/token-salida');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('DISPONIBLE');
        expect(plazaRecargada.visitante).toBeNull();

        const visitanteRecargado = await Visitante.findById(visitante._id);
        expect(visitanteRecargado.estado).toBe('salido');
    });

    // Plan 012: dos salidas concurrentes no deben romper ni liberar dos veces.
    test('dos salidas por QR concurrentes: sin error y plaza liberada una sola vez', async () => {
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V10', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO', placaVehiculo: 'ABC123',
        });
        const visitante = await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'ABC123',
            conjunto: conjunto._id, estado: 'ingresado', parqueadero: plaza._id,
            qrToken: 'tok-concurrente', qrExpiracion: new Date(Date.now() + 60 * 60 * 1000),
        });
        plaza.visitante = visitante._id;
        await plaza.save();

        const [r1, r2] = await Promise.all([
            request(app).post('/api/visitantes/qr/salida/tok-concurrente'),
            request(app).post('/api/visitantes/qr/salida/tok-concurrente'),
        ]);

        expect(r1.status).toBeLessThan(500);
        expect(r2.status).toBeLessThan(500);

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('salido');
        const p = await Parqueadero.findById(plaza._id);
        expect(p.estado).toBe('DISPONIBLE');
        expect(p.visitante).toBeNull();
    });
});
