const NotificationService = require('@services/notification.service');
const { sendSuccess } = require('@utils/response');

class NotificationController {
  async list(req, res, next) {
    try {
      const result = await NotificationService.listForUser(req.user._id, {
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 20, 50),
        unreadOnly: req.query.unreadOnly === 'true',
      });
      return sendSuccess(res, {
        message: 'Notifications retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async unreadCount(req, res, next) {
    try {
      const unreadCount = await NotificationService.unreadCount(req.user._id);
      return sendSuccess(res, {
        message: 'Unread count retrieved',
        data: { unreadCount },
      });
    } catch (error) {
      return next(error);
    }
  }

  async markRead(req, res, next) {
    try {
      const notification = await NotificationService.markRead(req.params.id, req.user._id);
      return sendSuccess(res, {
        message: 'Notification marked as read',
        data: { notification },
      });
    } catch (error) {
      return next(error);
    }
  }

  async markAllRead(req, res, next) {
    try {
      const result = await NotificationService.markAllRead(req.user._id);
      return sendSuccess(res, {
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new NotificationController();
