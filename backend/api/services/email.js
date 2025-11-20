import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import fs from 'fs/promises';
import path from 'path';

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_SERVICE_ACCOUNT_USERNAME = process.env.AZURE_SERVICE_ACCOUNT_USERNAME;
const AZURE_SERVICE_ACCOUNT_PASSWORD = process.env.AZURE_SERVICE_ACCOUNT_PASSWORD;
const LOG_REQUEST_EMAIL_FROM = process.env.LOG_REQUEST_EMAIL_FROM;
const LOG_REQUEST_EMAIL_TO = process.env.LOG_REQUEST_EMAIL_TO;

/**
 * Format date to Singapore timezone
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string in Singapore time
 */
function toSingaporeTime(date = new Date()) {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Initialize Microsoft Graph Client with Delegated Permissions (ROPC Flow)
 * Uses Resource Owner Password Credentials flow with a service account
 */
function getGraphClient() {
  // Configure MSAL confidential client with client secret
  const msalConfig = {
    auth: {
      clientId: AZURE_CLIENT_ID,
      clientSecret: AZURE_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`
    }
  };

  const cca = new ConfidentialClientApplication(msalConfig);

  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        // Use Resource Owner Password Credentials (ROPC) flow
        const tokenRequest = {
          scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read'],
          username: AZURE_SERVICE_ACCOUNT_USERNAME,
          password: AZURE_SERVICE_ACCOUNT_PASSWORD
        };

        try {
          const response = await cca.acquireTokenByUsernamePassword(tokenRequest);
          return response.accessToken;
        } catch (error) {
          console.error('Error acquiring token:', error);
          throw new Error(`Authentication failed: ${error.message}`);
        }
      }
    }
  });

  return client;
}

/**
 * Convert file to base64 for Graph API attachment
 */
async function fileToBase64(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return fileBuffer.toString('base64');
}

/**
 * Format conversation history as HTML
 */
function formatConversationHTML(messages) {
  let html = '<div style="font-family: Arial, sans-serif;">';

  messages.forEach((msg) => {
    const isUser = msg.role === 'user';
    const bgColor = isUser ? '#E3F2FD' : '#F5F5F5';
    const label = isUser ? '👤 Employee' : '🤖 AI Assistant';
    const timestamp = toSingaporeTime(msg.created_at);

    html += `
      <div style="margin: 15px 0; padding: 12px; background: ${bgColor}; border-radius: 8px;">
        <div style="font-weight: bold; color: #333; margin-bottom: 5px;">
          ${label} <span style="color: #666; font-size: 12px; font-weight: normal;">${timestamp}</span>
        </div>
        <div style="color: #444; line-height: 1.6;">
          ${msg.content.replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/**
 * Send LOG request email with attachments
 * @param {Object} data - Email data
 * @param {Object} data.employee - Employee information
 * @param {Array} data.conversationHistory - Chat messages
 * @param {string} data.conversationId - Conversation ID
 * @param {string} data.requestType - 'keyword' or 'button'
 * @param {string} data.requestMessage - User's message that triggered LOG
 * @param {Array} data.attachments - File attachments [{name, path, size}]
 * @param {Object} data.companyConfig - Company-specific email configuration (optional)
 * @param {string} data.companyConfig.log_request_email_to - Support team email(s)
 * @param {string} data.companyConfig.log_request_email_cc - CC recipients (optional)
 * @param {string} data.customSubject - Custom email subject (optional, overrides default)
 * @param {string} data.customHeader - Custom email header text (optional, overrides default)
 */
export async function sendLogRequestEmail(data) {
  try {
    const {
      employee,
      conversationHistory,
      conversationId,
      requestType,
      requestMessage,
      attachments = [],
      companyConfig = {},
      customSubject = null,
      customHeader = null
    } = data;

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
      throw new Error('Azure credentials not configured');
    }

    // Use company-specific email or fallback to environment variable
    const emailTo = companyConfig.log_request_email_to || LOG_REQUEST_EMAIL_TO;
    const emailCc = companyConfig.log_request_email_cc || null;
    const emailFrom = LOG_REQUEST_EMAIL_FROM;

    if (!emailFrom) {
      throw new Error('Email sender not configured (LOG_REQUEST_EMAIL_FROM)');
    }

    if (!emailTo) {
      throw new Error('Email recipient not configured. Please set company email configuration or LOG_REQUEST_EMAIL_TO environment variable.');
    }

    const client = getGraphClient();

    // Prepare email subject - use custom subject if provided, otherwise use default
    const subject = customSubject || `🚨 LOG Request - ${employee.name}`;

    // Format conversation history
    const conversationHTML = formatConversationHTML(conversationHistory);

    // Prepare email body (HTML)
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #fff; }
          .section { margin: 20px 0; }
          .label { font-weight: bold; color: #1976D2; }
          .info-box { background: #F5F5F5; padding: 15px; border-radius: 8px; margin: 10px 0; }
          .footer { background: #F5F5F5; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div style="max-width: 800px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
          <div class="header">
            <h2 style="margin: 0;">${customHeader || '🚨 LOG Request Received'}</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">New support request from chatbot</p>
          </div>

          <div class="content">
            <!-- Employee Information -->
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">👤 Employee Information</h3>
              <div class="info-box">
                <p><span class="label">Name:</span> ${employee.name}</p>
                <p><span class="label">Employee ID:</span> ${employee.employee_id}</p>
                <p><span class="label">Email:</span> ${employee.email || 'Not provided'}</p>
              </div>
            </div>

            <!-- Request Details -->
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">📋 Request Details</h3>
              <div class="info-box">
                <p><span class="label">Trigger Type:</span> ${
                  requestType === 'keyword' ? '🔤 Keyword Detected' :
                  requestType === 'button' ? '🖱️ Manual Button Press' :
                  '🌐 Web Form Request (Anonymous)'
                }</p>
                <p><span class="label">${requestType === 'anonymous' ? 'Request ID' : 'Conversation ID'}:</span> ${conversationId || 'N/A'}</p>
                <p><span class="label">Request Time:</span> ${toSingaporeTime()}</p>
                <p><span class="label">User Message:</span></p>
                <p style="background: white; padding: 10px; border-left: 3px solid #1976D2; margin-top: 5px;">
                  "${requestMessage}"
                </p>
              </div>
            </div>

            <!-- Attachments Info -->
            ${attachments.length > 0 ? `
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">📎 Attachments (${attachments.length})</h3>
              <div class="info-box">
                <ul style="margin: 5px 0; padding-left: 20px;">
                  ${attachments.map(att => `
                    <li><strong>${att.name}</strong> (${(att.size / 1024 / 1024).toFixed(2)} MB)</li>
                  `).join('')}
                </ul>
              </div>
            </div>
            ` : ''}

            <!-- Conversation History -->
            ${conversationHistory && conversationHistory.length > 0 ? `
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">💬 Conversation History</h3>
              ${conversationHTML}
            </div>
            ` : `
            <div class="section">
              <div class="info-box" style="background: #FFF3E0; border-left-color: #FF9800;">
                <p style="margin: 0;"><strong>ℹ️ Note:</strong> This is a direct LOG request without prior conversation history.</p>
              </div>
            </div>
            `}
          </div>

          <div class="footer">
            <p>This is an automated message.</p>
            <p>Generated at: ${toSingaporeTime()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Prepare attachments for Graph API
    const graphAttachments = [];
    for (const attachment of attachments) {
      try {
        // Use base64 data from attachment object (already encoded)
        // OR read from file path if path is provided (backward compatibility)
        const contentBytes = attachment.base64 || await fileToBase64(attachment.path);

        graphAttachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.name,
          contentBytes: contentBytes
        });
      } catch (error) {
        console.error(`Error encoding attachment ${attachment.name}:`, error);
      }
    }

    // Prepare email message
    const message = {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: htmlBody
      },
      toRecipients: emailTo.split(',').map(email => ({
        emailAddress: {
          address: email.trim()
        }
      })),
      attachments: graphAttachments
    };

    // Add CC recipients if provided
    if (emailCc && emailCc.trim()) {
      message.ccRecipients = emailCc.split(',').map(email => ({
        emailAddress: {
          address: email.trim()
        }
      }));
    }

    // Send email using Graph API
    await client
      .api(`/users/${emailFrom}/sendMail`)
      .post({
        message: message,
        saveToSentItems: true
      });

    const logMessage = emailCc
      ? `✓ LOG request email sent successfully to ${emailTo} (CC: ${emailCc})`
      : `✓ LOG request email sent successfully to ${emailTo}`;
    console.log(logMessage);
    return { success: true, emailSentAt: new Date().toISOString() };

  } catch (error) {
    console.error('Error sending LOG request email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send acknowledgment email to user
 * @param {Object} data - Email data
 * @param {string} data.userEmail - User's email address
 * @param {string} data.userName - User's name
 * @param {string} data.conversationId - Conversation ID for reference
 * @param {number} data.attachmentCount - Number of attachments included
 */
export async function sendAcknowledgmentEmail(data) {
  try {
    const {
      userEmail,
      userName,
      conversationId,
      attachmentCount = 0
    } = data;

    if (!userEmail) {
      console.log('No user email provided, skipping acknowledgment');
      return { success: false, reason: 'No email provided' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.error('Invalid email format:', userEmail);
      return { success: false, reason: 'Invalid email format' };
    }

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
      throw new Error('Azure credentials not configured');
    }

    if (!LOG_REQUEST_EMAIL_FROM) {
      throw new Error('Email sender not configured');
    }

    const client = getGraphClient();

    // Prepare acknowledgment email subject
    const subject = `✅ LOG Request Received - Reference: ${conversationId.substring(0, 8)}`;

    // Prepare acknowledgment email body (HTML)
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; }
          .header { background: #4CAF50; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px 20px; background: #fff; }
          .info-box { background: #F5F5F5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .footer { background: #F5F5F5; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
          .checkmark { font-size: 48px; color: #4CAF50; }
          .reference { font-family: monospace; background: #E8F5E9; padding: 5px 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="checkmark">✅</div>
            <h1 style="margin: 10px 0 5px 0; font-size: 28px;">LOG Request Received</h1>
            <p style="margin: 0; opacity: 0.9; font-size: 16px;">We've received your support request</p>
          </div>

          <div class="content">
            <p style="font-size: 16px;">Dear ${userName},</p>

            <p>Thank you for submitting your LOG request through our chatbot. This email confirms that we have successfully received your request and our support team will review it shortly.</p>

            <p style="margin-top: 25px;">If you have any urgent concerns or questions, please don't hesitate to contact us directly.</p>

            <p style="margin-top: 25px;">Best regards,<br>
            <strong>Support Team</strong></p>
          </div>

          <div class="footer">
            <p style="margin: 5px 0;">This is an automated confirmation from the Insurance Chatbot System</p>
            <p style="margin: 5px 0;">Please do not reply to this email</p>
            <p style="margin: 5px 0; color: #999;">Sent at: ${toSingaporeTime()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Prepare email message
    const message = {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: htmlBody
      },
      toRecipients: [{
        emailAddress: {
          address: userEmail
        }
      }]
    };

    // Send acknowledgment email
    await client
      .api(`/users/${LOG_REQUEST_EMAIL_FROM}/sendMail`)
      .post({
        message: message,
        saveToSentItems: true
      });

    console.log(`✓ Acknowledgment email sent successfully to ${userEmail}`);
    return { success: true, emailSentAt: new Date().toISOString() };

  } catch (error) {
    console.error('Error sending acknowledgment email:', error);
    // Don't throw - acknowledgment failure shouldn't block LOG request
    return { success: false, error: error.message };
  }
}

export default {
  sendLogRequestEmail,
  sendAcknowledgmentEmail
};
