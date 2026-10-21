export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  CLOSED: 'closed',
  ARCHIVED: 'archived'
});

export const ALL_CAMPAIGN_STATUSES = Object.freeze(Object.values(CAMPAIGN_STATUS));

export const ANONYMITY_MODE = Object.freeze({
  ANONYMOUS: 'anonymous',       // Full technical anonymity: zero student IDs in submission, separated tracking
  CONFIDENTIAL: 'confidential', // Identity restricted to authorized institutional disclosure
  IDENTIFIED: 'identified'       // Identified feedback with student disclosure
});

export const ALL_ANONYMITY_MODES = Object.freeze(Object.values(ANONYMITY_MODE));

export const RECIPIENT_STATUS = Object.freeze({
  ELIGIBLE: 'eligible',
  INVITED: 'invited',
  REMINDER_1_SENT: 'reminder_1_sent',
  REMINDER_2_SENT: 'reminder_2_sent',
  SUBMITTED: 'submitted',
  ESCALATED_ADMIN: 'escalated_admin',
  FAILED: 'failed'
});

export const ALL_RECIPIENT_STATUSES = Object.freeze(Object.values(RECIPIENT_STATUS));

export const FORM_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
});
