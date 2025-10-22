import express from 'express';
import { generateRAGResponse } from '../services/openai.js';
import { searchKnowledgeBase, getEmployeeByEmployeeId } from '../services/vectorDB.js';
import {
  createSession,
  getSession,
  touchSession,
  addMessageToHistory,
  getConversationHistory,
  checkRateLimit,
  cacheQueryResult,
  getCachedQueryResult
} from '../utils/session.js';
import supabase from '../../config/supabase.js';
import { createHash } from 'crypto';
import { notifyTelegramEscalation, notifyContactProvided } from '../services/telegram.js';
import { companyContextMiddleware } from '../middleware/companyContext.js';

const router = express.Router();

// Apply company context middleware to all chat routes
router.use(companyContextMiddleware);

const ESCALATE_ON_NO_KNOWLEDGE = process.env.ESCALATE_ON_NO_KNOWLEDGE !== 'false';

/**
 * POST /api/chat/session
 * Create a new chat session
 */
router.post('/session', async (req, res) => {
  try {
    const { employeeId, metadata } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required'
      });
    }

    // Verify employee exists (use company-specific client)
    const employee = await getEmployeeByEmployeeId(employeeId, req.supabase);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const { sessionId, conversationId } = await createSession(employee.id, metadata);

    res.json({
      success: true,
      data: {
        sessionId,
        conversationId,
        employee: {
          id: employee.id,
          name: employee.name,
          policyType: employee.policy_type
        },
        company: {
          name: req.company.name
        }
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message are required'
      });
    }

    // Get session
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired'
      });
    }

    // Rate limiting check
    const rateLimit = await checkRateLimit(session.employeeId, 100, 60);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt
      });
    }

    // Check cache for similar queries
    const queryHash = createHash('sha256').update(message.trim().toLowerCase()).digest('hex');
    const cachedResult = await getCachedQueryResult(queryHash);

    if (cachedResult) {
      console.log('Returning cached response');
      await touchSession(sessionId);
      return res.json({
        success: true,
        data: {
          ...cachedResult,
          cached: true
        }
      });
    }

    // Get employee data (use company-specific client)
    const { data: employee, error: empError } = await req.supabase
      .from('employees')
      .select('*')
      .eq('id', session.employeeId)
      .single();

    if (empError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve employee data'
      });
    }

    // Search knowledge base (use company-specific client)
    const contexts = await searchKnowledgeBase(message, req.supabase);

    // Get conversation history
    const history = await getConversationHistory(session.conversationId);

    // Format history for OpenAI
    const formattedHistory = history.map(h => ({
      role: h.role,
      content: h.content
    }));

    // Generate RAG response
    const response = await generateRAGResponse(
      message,
      contexts,
      employee,
      formattedHistory
    );

    // Save messages to Redis
    await addMessageToHistory(session.conversationId, {
      role: 'user',
      content: message
    });

    await addMessageToHistory(session.conversationId, {
      role: 'assistant',
      content: response.answer,
      confidence: response.confidence,
      sources: response.sources
    });

    // Save to database for persistence (use company-specific client)
    await saveMessageToDB(session, message, response, employee.id, req.supabase);

    // Update session activity
    await touchSession(sessionId);

    // Check if escalation is needed based on configuration
    let escalated = false;
    let escalationReason = null;

    // Check if AI explicitly says it cannot answer (uses the exact template phrase)
    const aiSaysNoKnowledge = response.answer &&
      response.answer.toLowerCase().includes('for such query, let us check back with the team');

    // Escalate ONLY when AI explicitly cannot answer
    // If AI gave a real answer, it means it found data in Supabase (employee table or knowledge_base)
    // Do NOT escalate based on knowledgeMatch.status alone - AI can answer using employee data
    if (ESCALATE_ON_NO_KNOWLEDGE && aiSaysNoKnowledge) {
      escalated = true;
      escalationReason = 'ai_unable_to_answer';
    }

    if (escalated) {
      await handleEscalation(session, message, response, employee, escalationReason, req.supabase, req.company.schemaName);
    }

    // Cache the result if confidence is high
    if (response.confidence >= 0.8) {
      await cacheQueryResult(queryHash, {
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources
      }, 300);
    }

    res.json({
      success: true,
      data: {
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources,
        escalated,
        sessionId,
        conversationId: session.conversationId
      }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Get conversation history
 */
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 20 } = req.query;

    // Use company-specific client
    const { data, error } = await req.supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        conversationId,
        messages: data
      }
    });
  } catch (error) {
    console.error('Error retrieving history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation history'
    });
  }
});

/**
 * DELETE /api/chat/session/:sessionId
 * End a chat session
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Session will be deleted automatically, but we can explicitly delete it
    // The data is already persisted in the database

    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

/**
 * GET /api/chat/status
 * Get chatbot status and metrics
 */
router.get('/status', async (req, res) => {
  try {
    // This would include metrics like active sessions, uptime, etc.
    res.json({
      success: true,
      data: {
        status: 'operational',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
});

/**
 * Helper: Save message to database
 */
async function saveMessageToDB(session, userMessage, aiResponse, employeeId, supabaseClient) {
  try {
    const messages = [
      {
        conversation_id: session.conversationId,
        employee_id: employeeId,
        role: 'user',
        content: userMessage,
        metadata: {}
      },
      {
        conversation_id: session.conversationId,
        employee_id: employeeId,
        role: 'assistant',
        content: aiResponse.answer,
        confidence_score: aiResponse.confidence,
        sources: aiResponse.sources,
        metadata: {
          model: aiResponse.model,
          tokens: aiResponse.tokens
        }
      }
    ];

    const { error } = await supabaseClient
      .from('chat_history')
      .insert(messages);

    if (error) {
      console.error('Error saving to database:', error);
    }
  } catch (error) {
    console.error('Error in saveMessageToDB:', error);
  }
}

/**
 * Helper: Detect if message contains contact information
 */
function isContactInformation(message) {
  const text = message.toLowerCase().trim();

  // Pattern: Email addresses
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

  // Pattern: Phone numbers (8+ digits, may include spaces, dashes, or parentheses)
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{6,}/;

  // Pattern: Just digits (likely a phone number if 8+ digits)
  const digitsOnly = text.replace(/[^\d]/g, '');
  const isPhoneNumber = digitsOnly.length >= 8;

  return emailPattern.test(text) || phonePattern.test(text) || isPhoneNumber;
}

/**
 * Helper: Check if there's a pending escalation for this conversation
 */
async function getPendingEscalation(conversationId, supabaseClient) {
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
 * Helper: Update existing escalation with contact information
 */
async function updateEscalationWithContact(escalationId, contactInfo, employee, supabaseClient) {
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
      console.log(`Successfully updated escalation ${escalationId} with contact: ${contactInfo}`);

      // Notify Telegram that contact information was provided
      await notifyContactProvided(escalationId, contactInfo, employee);
    }
  } catch (error) {
    console.error('Error in updateEscalationWithContact:', error);
  }
}

/**
 * Helper: Handle escalation to human support
 */
async function handleEscalation(session, query, response, employee, reason, supabaseClient, schemaName = null) {
  try {
    // Check if user is providing contact information after previous escalation
    const isContact = isContactInformation(query);
    const pendingEscalation = await getPendingEscalation(session.conversationId, supabaseClient);

    // If user is providing contact info and there's already a pending escalation,
    // update the existing escalation instead of creating a new one
    if (isContact && pendingEscalation) {
      console.log('Contact information detected for existing escalation, updating...');
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
            name: employee.name,
            policyType: employee.policy_type
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

export default router;
