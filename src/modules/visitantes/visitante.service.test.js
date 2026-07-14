const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Visitante = require('./visitante.model');
const Parqueadero = require('../parqueaderos/parqueadero.model');
const Conjunto = require('../conjuntos/conjunto.model');
const visitanteService = require('./visitante.service');

beforeAll(async () => {
    await connect();
    // Los índices únicos (conjunto+cedula, conjunto+placaVehiculo) deben estar
    // construidos para que la colisión E11000 se dispare de forma determinista.
    await Visitante.init();
});
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const crearConjunto = () =>
    Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });

describe('registrarVisitante', () => {
    test('crea el visitante y le asigna una plaza VISITANTE disponible (queda OCUPADO)', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V1', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };

        const { visitante, plaza: plazaAsignada } = await visitanteService.registrarVisitante(
            { nombreVisitante: 'Ana', apellidoVisitante: 'Gómez', cedulaVisitante: '111', placaVisitante: 'ABC123', tipoVehiculo: 'CARRO' },
            conjunto._id, tenantFilter
        );

        expect(visitante.nombre).toBe('Ana');
        expect(plazaAsignada._id.toString()).toBe(plaza._id.toString());
        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('OCUPADO');
        expect(plazaRecargada.visitante.toString()).toBe(visitante._id.toString());
    });

    // Plan 013: con placa 'N/A'/vacía se guarda placaVehiculo=null y el índice único
    // es parcial (solo strings), por lo que varios visitantes sin vehículo conviven.
    test('dos visitantes sin vehículo (placa N/A) se registran OK y quedan con placaVehiculo null', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };

        const r1 = await visitanteService.registrarVisitante(
            { nombreVisitante: 'A', apellidoVisitante: 'A', cedulaVisitante: '1', placaVisitante: 'N/A' },
            conjunto._id, tenantFilter
        );
        const r2 = await visitanteService.registrarVisitante(
            { nombreVisitante: 'B', apellidoVisitante: 'B', cedulaVisitante: '2', placaVisitante: '' },
            conjunto._id, tenantFilter
        );

        expect(r1.visitante.placaVehiculo).toBeNull();
        expect(r2.visitante.placaVehiculo).toBeNull();
    });

    test('dos visitantes con la MISMA placa real en el conjunto sí colisionan (E11000)', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };

        await visitanteService.registrarVisitante(
            { nombreVisitante: 'A', apellidoVisitante: 'A', cedulaVisitante: '1', placaVisitante: 'ABC123' },
            conjunto._id, tenantFilter
        );

        await expect(
            visitanteService.registrarVisitante(
                { nombreVisitante: 'B', apellidoVisitante: 'B', cedulaVisitante: '2', placaVisitante: 'ABC123' },
                conjunto._id, tenantFilter
            )
        ).rejects.toThrow(/E11000|duplicate key/);
    });

    test('rechaza cuando faltan campos obligatorios', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };
        await expect(
            visitanteService.registrarVisitante(
                { nombreVisitante: 'Solo nombre' }, conjunto._id, tenantFilter
            )
        ).rejects.toThrow(/obligatorios/);
    });
});

describe('eliminarVisitante', () => {
    test('elimina el visitante y libera su plaza (vuelve a DISPONIBLE)', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V2', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };

        const { visitante } = await visitanteService.registrarVisitante(
            { nombreVisitante: 'Ana', apellidoVisitante: 'Gómez', cedulaVisitante: '111', placaVisitante: 'ABC123', tipoVehiculo: 'CARRO' },
            conjunto._id, tenantFilter
        );

        await visitanteService.eliminarVisitante(visitante._id.toString(), tenantFilter);

        expect(await Visitante.findById(visitante._id)).toBeNull();
        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('DISPONIBLE');
        expect(plazaRecargada.visitante).toBeNull();
    });
});
