const { getTenantFilter, isSuperAdmin, getConjuntoId } = require('./auth.middleware');

describe('auth.middleware tenant helpers', () => {
    test('getTenantFilter returns {} for superadmin', () => {
        const req = { usuario: { rol: 'superadmin' } };
        expect(getTenantFilter(req)).toEqual({});
    });

    test('getTenantFilter scopes non-superadmin by conjuntoId', () => {
        const req = { usuario: { rol: 'admin', conjuntoId: 'abc123' } };
        expect(getTenantFilter(req)).toEqual({ conjunto: 'abc123' });
    });

    test('getTenantFilter falls back to conjunto:null when a tenant user has no conjuntoId', () => {
        const req = { usuario: { rol: 'residente' } };
        expect(getTenantFilter(req)).toEqual({ conjunto: null });
    });

    test('isSuperAdmin true only for rol superadmin', () => {
        expect(isSuperAdmin({ usuario: { rol: 'superadmin' } })).toBe(true);
        expect(isSuperAdmin({ usuario: { rol: 'admin' } })).toBe(false);
        expect(isSuperAdmin({})).toBe(false);
    });

    test('getConjuntoId returns null for superadmin or missing usuario', () => {
        expect(getConjuntoId({ usuario: { rol: 'superadmin' } })).toBeNull();
        expect(getConjuntoId({})).toBeNull();
    });

    test('getConjuntoId returns the conjuntoId for a tenant user', () => {
        expect(getConjuntoId({ usuario: { rol: 'residente', conjuntoId: 'xyz789' } })).toBe('xyz789');
    });
});
