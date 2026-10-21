import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export async function logAuditEvent({
  actor = null,
  actorEmail = null,
  actorRole = null,
  action,
  resourceType,
  resourceId = null,
  status = 'success',
  requestId = null,
  ipAddress = null,
  userAgent = null,
  metadata = {}
}) {
  try {
    // Sanitize metadata to exclude any sensitive tokens or passwords
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.passwordHash;
    delete safeMetadata.token;
    delete safeMetadata.refreshToken;
    delete safeMetadata.answers; // Do not log feedback answers

    await AuditLog.create({
      actor: actor?._id || actor || null,
      actorEmail: actorEmail || actor?.email || null,
      actorRole: actorRole || actor?.role || null,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      status,
      requestId,
      ipAddress,
      userAgent,
      metadata: safeMetadata
    });
  } catch (err) {
    // Never crash the primary request because of an audit log write failure
    logger.error({ err, action, resourceType }, 'Failed to record audit log event');
  }
}
