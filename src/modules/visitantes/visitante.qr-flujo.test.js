/**
 * Tests de CARACTERIZACIÓN del flujo QR / registro de acceso (visitante.routes.js).
 * Capturan el comportamiento ACTUAL antes de extraer registrarAcceso() y la
 * fábrica de HistorialAcceso — no juzgan si el comportamiento es el deseado.
 *
 * Comportamientos actuales documentados aquí a propósito:
 *  - El campo `metodo` que escriben los handlers NO existe en el schema de
 *    HistorialAcceso → Mongoose (strict) lo descarta silenciosamente.
 *  - POST /qr/ingreso/:token NO crea HistorialAcceso ni chequea idempotencia
 *    (a diferencia de /qr/ingresar/:token).
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Visitante = require('./visitante.model');
const Conjunto = require('../conjuntos/conjunto.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');
const HistorialAcceso = require('../../shared/models/historialAcceso');
const visitanteRoutes = require('./visitante.routes');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto';

let app;
let conjunto;
let conjuntoAjeno;

const tokenPorteria = (conjuntoId) =>
    jwt.sign({ id: 'portero1', rol: 'porteria', conjuntoId: conjuntoId.toString() }, JWT_SECRET);

const crearVisitanteConQR = async (overrides = {}) =>
    Visitante.create({
        nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'ABC123',
        conjunto: conjunto._id,
        qrToken: 'tok-valido',
        qrExpiracion: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
    });

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
    conjuntoAjeno = await Conjunto.create({ nombre: 'Otro', direccion: 'y', ciudad: 'y', estado: 'activo' });
});

describe('POST /qr/ingresar/:token (público, un solo paso)', () => {
    test('pendiente → ingresado y crea HistorialAcceso de entrada', async () => {
        const visitante = await crearVisitanteConQR();

        const res = await request(app).post('/api/visitantes/qr/ingresar/tok-valido');

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.visitante.estado).toBe('ingresado');

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('ingresado');

        const accesos = await HistorialAcceso.find({ conjunto: conjunto._id });
        expect(accesos).toHaveLength(1);
        expect(accesos[0].tipoAcceso).toBe('entrada');
        expect(accesos[0].tipoUsuario).toBe('visitante');
        expect(accesos[0].placa).toBe('ABC123');
        expect(accesos[0].nombreUsuario).toBe('Ana Gómez');
    });

    test('persiste `metodo` qr_scan (campo añadido al schema en la campaña de deepening)', async () => {
        await crearVisitanteConQR();
        await request(app).post('/api/visitantes/qr/ingresar/tok-valido');

        const acceso = await HistorialAcceso.findOne({ conjunto: conjunto._id }).lean();
        // Antes el schema no tenía `metodo` y Mongoose lo descartaba en silencio.
        expect(acceso.metodo).toBe('qr_scan');
    });

    test('idempotencia: segundo ingreso responde yaIngreso y NO duplica historial', async () => {
        await crearVisitanteConQR();

        await request(app).post('/api/visitantes/qr/ingresar/tok-valido');
        const res2 = await request(app).post('/api/visitantes/qr/ingresar/tok-valido');

        expect(res2.status).toBe(200);
        expect(res2.body.yaIngreso).toBe(true);

        const accesos = await HistorialAcceso.find({});
        expect(accesos).toHaveLength(1);
    });

    test('visitante sin placa registra placa SIN-PLACA', async () => {
        await crearVisitanteConQR({ placaVehiculo: null, cedula: '222' });

        await request(app).post('/api/visitantes/qr/ingresar/tok-valido');

        const acceso = await HistorialAcceso.findOne({});
        expect(acceso.placa).toBe('SIN-PLACA');
    });
});

describe('GET /qr/verificar/:token (solo consulta)', () => {
    test('devuelve datos del visitante sin cambiar su estado ni escribir historial', async () => {
        const visitante = await crearVisitanteConQR();

        const res = await request(app).get('/api/visitantes/qr/verificar/tok-valido');

        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.visitante.cedula).toBe('111');

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('pendiente');
        expect(await HistorialAcceso.countDocuments({})).toBe(0);
    });
});

describe('POST /:visitanteId/registrar-ingreso (portería, manual)', () => {
    test('sin token responde 401', async () => {
        const visitante = await crearVisitanteConQR();
        const res = await request(app).post(`/api/visitantes/${visitante._id}/registrar-ingreso`);
        expect(res.status).toBe(401);
    });

    test('portero del conjunto registra ingreso y crea historial de entrada', async () => {
        const visitante = await crearVisitanteConQR();

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-ingreso`)
            .set('Authorization', `Bearer ${tokenPorteria(conjunto._id)}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('ingresado');

        const acceso = await HistorialAcceso.findOne({});
        expect(acceso.tipoAcceso).toBe('entrada');
        expect(acceso.nombreUsuario).toBe('Ana Gómez');
    });

    test('portero de OTRO conjunto recibe 403 (aislamiento tenant)', async () => {
        const visitante = await crearVisitanteConQR();

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-ingreso`)
            .set('Authorization', `Bearer ${tokenPorteria(conjuntoAjeno._id)}`);

        expect(res.status).toBe(403);
        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('pendiente');
    });

    test('visitante ya ingresado responde 400', async () => {
        const visitante = await crearVisitanteConQR({ estado: 'ingresado' });

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-ingreso`)
            .set('Authorization', `Bearer ${tokenPorteria(conjunto._id)}`);

        expect(res.status).toBe(400);
    });
});

describe('POST /:visitanteId/registrar-salida (portería, manual)', () => {
    test('registra salida, libera plaza (reset completo) y crea historial de salida', async () => {
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V1', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO', placaVehiculo: 'ABC123',
        });
        const visitante = await crearVisitanteConQR({ estado: 'ingresado', parqueadero: plaza._id });
        plaza.visitante = visitante._id;
        await plaza.save();

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-salida`)
            .set('Authorization', `Bearer ${tokenPorteria(conjunto._id)}`);

        expect(res.status).toBe(200);

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('salido');
        expect(v.parqueadero).toBeNull();

        const p = await Parqueadero.findById(plaza._id);
        expect(p.estado).toBe('DISPONIBLE');
        expect(p.visitante).toBeNull();
        expect(p.placaVehiculo).toBeNull();

        const acceso = await HistorialAcceso.findOne({});
        expect(acceso.tipoAcceso).toBe('salida');
    });

    test('visitante ya salido responde 400 y no escribe historial', async () => {
        const visitante = await crearVisitanteConQR({ estado: 'salido' });

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-salida`)
            .set('Authorization', `Bearer ${tokenPorteria(conjunto._id)}`);

        expect(res.status).toBe(400);
        expect(await HistorialAcceso.countDocuments({})).toBe(0);
    });

    test('portero de OTRO conjunto recibe 403', async () => {
        const visitante = await crearVisitanteConQR({ estado: 'ingresado' });

        const res = await request(app)
            .post(`/api/visitantes/${visitante._id}/registrar-salida`)
            .set('Authorization', `Bearer ${tokenPorteria(conjuntoAjeno._id)}`);

        expect(res.status).toBe(403);
    });
});

describe('POST /qr/ingreso/:token (variante legacy)', () => {
    test('marca ingresado, crea historial y es idempotente (unificado vía acceso.service)', async () => {
        const visitante = await crearVisitanteConQR();

        const res = await request(app).post('/api/visitantes/qr/ingreso/tok-valido');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('ingresado');

        // Antes esta ruta no escribía historial ni chequeaba idempotencia.
        expect(await HistorialAcceso.countDocuments({})).toBe(1);

        await request(app).post('/api/visitantes/qr/ingreso/tok-valido');
        expect(await HistorialAcceso.countDocuments({})).toBe(1);
    });
});

describe('POST /qr/salida/:token (público)', () => {
    test('registra salida, libera plaza (reset completo) y crea historial de salida', async () => {
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V2', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO', placaVehiculo: 'ABC123',
        });
        const visitante = await crearVisitanteConQR({ estado: 'ingresado', parqueadero: plaza._id });
        plaza.visitante = visitante._id;
        await plaza.save();

        const res = await request(app).post('/api/visitantes/qr/salida/tok-valido');

        expect(res.status).toBe(200);

        const v = await Visitante.findById(visitante._id);
        expect(v.estado).toBe('salido');
        expect(v.qrToken).toBeNull();

        const p = await Parqueadero.findById(plaza._id);
        expect(p.estado).toBe('DISPONIBLE');
        expect(p.visitante).toBeNull();
        expect(p.placaVehiculo).toBeNull();
        expect(p.horaEntrada).toBeNull();

        // Antes la salida por QR no quedaba en historialaccesos.
        const acceso = await HistorialAcceso.findOne({});
        expect(acceso.tipoAcceso).toBe('salida');
        expect(acceso.metodo).toBe('qr_scan');
    });
});

describe('POST /verificar-acceso (TOTP público)', () => {
    test('código TOTP correcto genera QR de 24h y devuelve token', async () => {
        const visitante = await crearVisitanteConQR({
            qrToken: null, qrExpiracion: null,
            codigoSecreto: 'secreto-totp-test',
        });
        const codigo = visitante.generarCodigoDinamico();

        const res = await request(app)
            .post('/api/visitantes/verificar-acceso')
            .send({ cedula: '111', codigo });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.qr.token).toBeTruthy();

        const v = await Visitante.findById(visitante._id);
        expect(v.qrToken).toBe(res.body.qr.token);
        expect(v.qrExpiracion.getTime()).toBeGreaterThan(Date.now());
    });
});
