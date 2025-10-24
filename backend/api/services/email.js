import { Client } from '@microsoft/microsoft-graph-client';
import { UsernamePasswordCredential } from '@azure/identity';
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
 * Initialize Microsoft Graph Client with Delegated Permissions (Username/Password Flow)
 * Uses a service account for sending emails on behalf of users
 */
function getGraphClient() {
  // Use Username/Password Credential for delegated permissions
  const credential = new UsernamePasswordCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_SERVICE_ACCOUNT_USERNAME,
    AZURE_SERVICE_ACCOUNT_PASSWORD,
    {
      // Required for delegated permissions
      authorityHost: 'https://login.microsoftonline.com',
    }
  );

  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        // Request delegated permission scopes
        const token = await credential.getToken([
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/User.Read'
        ]);
        return token.token;
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
    const timestamp = new Date(msg.created_at).toLocaleString();

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
 */
export async function sendLogRequestEmail(data) {
  try {
    const {
      employee,
      conversationHistory,
      conversationId,
      requestType,
      requestMessage,
      attachments = []
    } = data;

    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
      throw new Error('Azure credentials not configured');
    }

    if (!LOG_REQUEST_EMAIL_FROM || !LOG_REQUEST_EMAIL_TO) {
      throw new Error('Email addresses not configured');
    }

    const client = getGraphClient();

    // Prepare email subject
    const subject = `🚨 LOG Request - ${employee.name} - ${employee.policy_type}`;

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
            <h2 style="margin: 0;">🚨 LOG Request Received</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">New support request from chatbot</p>
          </div>

          <div class="content">
            <!-- Employee Information -->
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">👤 Employee Information</h3>
              <div class="info-box">
                <p><span class="label">Name:</span> ${employee.name}</p>
                <p><span class="label">Employee ID:</span> ${employee.employee_id}</p>
                <p><span class="label">Policy Type:</span> ${employee.policy_type}</p>
                <p><span class="label">Coverage Limit:</span> $${employee.coverage_limit?.toLocaleString() || 'N/A'}</p>
                <p><span class="label">Email:</span> ${employee.email || 'Not provided'}</p>
              </div>
            </div>

            <!-- Request Details -->
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">📋 Request Details</h3>
              <div class="info-box">
                <p><span class="label">Trigger Type:</span> ${requestType === 'keyword' ? '🔤 Keyword Detected' : '🖱️ Manual Button Press'}</p>
                <p><span class="label">Conversation ID:</span> ${conversationId}</p>
                <p><span class="label">Request Time:</span> ${new Date().toLocaleString()}</p>
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
            <div class="section">
              <h3 style="color: #1976D2; border-bottom: 2px solid #1976D2; padding-bottom: 5px;">💬 Conversation History</h3>
              ${conversationHTML}
            </div>
          </div>

          <div class="footer">
            <p>This is an automated message from the Insurance Chatbot System</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Prepare attachments for Graph API
    const graphAttachments = [];
    for (const attachment of attachments) {
      try {
        const contentBytes = await fileToBase64(attachment.path);
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
      toRecipients: LOG_REQUEST_EMAIL_TO.split(',').map(email => ({
        emailAddress: {
          address: email.trim()
        }
      })),
      attachments: graphAttachments
    };

    // Send email using Graph API
    await client
      .api(`/users/${LOG_REQUEST_EMAIL_FROM}/sendMail`)
      .post({
        message: message,
        saveToSentItems: true
      });

    console.log(`✓ LOG request email sent successfully to ${LOG_REQUEST_EMAIL_TO}`);
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

            <div class="info-box">
              <h3 style="margin: 0 0 10px 0; color: #4CAF50;">📋 Request Summary</h3>
              <p style="margin: 5px 0;"><strong>Reference ID:</strong> <span class="reference">${conversationId.substring(0, 8).toUpperCase()}</span></p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Attachments:</strong> ${attachmentCount} file${attachmentCount !== 1 ? 's' : ''}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">Pending Review</span></p>
            </div>

            <h3 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">📅 What Happens Next?</h3>
            <ol style="line-height: 1.8; padding-left: 20px;">
              <li><strong>Review:</strong> Our support team will review your conversation history and any attached documents</li>
              <li><strong>Analysis:</strong> We'll analyze your inquiry and prepare a detailed response</li>
              <li><strong>Response:</strong> You'll receive a follow-up email within 1-2 business days</li>
            </ol>

            <div class="info-box" style="background: #E3F2FD; border-left-color: #2196F3;">
              <p style="margin: 0;"><strong>💡 Tip:</strong> Save this email for your records. You can reference the Request ID when following up with our support team.</p>
            </div>

            <p style="margin-top: 25px;">If you have any urgent concerns or questions, please don't hesitate to contact us directly.</p>

            <p style="margin-top: 25px;">Best regards,<br>
            <strong>Support Team</strong></p>
          </div>

          <div class="footer">
            <p style="margin: 5px 0;">This is an automated confirmation from the Insurance Chatbot System</p>
            <p style="margin: 5px 0;">Please do not reply to this email</p>
            <p style="margin: 5px 0; color: #999;">Sent at: ${new Date().toLocaleString()}</p>
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
