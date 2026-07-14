module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/frontend/'],
    testTimeout: 30000, // el primer arranque/descarga de mongodb-memory-server puede ser lento
    // La app arranca timers de módulo (setInterval en shared/config/cache.js y
    // shared/middlewares/rateLimit.middleware.js) al cargar el barrel src/index.js.
    // Esos handles mantienen vivo el event loop y cuelgan Jest al terminar; como
    // este plan es test-only (no se toca src/), forzamos la salida tras los tests.
    forceExit: true,
};
