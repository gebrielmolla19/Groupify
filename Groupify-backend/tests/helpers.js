const User = require('../src/models/User');
const Group = require('../src/models/Group');
const { generateToken } = require('../src/middleware/authMiddleware');

/**
 * Create a test user and return the user document
 */
async function createUser(overrides = {}) {
  return User.create({
    spotifyId: overrides.spotifyId || `test-spotify-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    displayName: overrides.displayName || 'Test User',
    email: overrides.email || 'test@example.com',
    spotifyAccessToken: overrides.spotifyAccessToken || 'access-token',
    spotifyRefreshToken: overrides.spotifyRefreshToken || 'refresh-token',
    tokenExpiresAt: overrides.tokenExpiresAt || new Date(Date.now() + 3600000),
    ...overrides
  });
}

/**
 * Create a test user and return { user, token }
 */
async function createUserAndToken(overrides = {}) {
  const user = await createUser(overrides);
  const token = generateToken(user._id);
  return { user, token };
}

/**
 * Create a test group owned by the given user; returns the group document (with inviteCode)
 */
async function createGroup(createdByUserId, overrides = {}) {
  const group = await Group.create({
    name: overrides.name || 'Test Group',
    description: overrides.description != null ? overrides.description : 'Test description',
    createdBy: createdByUserId,
    inviteCode: overrides.inviteCode || require('crypto').randomBytes(8).toString('hex').toUpperCase(),
    members: [createdByUserId],
    ...overrides
  });
  return group;
}

module.exports = {
  createUser,
  createUserAndToken,
  createGroup
};
