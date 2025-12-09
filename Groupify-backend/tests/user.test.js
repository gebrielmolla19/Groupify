const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/middleware/authMiddleware');

describe('User Endpoints', () => {
    let user;
    let token;

    beforeEach(async () => {
        user = await User.create({
            spotifyId: 'test-spotify-id',
            displayName: 'Test User',
            email: 'test@example.com',
            spotifyAccessToken: 'access-token',
            spotifyRefreshToken: 'refresh-token',
            tokenExpiresAt: new Date(Date.now() + 3600000),
        });

        token = generateToken(user._id);
    });

    describe('GET /api/v1/auth/me', () => {
        it('should return current user', async () => {
            const res = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user.spotifyId).toBe(user.spotifyId);
            expect(res.body.user.displayName).toBe(user.displayName);
        });

        it('should return 401 if not authenticated', async () => {
            const res = await request(app).get('/api/v1/auth/me');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('PUT /api/v1/users/profile', () => {
        it('should update user profile', async () => {
            const newName = 'Updated Name';
            const res = await request(app)
                .put('/api/v1/users/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({ displayName: newName });

            expect(res.statusCode).toBe(200);
            expect(res.body.user.displayName).toBe(newName);

            const updatedUser = await User.findById(user._id);
            expect(updatedUser.displayName).toBe(newName);
        });

        it('should validate display name length', async () => {
            const res = await request(app)
                .put('/api/v1/users/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({ displayName: 'ab' }); // Too short

            expect(res.statusCode).toBe(400);
        });
    });
});
