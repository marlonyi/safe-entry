const { connect, closeDatabase, clearDatabase } = require('../../shared/testing/setupTestDb');
const Usuario = require('./usuario.model');
const Conjunto = require('../conjuntos/conjunto.model');
const usuarioService = require('./usuario.service');

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const crearUsuario = (conjuntoId, rol = 'residente') =>
    Usuario.create({
        conjunto: conjuntoId, nombre: 'Ana', apellido: 'Gómez', cedula: '12345',
        password: 'hash', rol,
    });

describe('usuarioService.cambiarRol', () => {
    test('cambia el rol de un usuario y devuelve el rol anterior', async () => {
        const conjunto = await Conjunto.create({ nombre: 'T', estado: 'activo' });
        const usuario = await crearUsuario(conjunto._id, 'residente');

        const { usuario: actualizado, rolAnterior } = await usuarioService.cambiarRol(usuario._id.toString(), 'admin');

        expect(rolAnterior).toBe('residente');
        expect(actualizado.rol).toBe('admin');
    });

    test('rechaza un rol no válido (status 400)', async () => {
        await expect(usuarioService.cambiarRol('507f1f77bcf86cd799439011', 'jefe'))
            .rejects.toMatchObject({ status: 400 });
    });

    test('no permite cambiar el rol de un superadmin (status 403)', async () => {
        const conjunto = await Conjunto.create({ nombre: 'T', estado: 'activo' });
        const sa = await crearUsuario(conjunto._id, 'superadmin');
        await expect(usuarioService.cambiarRol(sa._id.toString(), 'admin'))
            .rejects.toMatchObject({ status: 403 });
    });

    test('usuario inexistente (status 404)', async () => {
        await expect(usuarioService.cambiarRol('507f1f77bcf86cd799439011', 'admin'))
            .rejects.toMatchObject({ status: 404 });
    });
});

describe('usuarioService.moverAConjunto', () => {
    test('mueve el usuario al nuevo conjunto', async () => {
        const c1 = await Conjunto.create({ nombre: 'C1', estado: 'activo' });
        const c2 = await Conjunto.create({ nombre: 'C2', estado: 'activo' });
        const usuario = await crearUsuario(c1._id, 'residente');

        const { usuario: actualizado, conjunto } = await usuarioService.moverAConjunto(usuario._id.toString(), c2._id.toString());

        expect(actualizado.conjunto.toString()).toBe(c2._id.toString());
        expect(conjunto.nombre).toBe('C2');
    });

    test('conjuntoId vacío lanza error 400 con detalle', async () => {
        await expect(usuarioService.moverAConjunto('507f1f77bcf86cd799439011', ''))
            .rejects.toMatchObject({ status: 400, detalle: expect.any(String) });
    });

    test('conjunto inexistente (status 404)', async () => {
        const usuario = await crearUsuario((await Conjunto.create({ nombre: 'C', estado: 'activo' }))._id);
        await expect(usuarioService.moverAConjunto(usuario._id.toString(), '507f1f77bcf86cd799439011'))
            .rejects.toMatchObject({ status: 404 });
    });
});
