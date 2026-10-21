import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import {
  getInvitationEmail,
  getReminderEmail,
  getAdminEscalationEmail,
  getSubmissionConfirmationEmail,
  getPasswordResetEmail
} from './templates/index.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.EMAIL_MOCK_ENABLED || env.NODE_ENV === 'test') {
    logger.info('Using Mock Email Transporter (emails logged, not delivered to external SMTP)');
    transporter = {
      sendMail: async (options) => {
        logger.info(
          { to: options.to, subject: options.subject },
          '[MOCK_EMAIL] Simulated email dispatch successfully'
        );
        return {
          messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          response: '250 Mock Email Dispatched OK',
          accepted: [options.to],
          rejected: []
        };
      }
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: env.EMAIL_USER ? {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASSWORD
    } : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
  });

  return transporter;
}

/**
 * Send an email with retry logic and exponential backoff
 */
export async function sendEmail({ to, subject, html, text, replyTo = env.EMAIL_REPLY_TO, maxRetries = 3 }) {
  const mailClient = getTransporter();

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const info = await mailClient.sendMail({
        from: env.EMAIL_FROM,
        to,
        replyTo,
        subject,
        html,
        text
      });

      logger.info(
        { messageId: info.messageId, to, attempt },
        'Email successfully sent'
      );

      return {
        success: true,
        status: 'sent',
        messageId: info.messageId,
        attempt
      };
    } catch (err) {
      lastError = err;
      logger.warn(
        { err: err.message, to, attempt, maxRetries },
        `Email dispatch attempt ${attempt} failed`
      );

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }

  logger.error(
    { err: lastError?.message, to, attempts: maxRetries },
    'Email dispatch permanently failed after retries'
  );

  return {
    success: false,
    status: 'failed',
    errorMessage: lastError?.message || 'Unknown email delivery failure',
    attempt: maxRetries
  };
}

/**
 * Convenience methods for domain-specific emails
 */

export async function sendCampaignInvitation({ studentEmail, studentName, campaignTitle, courseName, facultyName, deadline, formUrl }) {
  const { subject, html, text } = getInvitationEmail({
    studentName,
    campaignTitle,
    courseName,
    facultyName,
    deadline: new Date(deadline).toLocaleString('en-US', { timeZone: env.DEFAULT_TIMEZONE }),
    formUrl
  });

  return sendEmail({ to: studentEmail, subject, html, text });
}

export async function sendCampaignReminder({ studentEmail, studentName, campaignTitle, deadline, formUrl, reminderNumber }) {
  const { subject, html, text } = getReminderEmail({
    studentName,
    campaignTitle,
    deadline: new Date(deadline).toLocaleString('en-US', { timeZone: env.DEFAULT_TIMEZONE }),
    formUrl,
    reminderNumber
  });

  return sendEmail({ to: studentEmail, subject, html, text });
}

export async function sendAdminEscalation({ adminEmail, adminName, campaignTitle, campaignId, pendingCount, totalEligible, dashboardUrl }) {
  const { subject, html, text } = getAdminEscalationEmail({
    adminName,
    campaignTitle,
    campaignId,
    pendingCount,
    totalEligible,
    dashboardUrl
  });

  return sendEmail({ to: adminEmail, subject, html, text });
}

export async function sendSubmissionConfirmation({ studentEmail, studentName, campaignTitle, receiptToken, submittedAt }) {
  const { subject, html, text } = getSubmissionConfirmationEmail({
    studentName,
    campaignTitle,
    receiptToken,
    submittedAt: new Date(submittedAt).toLocaleString('en-US', { timeZone: env.DEFAULT_TIMEZONE })
  });

  return sendEmail({ to: studentEmail, subject, html, text });
}

export async function sendPasswordReset({ userEmail, userName, resetUrl }) {
  const { subject, html, text } = getPasswordResetEmail({
    userName,
    resetUrl
  });

  return sendEmail({ to: userEmail, subject, html, text });
}
