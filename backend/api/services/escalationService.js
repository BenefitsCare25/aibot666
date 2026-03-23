import { notifyTelegramEscalation, notifyContactProvided } from './telegram.js';

/**
 * Detect if message contains contact information (email or phone number)
 * @param {string} message - User message to check
 * @returns {boolean} - Whether message contains contact info
 */
export function isContactInformation(message) {
  const text = message.toLowerCase().trim();

  // Pattern: Email addresses
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

  // Pattern: Phone numbers (8+ digits, may include spaces, dashes, or parentheses)
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{6,}/;

  // Pattern: Just digits (likely a phone number if 8+ digits)
  const digitsOnly = text.replace(/[^\d]/g, '');
  const isPhoneNumber = digitsOnly.length >= 8;

  // Pattern: Domain-style identifiers (e.g., sengwee.cbre.com) — no @ but looks like contact info
  const domainIdentifier = /^[a-z0-9._-]+\.[a-z0-9.-]+\.[a-z]{2,}$/i;

  return emailPattern.test(text) || phonePattern.test(text) || isPhoneNumber || domainIdentifier.test(text);
}

/**
 * Check if there's a pending escalation for a conversation
 * @param {string} conversationId - The conversation ID to check
 * @param {object} supabaseClient - Company-scoped Supabase client
 * @returns {object|null} - The pending escalation record or null
 */
export async function getPendingEscalation(conversationId, supabaseClient) {
  try {
    const { data, error } = await supabaseClient
      .from('escalations')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking pending escalation:', error);
    }

    return data || null;
  } catch (error) {
    console.error('Error in getPendingEscalation:', error);
    return null;
  }
}

/**
 * Update an existing escalation with contact information provided by the user
 * @param {string} escalationId - The escalation record ID
 * @param {string} contactInfo - The contact info message from the user
 * @param {object} employee - The employee record
 * @param {object} supabaseClient - Company-scoped Supabase client
 */
export async function updateEscalationWithContact(escalationId, contactInfo, employee, supabaseClient) {
  try {
    // First, fetch the current escalation to get the context
    const { data: currentEscalation, error: fetchError } = await supabaseClient
      .from('escalations')
      .select('context')
      .eq('id', escalationId)
      .single();

    if (fetchError || !currentEscalation) {
      console.error('Error fetching escalation for update:', fetchError);
      return;
    }

    // Update the context with contact information
    const updatedContext = {
      ...currentEscalation.context,
      contactFromChat: contactInfo
    };

    const { error } = await supabaseClient
      .from('escalations')
      .update({
        context: updatedContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', escalationId);

    if (error) {
      console.error('Error updating escalation with contact:', error);
    } else {
      // Notify Telegram that contact information was provided
      await notifyContactProvided(escalationId, contactInfo, employee);
    }
  } catch (error) {
    console.error('Error in updateEscalationWithContact:', error);
  }
}

/**
 * Handle escalation to human support - creates escalation record and notifies via Telegram
 * @param {object} session - The chat session
 * @param {string} query - The user's message
 * @param {object} response - The AI response object
 * @param {object} employee - The employee record
 * @param {string} reason - The escalation reason ('ai_escalated', legacy: 'ai_unable_to_answer', 'low_confidence')
 * @param {object} supabaseClient - Company-scoped Supabase client
 * @param {string|null} schemaName - The tenant schema name for multi-tenant routing
 */
export async function handleEscalation(session, query, response, employee, reason, supabaseClient, schemaName = null) {
  try {
    // Check if user is providing contact information after previous escalation
    const isContact = isContactInformation(query);
    const pendingEscalation = await getPendingEscalation(session.conversationId, supabaseClient);

    // If user is providing contact info and there's already a pending escalation,
    // update the existing escalation instead of creating a new one
    if (isContact && pendingEscalation) {
      await updateEscalationWithContact(pendingEscalation.id, query, employee, supabaseClient);
      return; // Don't create a new escalation
    }

    // Note: We removed the check that prevented new escalations when one is pending
    // because it prevented Telegram notifications from being sent, making the workflow
    // appear broken. Each question that needs escalation should be escalated independently.

    // Find the last assistant message ID
    const { data: lastMessage } = await supabaseClient
      .from('chat_history')
      .select('id')
      .eq('conversation_id', session.conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get recent conversation history for contact extraction (last 20 messages)
    const { data: recentMessages } = await supabaseClient
      .from('chat_history')
      .select('role, content')
      .eq('conversation_id', session.conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Create escalation record with enhanced context
    const { data: escalation, error: escError } = await supabaseClient
      .from('escalations')
      .insert([{
        conversation_id: session.conversationId,
        message_id: lastMessage?.id,
        employee_id: employee.id,
        query,
        context: {
          reason,
          aiResponse: response.answer,
          confidence: response.confidence,
          knowledgeMatch: response.knowledgeMatch,
          sources: response.sources,
          employee: {
            name: employee.name
          }
        },
        status: 'pending'
      }])
      .select()
      .single();

    if (escError) {
      console.error('Error creating escalation:', escError);
      return;
    }

    // Notify via Telegram with AI response, conversation history, and schema name for multi-tenant routing
    await notifyTelegramEscalation(escalation, query, employee, response, recentMessages || [], schemaName);

    // Mark message as escalated
    if (lastMessage) {
      await supabaseClient
        .from('chat_history')
        .update({ was_escalated: true })
        .eq('id', lastMessage.id);
    }
  } catch (error) {
    console.error('Error in handleEscalation:', error);
  }
}
