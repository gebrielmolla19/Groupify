const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  notificationIdSchema,
  subscribeSchema,
  unsubscribeSchema,
  validate,
} = require('../validators/notificationValidator');

// Public — frontend needs this to subscribe before auth cookie is ready
router.get('/vapid-key', NotificationController.getVapidKey);

// Authenticated routes
router.get('/', authMiddleware, NotificationController.getNotifications);
router.put('/read-all', authMiddleware, NotificationController.markAllRead);
router.put(
  '/:id/read',
  authMiddleware,
  validate(notificationIdSchema, 'params'),
  NotificationController.markOneRead
);
router.post(
  '/subscribe',
  authMiddleware,
  validate(subscribeSchema, 'body'),
  NotificationController.subscribe
);
router.delete(
  '/subscribe',
  authMiddleware,
  validate(unsubscribeSchema, 'body'),
  NotificationController.unsubscribe
);

module.exports = router;
