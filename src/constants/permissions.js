import { ROLES } from './roles.js';

/**
 * Granular permissions for the system
 */
export const PERMISSIONS = Object.freeze({
  // Forms
  FORMS_CREATE: 'forms:create',
  FORMS_READ: 'forms:read',
  FORMS_UPDATE: 'forms:update',
  FORMS_PUBLISH: 'forms:publish',
  FORMS_ARCHIVE: 'forms:archive',

  // Campaigns
  CAMPAIGNS_CREATE: 'campaigns:create',
  CAMPAIGNS_READ: 'campaigns:read',
  CAMPAIGNS_UPDATE: 'campaigns:update',
  CAMPAIGNS_PUBLISH: 'campaigns:publish',
  CAMPAIGNS_CLOSE: 'campaigns:close',
  CAMPAIGNS_ARCHIVE: 'campaigns:archive',

  // Submissions
  FEEDBACK_SUBMIT: 'feedback:submit',
  FEEDBACK_VIEW_OWN: 'feedback:view_own',

  // Reports
  REPORTS_GENERATE: 'reports:generate',
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT_PDF: 'reports:export_pdf',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',

  // AI features
  AI_GENERATE_FORM: 'ai:generate_form',
  AI_GENERATE_REPORT: 'ai:generate_report',

  // Academic Management
  STUDENTS_MANAGE: 'students:manage',
  FACULTY_MANAGE: 'faculty:manage',
  DEPARTMENTS_MANAGE: 'departments:manage',
  COURSES_MANAGE: 'courses:manage',

  // Reminders & Operations
  REMINDERS_VIEW: 'reminders:view',
  REMINDERS_TRIGGER: 'reminders:trigger',

  // Privileged Super-Admin Permissions
  USERS_MANAGE: 'users:manage',
  ADMINS_MANAGE: 'admins:manage',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_LOGS_VIEW: 'audit_logs:view',
  DATA_RETENTION_MANAGE: 'data_retention:manage'
});

/**
 * Default permission matrix mapped by role
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.STUDENT]: Object.freeze([
    PERMISSIONS.FEEDBACK_SUBMIT,
    PERMISSIONS.FEEDBACK_VIEW_OWN,
    PERMISSIONS.FORMS_READ
  ]),

  [ROLES.ADMIN]: Object.freeze([
    PERMISSIONS.FORMS_CREATE,
    PERMISSIONS.FORMS_READ,
    PERMISSIONS.FORMS_UPDATE,
    PERMISSIONS.FORMS_PUBLISH,
    PERMISSIONS.FORMS_ARCHIVE,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_PUBLISH,
    PERMISSIONS.CAMPAIGNS_CLOSE,
    PERMISSIONS.CAMPAIGNS_ARCHIVE,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT_PDF,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AI_GENERATE_FORM,
    PERMISSIONS.AI_GENERATE_REPORT,
    PERMISSIONS.STUDENTS_MANAGE,
    PERMISSIONS.FACULTY_MANAGE,
    PERMISSIONS.DEPARTMENTS_MANAGE,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.REMINDERS_VIEW,
    PERMISSIONS.REMINDERS_TRIGGER
  ]),

  [ROLES.SUPER_ADMIN]: Object.freeze(Object.values(PERMISSIONS))
});

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role, permission, customPermissions = []) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  return rolePerms.includes(permission) || customPermissions.includes(permission);
}
