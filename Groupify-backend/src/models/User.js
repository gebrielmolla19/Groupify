const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  spotifyId: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  // Spotify tokens. Set at every Spotify sign-in; cleared when Spotify
  // rejects the refresh token (expired or revoked), until the user signs in
  // again. See TokenManager.clearSpotifyTokens.
  spotifyAccessToken: {
    type: String
  },
  spotifyRefreshToken: {
    type: String
  },
  tokenExpiresAt: {
    type: Date
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  currentDeviceId: {
    type: String,
    default: null
  },
  // Multi-app workaround: which Spotify app (0, 1, 2...) this user belongs to.
  // Each app has its own 5-user allowlist in development mode.
  spotifyAppIndex: {
    type: Number,
    default: 0
  },
  notificationPreferences: {
    song_shared: { type: Boolean, default: true },
    group_invite: { type: Boolean, default: true },
    member_joined: { type: Boolean, default: true },
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);

