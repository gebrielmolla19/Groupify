const Joi = require('joi');

const envSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(5001),
    MONGO_URI: Joi.string().required().description('MongoDB connection string'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    SPOTIFY_CLIENT_ID: Joi.string().required().description('Spotify Client ID'),
    SPOTIFY_CLIENT_SECRET: Joi.string().required().description('Spotify Client Secret'),
    SPOTIFY_REDIRECT_URI: Joi.string().uri().required().description('Spotify Redirect URI'),
    // Optional: Additional Spotify apps for multi-app workaround (5 users per app in dev mode)
    // SPOTIFY_CLIENT_ID_1, SPOTIFY_CLIENT_SECRET_1, SPOTIFY_CLIENT_ID_2, SPOTIFY_CLIENT_SECRET_2, etc.
    FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
})
    .unknown()
    .required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

/**
 * Build list of Spotify app configs from env vars.
 * App 0: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 * App 1: SPOTIFY_CLIENT_ID_1, SPOTIFY_CLIENT_SECRET_1
 * App 2: SPOTIFY_CLIENT_ID_2, SPOTIFY_CLIENT_SECRET_2
 * etc.
 */
function getSpotifyApps() {
    const apps = [];
    // App 0 (primary)
    if (envVars.SPOTIFY_CLIENT_ID && envVars.SPOTIFY_CLIENT_SECRET) {
        apps.push({
            clientId: envVars.SPOTIFY_CLIENT_ID,
            clientSecret: envVars.SPOTIFY_CLIENT_SECRET,
        });
    }
    // Additional apps (1, 2, 3, ...)
    for (let i = 1; i <= 5; i++) {
        const clientId = process.env[`SPOTIFY_CLIENT_ID_${i}`];
        const clientSecret = process.env[`SPOTIFY_CLIENT_SECRET_${i}`];
        if (clientId && clientSecret) {
            apps.push({ clientId, clientSecret });
        }
    }
    return apps;
}

const spotifyApps = getSpotifyApps();

/**
 * Get Spotify credentials for a given app index.
 * @param {number} appIndex - 0-based app index (0 = primary, 1 = first extra, etc.)
 * @returns {{ clientId: string, clientSecret: string } | null}
 */
function getSpotifyConfig(appIndex = 0) {
    if (appIndex >= 0 && appIndex < spotifyApps.length) {
        return spotifyApps[appIndex];
    }
    return spotifyApps[0] || null;
}

module.exports = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongo: {
        uri: envVars.MONGO_URI,
    },
    jwt: {
        secret: envVars.JWT_SECRET,
    },
    spotify: {
        clientId: envVars.SPOTIFY_CLIENT_ID,
        clientSecret: envVars.SPOTIFY_CLIENT_SECRET,
        redirectUri: envVars.SPOTIFY_REDIRECT_URI,
        apps: spotifyApps,
        getConfig: getSpotifyConfig,
    },
    frontendUrl: envVars.FRONTEND_URL,
};
