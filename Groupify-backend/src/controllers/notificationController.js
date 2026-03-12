const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const notifications = await notificationService.getUserNotifications(req.userId);
      res.json({ success: true, notifications });
    } catch (error) {
      next(error);
    }
  }

  static async markOneRead(req, res, next) {
    try {
      const { id } = req.params;
      await notificationService.markAsRead(id, req.userId);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      await notificationService.markAllAsRead(req.userId);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  static async subscribe(req, res, next) {
    try {
      const { subscription } = req.body;
      await notificationService.saveSubscription(req.userId, subscription);
      logger.info('[Notifications] Push subscription saved', { userId: req.userId });
      res.status(201).json({ success: true, message: 'Subscribed to push notifications' });
    } catch (error) {
      next(error);
    }
  }

  static async unsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;
      await notificationService.deleteSubscription(req.userId, endpoint);
      res.json({ success: true, message: 'Unsubscribed from push notifications' });
    } catch (error) {
      next(error);
    }
  }

  static getVapidKey(req, res) {
    res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
  }
}

module.exports = NotificationController;
