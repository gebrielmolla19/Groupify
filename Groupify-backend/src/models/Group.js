const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ members: 1 });

// Ensure creator is in members array
groupSchema.pre('save', function(next) {
  if (this.isNew && !this.members.includes(this.createdBy)) {
    this.members.push(this.createdBy);
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);

