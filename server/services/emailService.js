import { EmailClient } from '@azure/communication-email';
import prisma from '../lib/prisma.js';
import { logAudit } from './auditService.js';

let emailClient = null;
let acsWarningLogged = false;

function getClient() {
  if (emailClient) return emailClient;

  const connStr = process.env.ACS_CONNECTION_STRING;
  if (!connStr) {
    if (!acsWarningLogged) {
      console.warn('[EmailService] ACS_CONNECTION_STRING not set — emails will be skipped.');
      acsWarningLogged = true;
    }
    return null;
  }

  emailClient = new EmailClient(connStr);
  return emailClient;
}

function renderTemplate(text, variables) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * Send an email using a DB template. Fire-and-forget — never throws.
 * @param {string} templateKey - EmailTemplate.key
 * @param {string} to - recipient email address
 * @param {Record<string, string>} variables - placeholder values
 * @param {{ performedBy?: string, userId?: number, cc?: string[] }} auditContext
 */
export async function sendTemplateEmail(templateKey, to, variables, auditContext = {}) {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!template || !template.active) return;

    const client = getClient();
    if (!client) return;

    const senderAddress = process.env.EMAIL_SENDER_ADDRESS;
    if (!senderAddress) {
      console.warn('[EmailService] EMAIL_SENDER_ADDRESS not set — skipping email.');
      return;
    }

    const subject = renderTemplate(template.subject, variables);
    const body = renderTemplate(template.body, variables);

    const ccEmails = (auditContext.cc || []).filter(e => e && e.includes('@'));

    const message = {
      senderAddress,
      content: { subject, plainText: body },
      recipients: {
        to: [{ address: to }],
        ...(ccEmails.length > 0 && { cc: ccEmails.map(address => ({ address })) }),
      },
    };

    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();

    const ccInfo = ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : '';
    await logAudit({
      action: 'EMAIL_SENT',
      details: `Sent "${templateKey}" email to ${to}${ccInfo} — subject: ${subject}`,
      performedBy: auditContext.performedBy || 'System',
      userId: auditContext.userId || null,
      metadata: { templateKey, to, cc: ccEmails, messageId: result?.id },
    });
  } catch (err) {
    console.error(`[EmailService] Failed to send "${templateKey}" to ${to}:`, err.message);
  }
}
