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
    FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
})
    .unknown()
    .required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
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
    },
    frontendUrl: envVars.FRONTEND_URL,
};
