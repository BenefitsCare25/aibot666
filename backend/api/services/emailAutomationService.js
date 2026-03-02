import { supabase } from '../../config/supabase.js';
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';

const LOG_REQUEST_EMAIL_FROM = process.env.LOG_REQUEST_EMAIL_FROM;

/**
 * Replace <<current month>>, <<Current Month>>, <<current year>>, <<Current Year>> placeholders
 */
export function resolveTemplateVars(text) {
  if (!text) return text;
  const now = new Date();
  const month = now.toLocaleString('en-SG', { month: 'long', timeZone: 'Asia/Singapore' });
  const year = String(now.getFullYear());
  return text
    .replace(/<<current month>>/gi, month)
    .replace(/<<current year>>/gi, year);
}

/**
 * Parse a multi-email string (newline or comma separated) into an array of address objects
 */
function parseEmailList(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map(e => e.trim())
    .filter(e => e.length > 0)
    .map(e => ({ emailAddress: { address: e } }));
}

/**
 * Build email payload for Graph API from an automation record
 */
export function buildAutomationEmail(record) {
  const to = parseEmailList(record.recipient_email);
  const cc = parseEmailList(record.cc_list);
  const subject = resolveTemplateVars(record.subject);
  const resolvedBody = resolveTemplateVars(record.body_content);
  const htmlBody = `Dear ${record.recipient_name},<br><br>${resolvedBody.replace(/\n/g, '<br>')}`;
  return { to, cc, subject, htmlBody };
}

function getGraphClient() {
  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
    }
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const response = await cca.acquireTokenByUsernamePassword({
          scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read'],
          username: process.env.AZURE_SERVICE_ACCOUNT_USERNAME,
          password: process.env.AZURE_SERVICE_ACCOUNT_PASSWORD
        });
        return response.accessToken;
      }
    }
  });
}

/**
 * Send one automation email and update last_sent_at in DB
 */
export async function sendAutomationEmail(record) {
  const { to, cc, subject, htmlBody } = buildAutomationEmail(record);

  if (!LOG_REQUEST_EMAIL_FROM) {
    throw new Error('LOG_REQUEST_EMAIL_FROM env var not set');
  }

  const client = getGraphClient();
  const message = {
    subject,
    body: { contentType: 'HTML', content: htmlBody },
    toRecipients: to,
    ...(cc.length > 0 && { ccRecipients: cc })
  };

  await client
    .api(`/users/${LOG_REQUEST_EMAIL_FROM}/sendMail`)
    .post({ message, saveToSentItems: true });

  // Update last_sent_at
  const { error } = await supabase
    .from('email_automations')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('id', record.id);

  if (error) {
    console.error(`[EmailAutomation] Failed to update last_sent_at for ${record.id}:`, error.message);
  }
}

/**
 * Daily cron: send emails whose schedule matches today and haven't been sent today
 */
export async function runScheduledCheck() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayDay = now.getDate();

  console.log(`[EmailAutomation] Running scheduled check for ${todayStr} (day ${todayDay})`);

  const { data: records, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('[EmailAutomation] Failed to query records:', error.message);
    return;
  }

  const due = (records || []).filter(r => {
    // Already sent today?
    if (r.last_sent_at) {
      const sentDate = new Date(r.last_sent_at).toISOString().slice(0, 10);
      if (sentDate >= todayStr) return false;
    }
    // Match scheduled_date OR recurring_day
    const matchesDate = r.scheduled_date && r.scheduled_date.slice(0, 10) === todayStr;
    const matchesDay = r.recurring_day !== null && r.recurring_day !== undefined && r.recurring_day === todayDay;
    return matchesDate || matchesDay;
  });

  console.log(`[EmailAutomation] ${due.length} record(s) due today`);

  for (const record of due) {
    try {
      await sendAutomationEmail(record);
      console.log(`[EmailAutomation] Sent email for "${record.portal_name}" (${record.id})`);
    } catch (err) {
      console.error(`[EmailAutomation] Failed to send for "${record.portal_name}":`, err.message);
    }
  }
}
