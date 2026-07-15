const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Parqueadero = require('./parqueadero.model');
const Conjunto = require('../conjuntos/conjunto.model');
const Visitante = require('../visitantes/visitante.model');
const HistorialAcceso = require('../../shared/models/historialAcceso');
const parqueaderoService = require('./parqueadero.service');

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const crearConjunto = () =>
    Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });

describe('asignarVisitante', () => {
    // Tras el plan 011, asignarVisitante fija estado="RESERVADO" (valor real del
    // enum) en vez del inexistente "EN_ESPERA"; ya no lanza ValidationError.
    test('asigna una plaza VISITANTE disponible y la deja RESERVADO', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V1', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };
        const visitanteId = new mongoose.Types.ObjectId();

        const result = await parqueaderoService.asignarVisitante(visitanteId, 'CARRO', tenantFilter);
        expect(result.estado).toBe('RESERVADO');
        expect(result.visitante.toString()).toBe(visitanteId.toString());

        const recargada = await Parqueadero.findById(plaza._id);
        expect(recargada.estado).toBe('RESERVADO');
    });

    test('lanza "No hay parqueaderos disponibles" cuando no hay plaza libre', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.asignarVisitante(null, 'CARRO', tenantFilter)
        ).rejects.toThrow(/No hay parqueaderos disponibles/);
    });

    // Plan 012: el claim es atómico (findOneAndUpdate con estado:DISPONIBLE en el
    // filtro). Dos requests concurrentes por la única plaza libre → solo una gana.
    test('dos asignarVisitante concurrentes por la misma plaza: solo una tiene éxito', async () => {
        const conjunto = await crearConjunto();
        await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V1', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE',
        });
        const tenantFilter = { conjunto: conjunto._id };
        const a = new mongoose.Types.ObjectId();
        const b = new mongoose.Types.ObjectId();

        const results = await Promise.allSettled([
            parqueaderoService.asignarVisitante(a, 'CARRO', tenantFilter),
            parqueaderoService.asignarVisitante(b, 'CARRO', tenantFilter),
        ]);

        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    });
});

describe('registrarEntrada (cámara/LPR)', () => {
    test('marca OCUPADA la plaza del visitante y crea un HistorialAcceso de entrada', async () => {
        const conjunto = await crearConjunto();
        const visitante = await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'ABC123',
            conjunto: conjunto._id, estado: 'pendiente',
        });
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V5', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'DISPONIBLE', visitante: visitante._id,
        });
        const tenantFilter = { conjunto: conjunto._id };

        const result = await parqueaderoService.registrarEntrada(
            { visitanteId: visitante._id, placa: 'ABC123' }, tenantFilter
        );

        expect(result.numero).toBe('V5');
        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('OCUPADO');

        const h = await HistorialAcceso.findOne({ conjunto: conjunto._id });
        expect(h.tipoAcceso).toBe('entrada');
        expect(h.tipoUsuario).toBe('visitante');
        expect(h.nombreUsuario).toBe('Ana Gómez');
        expect(h.placa).toBe('ABC123');
    });
});

describe('registrarSalida', () => {
    // Tras el plan 010, registrarSalida construye el HistorialAcceso con el shape
    // real del schema (placa/tipoAcceso/tipoUsuario/nombreUsuario) y ya NO lanza.
    test('libera la plaza (DISPONIBLE) y registra un HistorialAcceso de salida', async () => {
        const conjunto = await crearConjunto();
        const plaza = await Parqueadero.create({
            conjunto: conjunto._id, numero: 'V2', categoria: 'VISITANTE',
            tipoVehiculo: 'CARRO', estado: 'OCUPADO', placaVehiculo: 'ABC123',
        });
        const tenantFilter = { conjunto: conjunto._id };

        const resultado = await parqueaderoService.registrarSalida(plaza._id.toString(), tenantFilter);
        expect(resultado.estado).toBe('DISPONIBLE');

        const plazaRecargada = await Parqueadero.findById(plaza._id);
        expect(plazaRecargada.estado).toBe('DISPONIBLE');
        expect(plazaRecargada.visitante).toBeNull();

        const historial = await HistorialAcceso.find({ conjunto: conjunto._id });
        expect(historial).toHaveLength(1);
        expect(historial[0].tipoAcceso).toBe('salida');
        expect(historial[0].placa).toBe('ABC123');
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

describe('registrarAccesoVehicular', () => {
    // Tras el plan 010, el filtro de visitante usa estado ∈ {pendiente, ingresado}
    // (antes 'activo', valor inexistente → nunca hacía match) y el HistorialAcceso
    // se construye con el shape real.
    test('registra el acceso de un visitante en estado pendiente', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };
        await Visitante.create({
            nombre: 'Ana', apellido: 'Gómez', cedula: '111', placaVehiculo: 'XYZ789',
            conjunto: conjunto._id, estado: 'pendiente',
        });

        const data = await parqueaderoService.registrarAccesoVehicular(
            'XYZ789', 'entrada', tenantFilter, conjunto._id, null
        );

        expect(data.rol).toBe('visitante');
        expect(data.persona).toBe('Ana Gómez');

        const h = await HistorialAcceso.findOne({ conjunto: conjunto._id });
        expect(h.tipoAcceso).toBe('entrada');
        expect(h.tipoUsuario).toBe('visitante');
        expect(h.placa).toBe('XYZ789');
    });

    test('lanza error si la placa no es de un residente ni de un visitante vigente', async () => {
        const conjunto = await crearConjunto();
        const tenantFilter = { conjunto: conjunto._id };

        await expect(
            parqueaderoService.registrarAccesoVehicular('NOPE00', 'entrada', tenantFilter, conjunto._id, null)
        ).rejects.toThrow(/no registrado/);
    });
});

describe('contarPlazasPorCategoria', () => {
    test('matriz categoria×tipo×estado consistente con countDocuments', async () => {
        const conjunto = await Conjunto.create({ nombre: 'Test', direccion: 'x', ciudad: 'x', estado: 'activo' });
        const c = conjunto._id;
        await Parqueadero.create([
            { conjunto: c, numero: 'P1', categoria: 'PRIVADO', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' },
            { conjunto: c, numero: 'P2', categoria: 'PRIVADO', tipoVehiculo: 'CARRO', estado: 'OCUPADO' },
            { conjunto: c, numero: 'M1', categoria: 'PRIVADO', tipoVehiculo: 'MOTO', estado: 'DISPONIBLE' },
            { conjunto: c, numero: 'V1', categoria: 'VISITANTE', tipoVehiculo: 'CARRO', estado: 'RESERVADO' },
            { conjunto: c, numero: 'V2', categoria: 'VISITANTE', tipoVehiculo: 'CARRO', estado: 'DISPONIBLE' },
            { conjunto: c, numero: 'VM1', categoria: 'VISITANTE', tipoVehiculo: 'MOTO', estado: 'OCUPADO' },
        ]);

        const m = await parqueaderoService.contarPlazasPorCategoria({ conjunto: c });

        expect(m.total).toBe(6);
        expect(m.libres).toBe(3);
        expect(m.ocupados).toBe(2);
        expect(m.ocupacionPct).toBe(33);
        expect(m.privadoCarro).toEqual({ total: 2, libres: 1 });
        expect(m.privadoMoto).toEqual({ total: 1, libres: 1 });
        expect(m.visitanteCarro).toEqual({ total: 2, libres: 1 });
        expect(m.visitanteMoto).toEqual({ total: 1, libres: 0 });
    });

    test('conjunto sin plazas devuelve todo en cero', async () => {
        const m = await parqueaderoService.contarPlazasPorCategoria({ conjunto: new mongoose.Types.ObjectId() });
        expect(m.total).toBe(0);
        expect(m.ocupacionPct).toBe(0);
    });
});
