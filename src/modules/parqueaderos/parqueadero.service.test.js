const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Parqueadero = require('./parqueadero.model');
const Conjunto = require('../conjuntos/conjunto.model');
const parqueaderoService = require('./parqueadero.service');

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const crearConjunto = () =>
    Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });

describe('asignarVisitante', () => {
    // CARACTERIZACIÓN: a fecha de hoy asignarVisitante fija estado="EN_ESPERA",
    // valor que NO existe en el enum del schema Parqueadero
    // (["DISPONIBLE","OCUPADO","RESERVADO"]), por lo que plaza.save() lanza
    // ValidationError. BUG documentado — lo arregla el plan 011.
    test('lanza ValidationError porque EN_ESPERA no está en el enum (BUG, plan 011)', async () => {
        const conjunto = await crearConjunto();
        await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V1', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.asignarVisitante(null, 'CARRO', tenantFilter)
        ).rejects.toThrow();
    });

    test('lanza "No hay parqueaderos disponibles" cuando no hay plaza libre', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.asignarVisitante(null, 'CARRO', tenantFilter)
        ).rejects.toThrow(/No hay parqueaderos disponibles/);
    });
});

describe('registrarSalida', () => {
    // CARACTERIZACIÓN: registrarSalida flipea la plaza a DISPONIBLE y la guarda,
    // pero luego construye un HistorialAcceso con campos que no matchean el schema
    // (tipo:'SALIDA' en vez de tipoAcceso enum, sin placa/tipoUsuario/nombreUsuario
    // requeridos) → HistorialAcceso.save() lanza ValidationError DESPUÉS de haber
    // persistido el cambio de la plaza. BUG documentado — lo arregla el plan 010.
    test('lanza ValidationError al guardar el historial, pero la plaza ya quedó DISPONIBLE (BUG, plan 010)', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V2', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO',
        });
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.registrarSalida(plaza._id.toString(), tenantFilter)
        ).rejects.toThrow();

        // Efecto colateral de escritura parcial que causa el bug hoy:
        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('DISPONIBLE');
    });

    test('lanza "La plaza ya está libre" si la plaza estaba DISPONIBLE', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V3', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.registrarSalida(plaza._id.toString(), tenantFilter)
        ).rejects.toThrow(/ya está libre/);
    });
});
