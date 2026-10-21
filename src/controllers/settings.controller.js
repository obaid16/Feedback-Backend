import { env, allowedEmailDomainsList } from '../config/env.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export async function getInstitutionalSettings(req, res) {
  return sendSuccess(res, {
    appName: env.APP_NAME,
    environment: env.NODE_ENV,
    defaultTimezone: env.DEFAULT_TIMEZONE,
    minReportResponses: env.MIN_REPORT_RESPONSES,
    allowedEmailDomains: allowedEmailDomainsList,
    passwordAuthEnabled: env.ENABLE_PASSWORD_AUTH,
    reminderDefaults: {
      firstReminderHours: env.REMINDER_SCHEDULE_HOURS_1,
      secondReminderHours: env.REMINDER_SCHEDULE_HOURS_2,
      escalationHours: env.ESCALATION_SCHEDULE_HOURS
    }
  });
}

export async function getSystemAuditLogs(req, res, next) {
  try {
    const { action, resourceType, page = 1, limit = 25 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query)
    ]);

    return sendPaginated(res, items, { page: Number(page), limit: Number(limit), total });
  } catch (err) {
    next(err);
  }
}
