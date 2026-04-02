const webPush = require('web-push');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const Group = require('../models/Group');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Build the push notification title and body based on type and metadata.
 */
function buildPushPayload(type, metadata, actorDisplayName) {
  if (type === 'song_shared') {
    return {
      title: 'New song shared',
      body: `${actorDisplayName} shared "${metadata.trackName}" in ${metadata.groupName}`,
      url: '/',
    };
  }
  if (type === 'member_joined') {
    return {
      title: 'New member joined',
      body: `${metadata.memberName} joined ${metadata.groupName}`,
      url: '/',
    };
  }
  if (type === 'group_invite') {
    return {
      title: 'Group invitation',
      body: `${actorDisplayName} invited you to join ${metadata.groupName}`,
      url: '/',
    };
  }
  return { title: 'Groupify', body: '', url: '/' };
}

/**
 * Fan-out notifications to all group members except the actor.
 * Emits a socket event to each recipient's personal room and sends a web push.
 *
 * @param {import('socket.io').Server} io
 * @param {string} type - 'song_shared' | 'member_joined'
 * @param {string} actorId - The user who triggered the event
 * @param {string} groupId
 * @param {object} metadata - { trackName, artistName, memberName, groupName }
 */
async function createNotificationsForGroup(io, type, actorId, groupId, metadata) {
  try {
    const group = await Group.findById(groupId).select('members').lean();
    if (!group) return;

    const recipients = group.members.filter(
      (memberId) => memberId.toString() !== actorId.toString()
    );
    if (recipients.length === 0) return;

    // Load preferences to control push notifications (in-app notifications always created)
    const users = await User.find({ _id: { $in: recipients } })
      .select('notificationPreferences')
      .lean();

    const prefsMap = new Map(users.map((u) => [u._id.toString(), u.notificationPreferences]));

    const docs = recipients.map((recipientId) => ({
      recipient: recipientId,
      type,
      group: groupId,
      actor: actorId,
      metadata,
    }));

    const created = await Notification.insertMany(docs);

    // Populate all created notifications in a single query
    const populated = await Notification.find({
      _id: { $in: created.map((n) => n._id) },
    })
      .populate('actor', 'displayName profileImage')
      .populate('group', 'name')
      .lean();

    const actorDisplayName =
      populated[0]?.actor?.displayName || metadata.memberName || 'Someone';
    const pushPayload = buildPushPayload(type, metadata, actorDisplayName);

    for (const notification of populated) {
      const recipientId = notification.recipient.toString();

      // Emit to personal socket room
      io.to(recipientId).emit('notification', notification);

      // Send web push only if user has this notification type enabled
      const prefs = prefsMap.get(recipientId);
      const pushEnabled = !prefs || prefs[type] !== false;
      if (pushEnabled) {
        const subs = await PushSubscription.find({ user: notification.recipient }).lean();
        for (const sub of subs) {
          try {
            await webPush.sendNotification(sub.subscription, JSON.stringify(pushPayload));
          } catch (err) {
            // 410 Gone = subscription is expired; clean it up
            if (err.statusCode === 410 || err.statusCode === 404) {
              await PushSubscription.deleteOne({ _id: sub._id });
              logger.debug('[Notifications] Removed expired push subscription', { subId: sub._id });
            } else {
              logger.warn('[Notifications] Push send failed', { error: err.message });
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Notifications] Failed to create notifications', { error: error.message });
  }
}

/**
 * Get the latest 30 notifications for a user.
 */
async function getUserNotifications(userId) {
  return Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('actor', 'displayName profileImage')
    .populate('group', 'name')
    .lean();
}

/**
 * Mark a single notification as read (validates ownership).
 */
async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId, read: false },
    { read: true, readAt: new Date() },
    { new: true }
  );
  return notification;
}

/**
 * Mark all unread notifications as read for a user.
 */
async function markAllAsRead(userId) {
  await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() }
  );
}

/**
 * Save (upsert) a push subscription for a user.
 * One subscription per endpoint — replaces if the endpoint already exists.
 */
async function saveSubscription(userId, subscription) {
  await PushSubscription.findOneAndUpdate(
    { user: userId, 'subscription.endpoint': subscription.endpoint },
    { user: userId, subscription },
    { upsert: true, new: true }
  );
}

/**
 * Remove a push subscription by endpoint.
 */
async function deleteSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ user: userId, 'subscription.endpoint': endpoint });
}

/**
 * Send a notification to a single user (e.g. a group invite).
 */
async function createNotificationForUser(io, type, actorId, recipientId, groupId, metadata) {
  try {
    const [notification] = await Notification.insertMany([{
      recipient: recipientId,
      type,
      group: groupId,
      actor: actorId,
      metadata,
    }]);

    const populated = await Notification.findById(notification._id)
      .populate('actor', 'displayName profileImage')
      .populate('group', 'name')
      .lean();

    const actorDisplayName = populated?.actor?.displayName || 'Someone';
    const pushPayload = buildPushPayload(type, metadata, actorDisplayName);

    // Socket to personal room (always sent)
    io.to(recipientId.toString()).emit('notification', populated);

    // Web push — only if user has this notification type enabled
    const recipient = await User.findById(recipientId).select('notificationPreferences').lean();
    const pushEnabled = !recipient?.notificationPreferences || recipient.notificationPreferences[type] !== false;
    if (pushEnabled) {
      const subs = await PushSubscription.find({ user: recipientId }).lean();
      for (const sub of subs) {
        try {
          await webPush.sendNotification(sub.subscription, JSON.stringify(pushPayload));
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Notifications] Failed to create user notification', { error: error.message });
  }
}

module.exports = {
  createNotificationsForGroup,
  createNotificationForUser,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  saveSubscription,
  deleteSubscription,
};
