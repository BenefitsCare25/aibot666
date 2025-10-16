import { Telegraf } from 'telegraf';
import supabase from '../../config/supabase.js';
import { addKnowledgeEntry } from './vectorDB.js';
import dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot;

if (TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(TELEGRAM_BOT_TOKEN);
  console.log('✓ Telegram bot initialized');
} else {
  console.warn('⚠ TELEGRAM_BOT_TOKEN not set - HITL features disabled');
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
      '1. When you receive an escalation notification, read the employee\'s question\n' +
      '2. Reply directly to that message with your answer\n' +
      '3. The system will:\n' +
      '   - Save your response to the knowledge base\n' +
      '   - Use it to answer similar questions in the future\n' +
      '   - Mark the escalation as resolved\n\n' +
      'Commands:\n' +
      '/pending - List all pending escalations\n' +
      '/stats - View escalation statistics'
    );
  });

  // Handle /pending command
  bot.command('pending', async (ctx) => {
    try {
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
      // Check if this is a reply to an escalation
      if (!ctx.message.reply_to_message) {
        return;
      }

      const replyToText = ctx.message.reply_to_message.text;
      const response = ctx.message.text;

      // Extract escalation ID from the original message
      const escalationIdMatch = replyToText.match(/\[Escalation: ([a-f0-9-]+)\]/);

      if (!escalationIdMatch) {
        return; // Not an escalation message
      }

      const escalationId = escalationIdMatch[1];

      // Get escalation details
      const { data: escalation, error: escError } = await supabase
        .from('escalations')
        .select(`
          *,
          employees (name, email, policy_type)
        `)
        .eq('id', escalationId)
        .single();

      if (escError || !escalation) {
        ctx.reply('❌ Escalation not found');
        return;
      }

      if (escalation.status !== 'pending') {
        ctx.reply('ℹ️ This escalation has already been resolved');
        return;
      }

      // Update escalation with resolution
      const { error: updateError } = await supabase
        .from('escalations')
        .update({
          status: 'resolved',
          resolution: response,
          resolved_by: ctx.from.username || ctx.from.first_name,
          resolved_at: new Date().toISOString()
        })
        .eq('id', escalationId);

      if (updateError) {
        console.error('Error updating escalation:', updateError);
        ctx.reply('❌ Error updating escalation');
        return;
      }

      // Add to knowledge base
      try {
        await addKnowledgeEntry({
          title: escalation.query.substring(0, 200),
          content: `Question: ${escalation.query}\n\nAnswer: ${response}`,
          category: 'hitl_learning',
          subcategory: escalation.employees?.policy_type || 'general',
          metadata: {
            escalation_id: escalationId,
            resolved_by: ctx.from.username || ctx.from.first_name,
            employee_policy: escalation.employees?.policy_type
          },
          source: 'hitl_learning'
        });

        // Mark as added to knowledge base
        await supabase
          .from('escalations')
          .update({ was_added_to_kb: true })
          .eq('id', escalationId);

        // Update chat history to mark as resolved
        if (escalation.message_id) {
          await supabase
            .from('chat_history')
            .update({ escalation_resolved: true })
            .eq('id', escalation.message_id);
        }

        ctx.reply(
          '✅ Response saved!\n\n' +
          '✓ Escalation marked as resolved\n' +
          '✓ Added to knowledge base\n' +
          '✓ Bot will use this for similar questions\n\n' +
          `Employee: ${escalation.employees?.name}\n` +
          `Question: ${escalation.query.substring(0, 100)}...`
        );
      } catch (kbError) {
        console.error('Error adding to knowledge base:', kbError);
        ctx.reply('⚠️ Response saved but failed to add to knowledge base');
      }
    } catch (error) {
      console.error('Error handling Telegram message:', error);
      ctx.reply('❌ Error processing response');
    }
  });

  // Start bot
  bot.launch().then(() => {
    console.log('✓ Telegram bot started successfully');
  }).catch(err => {
    console.error('Error starting Telegram bot:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

/**
 * Send escalation notification to Telegram group
 * @param {Object} escalation - Escalation record
 * @param {string} query - User query
 * @param {Object} employee - Employee information
 */
export async function notifyTelegramEscalation(escalation, query, employee) {
  if (!bot || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured - escalation not sent');
    return;
  }

  try {
    const message = `
🔔 <b>New Escalation</b>

<b>Employee:</b> ${employee.name}
<b>Policy:</b> ${employee.policy_type}
<b>Coverage:</b> $${employee.coverage_limit}

<b>Question:</b>
${query}

<b>Context:</b>
${escalation.context?.confidence ? `Confidence: ${(escalation.context.confidence * 100).toFixed(1)}%` : ''}

<i>[Escalation: ${escalation.id}]</i>

👉 Reply to this message with your answer to help the employee and teach the bot.
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
  notifyEscalationResolved
};
