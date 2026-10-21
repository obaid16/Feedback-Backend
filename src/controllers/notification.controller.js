import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/notification.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const result = await getUserNotifications(req.user._id, {
      page: Number(page),
      limit: Number(limit),
      unreadOnly: unreadOnly === 'true'
    });

    return sendPaginated(
      res,
      result.items,
      { page: result.page, limit: result.limit, total: result.total },
      'Notifications retrieved'
    );
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const notification = await markNotificationAsRead(req.params.id, req.user._id);
    return sendSuccess(res, { notification }, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await markAllNotificationsAsRead(req.user._id);
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}
