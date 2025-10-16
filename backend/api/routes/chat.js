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
import { notifyTelegramEscalation } from '../services/telegram.js';

const router = express.Router();

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;

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

    // Verify employee exists
    const employee = await getEmployeeByEmployeeId(employeeId);

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

    // Get employee data
    const { data: employee, error: empError } = await supabase
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

    // Search knowledge base
    const contexts = await searchKnowledgeBase(message);

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

    // Save to database for persistence
    await saveMessageToDB(session, message, response, employee.id);

    // Update session activity
    await touchSession(sessionId);

    // Check if escalation is needed
    let escalated = false;
    if (response.confidence < CONFIDENCE_THRESHOLD) {
      escalated = true;
      await handleEscalation(session, message, response, employee);
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

    const { data, error } = await supabase
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
async function saveMessageToDB(session, userMessage, aiResponse, employeeId) {
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

    const { error } = await supabase
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
 * Helper: Handle escalation to human support
 */
async function handleEscalation(session, query, response, employee) {
  try {
    // Find the last assistant message ID
    const { data: lastMessage } = await supabase
      .from('chat_history')
      .select('id')
      .eq('conversation_id', session.conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Create escalation record
    const { data: escalation, error: escError } = await supabase
      .from('escalations')
      .insert([{
        conversation_id: session.conversationId,
        message_id: lastMessage?.id,
        employee_id: employee.id,
        query,
        context: {
          confidence: response.confidence,
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

    // Notify via Telegram
    await notifyTelegramEscalation(escalation, query, employee);

    // Mark message as escalated
    if (lastMessage) {
      await supabase
        .from('chat_history')
        .update({ was_escalated: true })
        .eq('id', lastMessage.id);
    }
  } catch (error) {
    console.error('Error in handleEscalation:', error);
  }
}

export default router;
