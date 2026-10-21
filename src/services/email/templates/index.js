import { escapeHtml } from '../../../utils/sanitization.js';

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; line-height: 1.6; }
  .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
  .header { background-color: #0f172a; color: #ffffff; padding: 24px 32px; text-align: left; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
  .content { padding: 32px; }
  .footer { background-color: #f1f5f9; padding: 20px 32px; font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; font-weight: 600; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  .meta-box { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0; }
  .privacy-badge { background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin: 16px 0; }
`;

export function getInvitationEmail({ studentName, campaignTitle, courseName, facultyName, deadline, formUrl }) {
  const safeTitle = escapeHtml(campaignTitle);
  const safeName = escapeHtml(studentName);
  const safeCourse = escapeHtml(courseName || 'Assigned Course');
  const safeFaculty = escapeHtml(facultyName || 'Faculty Member');

  const subject = `Action Required: Student Feedback on ${campaignTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Faculty Feedback Portal</h1>
        </div>
        <div class="content">
          <p>Hello ${safeName},</p>
          <p>You have been assigned to participate in the institutional feedback evaluation for <strong>${safeTitle}</strong>.</p>
          <div class="meta-box">
            <strong>Course:</strong> ${safeCourse}<br/>
            <strong>Faculty:</strong> ${safeFaculty}<br/>
            <strong>Submission Deadline:</strong> ${deadline}
          </div>
          <div class="privacy-badge">
            🔒 <strong>Strict Technical Anonymity:</strong> Your responses are decoupled from your identity. Faculty and report viewers cannot view who submitted which response.
          </div>
          <p>Your honest, constructive feedback directly shapes instructional quality and academic enhancement.</p>
          <p style="text-align: center;">
            <a href="${formUrl}" class="button" target="_blank">Complete Feedback Form</a>
          </p>
          <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser: <br/>${formUrl}</p>
        </div>
        <div class="footer">
          Institutional Feedback & Intelligence Portal • Sent automatically by Academic Affairs.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hello ${studentName},\n\nYou have been assigned to submit feedback for ${campaignTitle}.\nCourse: ${courseName}\nFaculty: ${facultyName}\nDeadline: ${deadline}\n\nYour feedback is strictly anonymous.\nComplete the form here: ${formUrl}\n\nAcademic Affairs`;

  return { subject, html, text };
}

export function getReminderEmail({ studentName, campaignTitle, deadline, formUrl, reminderNumber = 1 }) {
  const safeTitle = escapeHtml(campaignTitle);
  const safeName = escapeHtml(studentName);

  const subject = `Reminder #${reminderNumber}: Feedback Pending for ${campaignTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Feedback Reminder (${reminderNumber}/2)</h1>
        </div>
        <div class="content">
          <p>Hello ${safeName},</p>
          <p>Our records show that your feedback submission for <strong>${safeTitle}</strong> is still pending.</p>
          <div class="meta-box">
            <strong>Campaign:</strong> ${safeTitle}<br/>
            <strong>Final Deadline:</strong> ${deadline}
          </div>
          <div class="privacy-badge">
            🔒 Your submission remains 100% anonymous. This reminder is generated based on separate eligibility tracking.
          </div>
          <p>It takes only 3 to 5 minutes to submit your evaluation.</p>
          <p style="text-align: center;">
            <a href="${formUrl}" class="button" target="_blank">Submit Your Feedback Now</a>
          </p>
        </div>
        <div class="footer">
          Institutional Feedback & Intelligence Portal • Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hello ${studentName},\n\nReminder #${reminderNumber}: Your feedback for ${campaignTitle} is still pending. Deadline: ${deadline}.\n\nSubmit here: ${formUrl}`;

  return { subject, html, text };
}

export function getAdminEscalationEmail({ adminName, campaignTitle, campaignId, pendingCount, totalEligible, dashboardUrl }) {
  const safeAdmin = escapeHtml(adminName);
  const safeTitle = escapeHtml(campaignTitle);

  const subject = `Overdue Notice: Campaign "${campaignTitle}" has ${pendingCount} pending submissions`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #7f1d1d;">
          <h1>Administrative Overdue Escalation</h1>
        </div>
        <div class="content">
          <p>Dear ${safeAdmin},</p>
          <p>Automated reminders (Invitation, Reminder 1, and Reminder 2) have completed for campaign <strong>${safeTitle}</strong>.</p>
          <div class="meta-box" style="border-left-color: #dc2626;">
            <strong>Campaign ID:</strong> ${campaignId}<br/>
            <strong>Pending Submissions:</strong> ${pendingCount} / ${totalEligible}<br/>
            <strong>Current Completion Rate:</strong> ${Math.round(((totalEligible - pendingCount) / (totalEligible || 1)) * 100)}%
          </div>
          <p>You may inspect the aggregated campaign status and trigger authorized manual reconciliation or outreach via the administrative dashboard.</p>
          <p style="text-align: center;">
            <a href="${dashboardUrl}" class="button" style="background-color: #dc2626;" target="_blank">Open Admin Dashboard</a>
          </p>
        </div>
        <div class="footer">
          Faculty Feedback Intelligence System • Internal Administrator Alert
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Dear ${adminName},\n\nCampaign "${campaignTitle}" has ${pendingCount} of ${totalEligible} submissions pending after 2 automated reminders.\nInspect dashboard: ${dashboardUrl}`;

  return { subject, html, text };
}

export function getSubmissionConfirmationEmail({ studentName, campaignTitle, receiptToken, submittedAt }) {
  const safeName = escapeHtml(studentName);
  const safeTitle = escapeHtml(campaignTitle);

  const subject = `Confirmation: Feedback Submitted for ${campaignTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #065f46;">
          <h1>Submission Confirmed</h1>
        </div>
        <div class="content">
          <p>Hello ${safeName},</p>
          <p>Thank you for submitting your evaluation for <strong>${safeTitle}</strong>.</p>
          <div class="meta-box" style="border-left-color: #10b981;">
            <strong>Submission Timestamp:</strong> ${submittedAt}<br/>
            <strong>Verification Receipt Code:</strong> <code>${receiptToken}</code>
          </div>
          <p>Your feedback has been anonymized and recorded successfully. You will not receive any further reminders for this campaign.</p>
        </div>
        <div class="footer">
          Faculty Feedback Portal • Thank you for your contribution to academic excellence.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hello ${studentName},\n\nYour feedback for ${campaignTitle} was successfully received on ${submittedAt}.\nReceipt Code: ${receiptToken}`;

  return { subject, html, text };
}

export function getPasswordResetEmail({ userName, resetUrl, expiresInMinutes = 15 }) {
  const safeName = escapeHtml(userName);
  const subject = 'Password Reset Request — Faculty Feedback Portal';
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello ${safeName},</p>
          <p>You recently requested to reset your password. Click the button below to choose a new password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
          </p>
          <p>This single-use link will expire in <strong>${expiresInMinutes} minutes</strong>.</p>
          <p style="font-size: 13px; color: #64748b;">If you did not request this, please disregard this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          Faculty Feedback Portal • Security Notification
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hello ${userName},\n\nReset your password here: ${resetUrl}\nExpires in ${expiresInMinutes} minutes. If you did not request this, please ignore this email.`;

  return { subject, html, text };
}
