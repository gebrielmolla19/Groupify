const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  invitedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
    index: true
  },
  type: {
    type: String,
    enum: ['manual', 'code'],
    default: 'manual',
    index: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate pending invites for same group+user
inviteSchema.index({ group: 1, invitedUser: 1, status: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

// Index for efficient queries by invited user and status
inviteSchema.index({ invitedUser: 1, status: 1 });

module.exports = mongoose.model('Invite', inviteSchema);

