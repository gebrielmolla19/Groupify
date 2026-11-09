// Regression test for #24: test-mode placeholders must reach process.env,
// not only the copy validated by Joi, because code reads
// process.env.JWT_SECRET directly at runtime.

const REQUIRED_KEYS = [
    'MONGO_URI',
    'JWT_SECRET',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REDIRECT_URI',
];

describe('config/env in test mode', () => {
    let savedEnv;

    beforeEach(() => {
        savedEnv = { ...process.env };
    });

    // Restore keys in place so process.env stays Node's real env object.
    afterEach(() => {
        for (const key of Object.keys(process.env)) {
            if (!(key in savedEnv)) {
                delete process.env[key];
            }
        }
        Object.assign(process.env, savedEnv);
    });

    function loadEnvConfig() {
        let config;
        jest.isolateModules(() => {
            config = require('../src/config/env');
        });
        return config;
    }

    it('writes placeholders into process.env when required vars are unset', () => {
        process.env.NODE_ENV = 'test';
        for (const key of REQUIRED_KEYS) {
            delete process.env[key];
        }

        const config = loadEnvConfig();

        for (const key of REQUIRED_KEYS) {
            expect(process.env[key]).toEqual(expect.any(String));
            expect(process.env[key]).not.toBe('');
        }
        expect(config.jwt.secret).toBe(process.env.JWT_SECRET);
    });

    it('keeps values that are already set', () => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'real-secret-from-env';

        const config = loadEnvConfig();

        expect(process.env.JWT_SECRET).toBe('real-secret-from-env');
        expect(config.jwt.secret).toBe('real-secret-from-env');
    });

    it('does not fill placeholders outside test mode', () => {
        process.env.NODE_ENV = 'development';
        for (const key of REQUIRED_KEYS) {
            delete process.env[key];
        }

        expect(loadEnvConfig).toThrow(/Config validation error: .* is required/);
        for (const key of REQUIRED_KEYS) {
            expect(process.env[key]).toBeUndefined();
        }
    });
});
