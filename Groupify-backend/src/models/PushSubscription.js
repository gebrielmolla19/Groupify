const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The browser's PushSubscription serialized to JSON (endpoint + keys)
    subscription: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
