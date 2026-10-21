/**
 * User roles within the Faculty Feedback & Intelligence Portal
 */
export const ROLES = Object.freeze({
  STUDENT: 'student',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
});

export const ALL_ROLES = Object.freeze([
  ROLES.STUDENT,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
]);

export const ADMIN_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
]);
