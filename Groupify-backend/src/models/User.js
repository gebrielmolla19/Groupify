const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  spotifyId: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  spotifyAccessToken: {
    type: String,
    required: true
  },
  spotifyRefreshToken: {
    type: String,
    required: true
  },
  tokenExpiresAt: {
    type: Date,
    required: true
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
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSchema.index({ spotifyId: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);

