const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'frontend/**',
            'ia_models/**',
            'ml_services/**',
            'logs/**',
            'coverage/**',
            'public/**', // assets de navegador (service worker, etc.)
            '**/.venv/**', // virtualenvs de Python con JS vendorizado
            'Reconocimiento/**', // servicio Python (LPR)
            'qr-scanner/**', // servicio Python (QR)
        ],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            // Este backend usa console.log ampliamente para logging; no lo marcamos.
            'no-console': 'off',
        },
    },
    {
        // Archivos de test: globals de Jest
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
];
