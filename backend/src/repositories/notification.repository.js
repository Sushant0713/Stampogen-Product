const { Notification } = require('@models');

class NotificationRepository {
  async create(data) {
    return Notification.create(data);
  }

  async createMany(docs) {
    if (!docs?.length) return [];
    return Notification.insertMany(docs);
  }

  async findForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const filter = { user: userId };
    if (unreadOnly) filter.readAt = null;

    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: userId, readAt: null }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async markRead(id, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { readAt: new Date() },
      { new: true }
    );
  }

  async markAllRead(userId) {
    const result = await Notification.updateMany(
      { user: userId, readAt: null },
      { readAt: new Date() }
    );
    return { modified: result.modifiedCount || 0 };
  }

  async countUnread(userId) {
    return Notification.countDocuments({ user: userId, readAt: null });
  }
}

module.exports = new NotificationRepository();
