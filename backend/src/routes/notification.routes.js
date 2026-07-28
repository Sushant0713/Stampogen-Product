const express = require('express');
const NotificationController = require('@controllers/notification.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const validate = require('@middlewares/validate.middleware');
const { param } = require('express-validator');

const router = express.Router();

router.use(authenticate);

router.get('/', NotificationController.list);
router.get('/unread-count', NotificationController.unreadCount);
router.patch('/read-all', NotificationController.markAllRead);
router.patch(
  '/:id/read',
  [param('id').isMongoId().withMessage('Invalid notification ID')],
  validate,
  NotificationController.markRead
);

module.exports = router;
