const request = require('supertest');
const app = require('../src/app');

// Mock SpotifyService to avoid external API calls
jest.mock('../src/services/spotifyService', () => ({
    exchangeCodeForToken: jest.fn(),
    getUserProfile: jest.fn(),
}));

describe('Auth Endpoints', () => {
    describe('GET /api/v1/auth/login', () => {
        it('should redirect to Spotify authorization', async () => {
            const res = await request(app).get('/api/v1/auth/login');
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toContain('https://accounts.spotify.com/authorize');
        });

        it('should support app query param for multi-app workaround', async () => {
            const res = await request(app).get('/api/v1/auth/login?app=1');
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toContain('https://accounts.spotify.com/authorize');
            expect(res.header.location).toContain('state=app%3A1');
        });
    });
});
