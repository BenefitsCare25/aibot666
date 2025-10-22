import { Telegraf } from 'telegraf';
import supabase from '../../config/supabase.js';
import { addKnowledgeEntry } from './vectorDB.js';
import dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot;

if (TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
    telegram: {
      apiRoot: 'https://api.telegram.org',
      webhookReply: false,
      agent: null, // Use default agent
      attachmentAgent: null
    },
    handlerTimeout: 90000 // 90 second timeout instead of default
  });
  console.log('✓ Telegram bot initialized');
} else {
  console.warn('⚠ TELEGRAM_BOT_TOKEN not set - HITL features disabled');
}

/**
 * Extract contact information (email/phone) from conversation messages
 * @param {Array} messages - Array of conversation messages
 * @returns {Object} - Extracted contact information
 */
function extractContactInfo(messages) {
  // Email pattern: standard email format
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  // Phone pattern: flexible format supporting international, parentheses, dashes, spaces
  const phoneRegex = /\b(\+?\d{1,4}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/g;

  const emails = new Set();
  const phones = new Set();

  // Only extract from user messages
  messages.forEach(msg => {
    if (msg.role === 'user' || msg.content) {
      const content = msg.content || '';

      // Extract emails
      const foundEmails = content.match(emailRegex);
      if (foundEmails) {
        foundEmails.forEach(email => emails.add(email.toLowerCase()));
      }

      // Extract phones (filter out numbers that are too short or likely not phone numbers)
      const foundPhones = content.match(phoneRegex);
      if (foundPhones) {
        foundPhones.forEach(phone => {
          // Remove spaces and dashes for validation
          const cleaned = phone.replace(/[\s-()]/g, '');
          // Only add if it looks like a real phone number (8-15 digits)
          if (cleaned.length >= 8 && cleaned.length <= 15) {
            phones.add(phone.trim());
          }
        });
      }
    }
  });

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
    found: emails.size > 0 || phones.size > 0
  };
}

/**
 * Initialize Telegram bot with message handlers
 */
export function initializeTelegramBot() {
  if (!bot) {
    console.warn('Telegram bot not configured');
    return;
  }

  // Handle /start command
  bot.command('start', (ctx) => {
    ctx.reply(
      'Insurance Bot - Human Support Interface\n\n' +
      'I will notify you when the chatbot needs help answering employee questions.\n\n' +
      'To respond to an escalation, reply to the message with your answer.\n\n' +
      'Commands:\n' +
      '/help - Show this help message\n' +
      '/pending - Show pending escalations\n' +
      '/stats - Show escalation statistics'
    );
  });

  // Handle /help command
  bot.command('help', (ctx) => {
    ctx.reply(
      '📋 How to respond to escalations:\n\n' +
      '1. When you receive an escalation notification, read:\n' +
      '   - The employee\'s question\n' +
      '   - The AI\'s response\n' +
      '   - Why it was escalated (no knowledge/low confidence)\n\n' +
      '2. Reply to the message with one of:\n' +
      '   ✅ "correct" - Confirm AI response is good\n' +
      '   📝 Custom answer - Provide better answer\n' +
      '   ⏭️ "skip" - Mark as reviewed, don\'t add to KB\n\n' +
      '3. The system will:\n' +
      '   - Save response to knowledge base\n' +
      '   - Use it for similar questions\n' +
      '   - Mark escalation as resolved\n\n' +
      'Commands:\n' +
      '/pending - List all pending escalations\n' +
      '/stats - View escalation statistics'
    );
  });

  // Handle /pending command
  bot.command('pending', async (ctx) => {
    try {
      // Note: This command operates on public schema by default
      // TODO: Support multi-tenant pending queries
      const { data: escalations, error } = await supabase
        .from('escalations')
        .select(`
          id,
          query,
          created_at,
          employees (name, policy_type)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!escalations || escalations.length === 0) {
        ctx.reply('✅ No pending escalations!');
        return;
      }

      let message = `📊 Pending Escalations (${escalations.length}):\n\n`;

      escalations.forEach((esc, idx) => {
        message += `${idx + 1}. [${esc.id.substring(0, 8)}]\n`;
        message += `   Employee: ${esc.employees?.name}\n`;
        message += `   Question: ${esc.query.substring(0, 100)}${esc.query.length > 100 ? '...' : ''}\n`;
        message += `   Time: ${new Date(esc.created_at).toLocaleString()}\n\n`;
      });

      ctx.reply(message);
    } catch (error) {
      console.error('Error fetching pending escalations:', error);
      ctx.reply('❌ Error fetching escalations');
    }
  });

  // Handle /stats command
  bot.command('stats', async (ctx) => {
    try {
      // Note: This command operates on public schema by default
      // TODO: Support multi-tenant stats queries
      const { data: stats, error } = await supabase
        .from('escalations')
        .select('status, created_at');

      if (error) throw error;

      const total = stats.length;
      const pending = stats.filter(s => s.status === 'pending').length;
      const resolved = stats.filter(s => s.status === 'resolved').length;
      const today = stats.filter(s => {
        const date = new Date(s.created_at);
        const now = new Date();
        return date.toDateString() === now.toDateString();
      }).length;

      ctx.reply(
        `📈 Escalation Statistics:\n\n` +
        `Total: ${total}\n` +
        `Pending: ${pending}\n` +
        `Resolved: ${resolved}\n` +
        `Today: ${today}`
      );
    } catch (error) {
      console.error('Error fetching stats:', error);
      ctx.reply('❌ Error fetching statistics');
    }
  });

  // Handle replies to escalation messages
  bot.on('message', async (ctx) => {
    try {
      // Debug logging for group chat troubleshooting
      console.log('📩 Received message:', {
        hasReply: !!ctx.message.reply_to_message,
        messageText: ctx.message.text?.substring(0, 50),
        chatType: ctx.chat.type,
        fromUser: ctx.from?.username || ctx.from?.first_name
      });

      // Check if this is a reply to an escalation
      if (!ctx.message.reply_to_message) {
        console.log('⏭️ Not a reply message, ignoring');
        return;
      }

      // Support both text and caption for media messages
      const replyToText = ctx.message.reply_to_message.text ||
                         ctx.message.reply_to_message.caption || '';
      const response = ctx.message.text || ctx.message.caption || '';

      console.log('🔍 Processing reply:', {
        replyToLength: replyToText.length,
        responseLength: response.length,
        replyPreview: replyToText.substring(0, 100)
      });

      // Extract escalation ID and schema from the original message
      const escalationIdMatch = replyToText.match(/\[Escalation: ([a-f0-9-]+)(?:\|Schema: ([a-z0-9_]+))?\]/);

      if (!escalationIdMatch) {
        console.log('❌ No escalation ID found in reply');
        return; // Not an escalation message
      }

      const escalationId = escalationIdMatch[1];
      const schemaName = escalationIdMatch[2]; // May be undefined for old messages
      console.log(`✅ Found escalation ID: ${escalationId}${schemaName ? ` in schema: ${schemaName}` : ''}`);

      // Get schema-specific client
      // Import getSchemaClient here to avoid circular dependencies
      const { getSchemaClient } = await import('../../config/supabase.js');
      const schemaClient = getSchemaClient(schemaName || null);

      console.log(`[Supabase] Using client for schema: ${schemaName || 'public'}`);

      // Get escalation details
      const { data: escalation, error: escError } = await schemaClient
        .from('escalations')
        .select(`
          *,
          employees (name, email, policy_type)
        `)
        .eq('id', escalationId)
        .single();

      if (escError) {
        console.error('❌ Database error fetching escalation:', escError);
        ctx.reply('❌ Escalation not found');
        return;
      }

      if (!escalation) {
        console.log('❌ No escalation found with ID:', escalationId);
        ctx.reply('❌ Escalation not found');
        return;
      }

      console.log(`📋 Escalation status: ${escalation.status}`);

      if (escalation.status !== 'pending') {
        ctx.reply('ℹ️ This escalation has already been resolved');
        return;
      }

      // Normalize response for command detection
      const normalizedResponse = response.trim().toLowerCase();
      console.log(`💬 User response: "${normalizedResponse}"`);

      // Handle "skip" command - mark as reviewed without adding to KB
      if (normalizedResponse === 'skip' || normalizedResponse === '/skip') {
        console.log('⏭️ Processing SKIP command');
        const { error: updateError } = await schemaClient
          .from('escalations')
          .update({
            status: 'skipped',
            resolution: 'Reviewed but not added to knowledge base',
            resolved_by: ctx.from.username || ctx.from.first_name,
            resolved_at: new Date().toISOString()
          })
          .eq('id', escalationId);

        if (updateError) {
          console.error('❌ Error updating escalation (skip):', updateError);
          ctx.reply('❌ Error updating escalation');
          return;
        }

        console.log(`✅ Escalation ${escalationId} marked as skipped`);
        ctx.reply(
          '⏭️ Escalation skipped\n\n' +
          '✓ Marked as reviewed\n' +
          '✗ Not added to knowledge base\n\n' +
          `Employee: ${escalation.employees?.name}\n` +
          `Question: ${escalation.query.substring(0, 100)}${escalation.query.length > 100 ? '...' : ''}`
        );
        return;
      }

      // Handle "correct" command - use AI's response
      const isCorrectCommand = normalizedResponse === 'correct' ||
                               normalizedResponse === '✓' ||
                               normalizedResponse === 'ok' ||
                               normalizedResponse === '/correct';

      let answerToSave;
      let resolvedStatus;

      if (isCorrectCommand) {
        console.log('✅ Processing CORRECT command');
        // Use AI's original response from context
        answerToSave = escalation.context?.aiResponse;
        resolvedStatus = 'AI response confirmed as correct';

        if (!answerToSave) {
          console.error('❌ No aiResponse in escalation context:', escalation.context);
          ctx.reply('❌ Original AI response not found in escalation context');
          return;
        }
        console.log(`📝 Using AI response (${answerToSave.substring(0, 50)}...)`);
      } else {
        console.log('📝 Processing CUSTOM answer');
        // Use human's custom answer
        answerToSave = response;
        resolvedStatus = 'Custom answer provided';
        console.log(`📝 Using custom answer (${answerToSave.substring(0, 50)}...)`);
      }

      // Update escalation with resolution
      console.log(`💾 Updating escalation ${escalationId} to resolved status...`);
      const { error: updateError } = await schemaClient
        .from('escalations')
        .update({
          status: 'resolved',
          resolution: answerToSave,
          resolved_by: ctx.from.username || ctx.from.first_name,
          resolved_at: new Date().toISOString()
        })
        .eq('id', escalationId);

      if (updateError) {
        console.error('❌ Error updating escalation to resolved:', updateError);
        ctx.reply('❌ Error updating escalation');
        return;
      }

      console.log(`✅ Escalation ${escalationId} marked as resolved`);

      // Add to knowledge base
      try {
        console.log('📚 Adding to knowledge base...');
        await addKnowledgeEntry({
          title: escalation.query.substring(0, 200),
          content: `Question: ${escalation.query}\n\nAnswer: ${answerToSave}`,
          category: 'hitl_learning',
          subcategory: escalation.employees?.policy_type || 'general',
          metadata: {
            escalation_id: escalationId,
            resolved_by: ctx.from.username || ctx.from.first_name,
            employee_policy: escalation.employees?.policy_type,
            source_type: isCorrectCommand ? 'ai_confirmed' : 'human_provided'
          },
          source: 'hitl_learning'
        });

        console.log('✅ Successfully added to knowledge base');

        // Mark as added to knowledge base
        await schemaClient
          .from('escalations')
          .update({ was_added_to_kb: true })
          .eq('id', escalationId);

        console.log('✅ Updated was_added_to_kb flag');

        // Update chat history to mark as resolved
        if (escalation.message_id) {
          await schemaClient
            .from('chat_history')
            .update({ escalation_resolved: true })
            .eq('id', escalation.message_id);
          console.log('✅ Updated chat history escalation_resolved flag');
        }

        const statusIcon = isCorrectCommand ? '✅' : '📝';
        const statusText = isCorrectCommand ? 'AI response confirmed' : 'Custom answer saved';

        console.log(`🎉 Workflow complete! Sending success message to user`);
        ctx.reply(
          `${statusIcon} ${statusText}\n\n` +
          '✓ Escalation marked as resolved\n' +
          '✓ Added to knowledge base\n' +
          '✓ Bot will use this for similar questions\n\n' +
          `Employee: ${escalation.employees?.name}\n` +
          `Question: ${escalation.query.substring(0, 100)}${escalation.query.length > 100 ? '...' : ''}`
        );
      } catch (kbError) {
        console.error('❌ Error adding to knowledge base:', kbError);
        ctx.reply('⚠️ Response saved but failed to add to knowledge base');
      }
    } catch (error) {
      console.error('Error handling Telegram message:', error);
      ctx.reply('❌ Error processing response');
    }
  });

  // Start bot with retry logic
  const launchWithRetry = async (maxRetries = 3, delayMs = 5000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await bot.launch({
          dropPendingUpdates: true // Ignore old updates on restart
        });
        console.log('✓ Telegram bot started successfully');
        return;
      } catch (err) {
        console.error(`Telegram bot launch attempt ${attempt}/${maxRetries} failed:`, err.message);

        if (attempt < maxRetries) {
          const delay = delayMs * attempt; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ Failed to start Telegram bot after all retries');
          console.warn('Continuing without Telegram notifications...');
        }
      }
    }
  };

  launchWithRetry();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

/**
 * Send escalation notification to Telegram group
 * @param {Object} escalation - Escalation record
 * @param {string} query - User query
 * @param {Object} employee - Employee information
 * @param {Object} aiResponse - AI response object with answer and metadata
 * @param {Array} conversationHistory - Recent conversation messages for contact extraction
 * @param {string} schemaName - Schema name for multi-tenant routing (optional)
 */
export async function notifyTelegramEscalation(escalation, query, employee, aiResponse, conversationHistory = [], schemaName = null) {
  if (!bot || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured - escalation not sent');
    return;
  }

  try {
    const context = escalation.context || {};
    const knowledgeMatch = context.knowledgeMatch || {};

    // Format escalation reason
    let reasonEmoji = '⚠️';
    let reasonText = 'Unknown reason';

    if (context.reason === 'no_knowledge_found') {
      reasonEmoji = '❌';
      reasonText = 'No Knowledge Base Match';
    } else if (context.reason === 'poor_knowledge_match') {
      reasonEmoji = '⚠️';
      reasonText = 'Poor Knowledge Match';
    } else if (context.reason === 'low_confidence') {
      reasonEmoji = '🤔';
      reasonText = 'Low Confidence Response';
    }

    // Format knowledge source status
    let sourceStatus = 'None found';
    if (knowledgeMatch.matchCount > 0) {
      sourceStatus = `${knowledgeMatch.matchCount} source${knowledgeMatch.matchCount > 1 ? 's' : ''} - ${(knowledgeMatch.bestMatch * 100).toFixed(0)}% relevance`;
    } else if (knowledgeMatch.bestMatch) {
      sourceStatus = `Found but below threshold - ${(knowledgeMatch.bestMatch * 100).toFixed(0)}% relevance`;
    }

    // Extract contact information from conversation
    const extractedContact = extractContactInfo(conversationHistory);

    // Format contact information
    const registeredEmail = employee.email || 'Not available';

    let chatContact = 'Not provided';
    if (extractedContact.found) {
      const contactParts = [];
      if (extractedContact.emails.length > 0) {
        contactParts.push(`📧 ${extractedContact.emails.join(', ')}`);
      }
      if (extractedContact.phones.length > 0) {
        contactParts.push(`📱 ${extractedContact.phones.join(', ')}`);
      }
      chatContact = contactParts.join(' | ');
    }

    // Truncate AI response if too long
    const aiAnswer = context.aiResponse || 'No response generated';
    const truncatedAnswer = aiAnswer.length > 500
      ? aiAnswer.substring(0, 500) + '...'
      : aiAnswer;

    const message = `
🔔 <b>New Escalation</b>

<b>Employee:</b> ${employee.name}
<b>Policy:</b> ${employee.policy_type} | <b>Coverage:</b> $${employee.coverage_limit}

📧 <b>Registered Email:</b> ${registeredEmail}
💬 <b>Contact from Chat:</b> ${chatContact}

<b>Question:</b>
${query}

🤖 <b>AI Response:</b>
${truncatedAnswer}

📊 <b>Status:</b> ${reasonEmoji} ${reasonText}
<b>Knowledge Sources:</b> ${sourceStatus}

<i>[Escalation: ${escalation.id}${schemaName ? `|Schema: ${schemaName}` : ''}]</i>

✅ Reply <b>"correct"</b> if AI response is good
📝 Reply with <b>better answer</b> to teach the bot
⏭️ Reply <b>"skip"</b> to mark as reviewed
    `.trim();

    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML'
    });

    // Update escalation with Telegram message ID
    // Note: We can't get message_id without additional setup, but we track the escalation ID
    console.log(`✓ Escalation ${escalation.id} sent to Telegram`);
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

/**
 * Send notification when contact information is provided
 * @param {string} escalationId - Escalation ID
 * @param {string} contactInfo - Contact information provided
 * @param {Object} employee - Employee information
 */
export async function notifyContactProvided(escalationId, contactInfo, employee) {
  if (!bot || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const message = `
📞 <b>Contact Information Provided</b>

<b>Employee:</b> ${employee.name}
<b>Policy:</b> ${employee.policy_type} | <b>Coverage:</b> $${employee.coverage_limit}

💬 <b>Contact Provided:</b> ${contactInfo}

<i>[Escalation: ${escalationId}]</i>

ℹ️ The team can now follow up with the employee using this contact information.
    `.trim();

    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML'
    });

    console.log(`✓ Contact update for escalation ${escalationId} sent to Telegram`);
  } catch (error) {
    console.error('Error sending contact notification:', error);
  }
}

/**
 * Send notification about resolved escalation
 * @param {string} escalationId - Escalation ID
 * @param {string} resolution - Resolution text
 */
export async function notifyEscalationResolved(escalationId, resolution) {
  if (!bot || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const message = `
✅ <b>Escalation Resolved</b>

<b>ID:</b> ${escalationId.substring(0, 8)}
<b>Resolution:</b> ${resolution.substring(0, 200)}...

The bot has learned from this interaction!
    `.trim();

    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Error sending resolution notification:', error);
  }
}

export default {
  initializeTelegramBot,
  notifyTelegramEscalation,
  notifyContactProvided,
  notifyEscalationResolved
};
