const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  spotifyTrackId: {
    type: String,
    required: true
  },
  trackName: {
    type: String,
    required: true
  },
  artistName: {
    type: String,
    required: true
  },
  albumName: {
    type: String,
    default: ''
  },
  trackImage: {
    type: String,
    default: null
  },
  trackPreviewUrl: {
    type: String,
    default: null
  },
  trackExternalUrl: {
    type: String,
    default: null
  },
  genres: [{
    type: String
  }],
  durationMs: {
    type: Number,
    default: 0
  },
  listeners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    listenedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    timeToListen: {
      // Time in milliseconds from share to listen
      type: Number,
      default: null
    }
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    likedAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  }],
  likeCount: {
    type: Number,
    default: 0
  },
  listenCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
shareSchema.index({ group: 1, createdAt: -1 });
shareSchema.index({ sharedBy: 1 });
shareSchema.index({ spotifyTrackId: 1 });

module.exports = mongoose.model('Share', shareSchema);

