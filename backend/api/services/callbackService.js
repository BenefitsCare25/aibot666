/**
 * Send callback notification email to support team
 * Formats callback request data and sends via the existing email service
 * @param {object} data - Callback notification data
 * @param {object} data.callbackRequest - The callback request record from DB
 * @param {string} data.contactNumber - User's contact number
 * @param {string} data.employeeId - The identifier value used
 * @param {string} data.identifierType - Type of identifier ('employee_id', 'user_id', 'email', 'none')
 * @param {object} data.company - Company record
 */
export async function sendCallbackNotificationEmail(data) {
  const { callbackRequest, contactNumber, employeeId, identifierType, company } = data;

  // Import at function level to avoid circular dependencies
  const { sendLogRequestEmail } = await import('./email.js');

  const companyConfig = {
    log_request_email_to: company?.callback_email_to || company?.log_request_email_to,
    log_request_email_cc: company?.callback_email_cc || company?.log_request_email_cc
  };

  // Format identifier label based on type
  const identifierLabel = identifierType === 'employee_id' ? 'Employee ID' :
                           identifierType === 'user_id' ? 'User ID' :
                           identifierType === 'email' ? 'Email' : 'Identifier';

  // Format as if it's a LOG request but for callback
  const emailData = {
    employee: {
      name: 'Callback Request',
      employee_id: `${identifierLabel}: ${employeeId}`,
      email: identifierType === 'email' ? employeeId : 'Not available'
    },
    conversationHistory: [{
      role: 'user',
      content: `User requested a callback at: ${contactNumber}\n${identifierLabel}: ${employeeId}`,
      created_at: new Date().toISOString()
    }],
    conversationId: callbackRequest.id,
    requestType: 'button',
    requestMessage: `Callback requested - Contact number: ${contactNumber}, ${identifierLabel}: ${employeeId}`,
    attachments: [],
    companyConfig,
    customSubject: '📞 Invalid ID, Callback Request',
    customHeader: '📞 Callback Request Received'
  };

  return await sendLogRequestEmail(emailData);
}

/**
 * Send callback notification to Telegram
 * @param {object} data - Callback notification data
 * @param {object} data.callbackRequest - The callback request record from DB
 * @param {string} data.contactNumber - User's contact number
 * @param {string} data.employeeId - The identifier value used
 * @param {string} data.identifierType - Type of identifier ('employee_id', 'user_id', 'email', 'none')
 * @param {object} data.company - Company record
 * @param {string} data.schemaName - Tenant schema name for multi-tenant routing
 */
export async function sendCallbackTelegramNotification(data) {
  const { callbackRequest, contactNumber, employeeId, identifierType, company, schemaName } = data;

  // Check if bot is configured
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured - callback notification not sent');
    return;
  }

  const { Telegraf } = await import('telegraf');
  const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // Format identifier label based on type
  const identifierLabel = identifierType === 'employee_id' ? 'Employee ID' :
                           identifierType === 'user_id' ? 'User ID' :
                           identifierType === 'email' ? 'Email' : 'Identifier';

  const message = `
🔔 <b>Callback Request</b>

<b>Contact Number:</b> ${contactNumber}
<b>${identifierLabel}:</b> ${employeeId}
<b>Company:</b> ${company?.name || 'Unknown'}
<b>Status:</b> 🟡 Pending Callback

<b>Request Time:</b> ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}

<i>[Callback Request: ${callbackRequest.id}${schemaName ? `|Schema: ${schemaName}` : ''}]</i>

📞 Please contact the user within the next working day.
  `.trim();

  await telegramBot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
    parse_mode: 'HTML'
  });
}
