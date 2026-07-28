const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const NotificationRepository = require('@repositories/notification.repository');
const UserRepository = require('@repositories/user.repository');
const { sendMail } = require('@services/email.service');
const config = require('@config');

class NotificationService {
  async listForUser(userId, options) {
    return NotificationRepository.findForUser(userId, options);
  }

  async markRead(id, userId) {
    const notification = await NotificationRepository.markRead(id, userId);
    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }
    return notification;
  }

  async markAllRead(userId) {
    return NotificationRepository.markAllRead(userId);
  }

  async unreadCount(userId) {
    return NotificationRepository.countUnread(userId);
  }

  /**
   * Create an in-app notification for a single user.
   */
  async notifyUser({
    userId,
    type,
    title,
    message,
    link = '',
    meta = null,
  }) {
    if (!userId) return null;
    return NotificationRepository.create({
      user: userId,
      type,
      title,
      message,
      link,
      meta,
    });
  }

  /**
   * Create in-app notifications for every active super admin.
   * Optionally also emails them (best-effort).
   */
  async notifySuperAdmins({
    type,
    title,
    message,
    link = '',
    meta = null,
    emailSubject = '',
    emailHtml = '',
    emailText = '',
  }) {
    const admins = await UserRepository.findIdsByRoleSlug(ROLES.SUPER_ADMIN);
    if (!admins.length) return { created: 0 };

    const docs = admins.map((admin) => ({
      user: admin._id,
      type,
      title,
      message,
      link,
      meta,
    }));

    await NotificationRepository.createMany(docs);

    if (emailSubject && (emailHtml || emailText)) {
      await Promise.allSettled(
        admins
          .filter((admin) => admin.email)
          .map((admin) =>
            sendMail({
              to: admin.email,
              subject: emailSubject,
              html: emailHtml,
              text: emailText,
            })
          )
      );
    }

    return { created: docs.length };
  }

  buildPendingPath() {
    return `${config.frontendUrl}/super-admin/affiliates/pending`;
  }
}

module.exports = new NotificationService();
