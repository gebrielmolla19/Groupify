const js = require('@eslint/js');
const nodePlugin = require('eslint-plugin-n');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
        plugins: {
            n: nodePlugin,
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'n/no-unsupported-features/es-syntax': 'off',
            'n/no-missing-require': 'error',
        },
    },
    prettier,
];
