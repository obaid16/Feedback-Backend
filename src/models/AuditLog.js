import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorEmail: {
      type: String,
      trim: true
    },
    actorRole: {
      type: String,
      trim: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: true,
      index: true
    },
    resourceId: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success'
    },
    requestId: {
      type: String,
      index: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Expire audit logs after 365 days or retention policy
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
