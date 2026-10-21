import { Notification } from '../models/Notification.js';

export async function createNotification({
  recipient,
  title,
  message,
  type,
  relatedCampaign = null,
  metadata = {}
}) {
  return Notification.create({
    recipient,
    title,
    message,
    type,
    relatedCampaign,
    metadata
  });
}

export async function getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
  const query = { recipient: userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const skip = (page - 1) * limit;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false })
  ]);

  return { items, total, unreadCount, page, limit };
}

export async function markNotificationAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
}

export async function markAllNotificationsAsRead(userId) {
  return Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
}
