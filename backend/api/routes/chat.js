import express from 'express';
import { generateRAGResponse } from '../services/openai.js';
import { searchKnowledgeBase, getEmployeeByEmployeeId } from '../services/vectorDB.js';
import {
  createSession,
  getSession,
  saveSession,
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
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sendLogRequestEmail, sendAcknowledgmentEmail } from '../services/email.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Apply company context middleware to all chat routes
router.use(companyContextMiddleware);

const ESCALATE_ON_NO_KNOWLEDGE = process.env.ESCALATE_ON_NO_KNOWLEDGE !== 'false';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const sessionId = req.body.sessionId || 'temp';
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp', sessionId);

    // Create directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`), false);
    }
  }
});

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
          policyType: employee.policy_type,
          email: employee.email || null
        },
        company: {
          name: req.company.name
        }
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);

    // Check if it's an "Employee not found" error
    if (error.message && error.message.includes('Employee not found')) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * POST /api/chat/upload-attachment
 * Upload file attachment for LOG request
 */
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Read file immediately and store in session (for ephemeral filesystems like Render)
    const fileBuffer = await fs.readFile(req.file.path);
    const fileBase64 = fileBuffer.toString('base64');

    // Get session to store file data
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Store file data in session attachments array
    if (!session.attachments) {
      session.attachments = [];
    }

    const fileData = {
      id: req.file.filename,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      base64: fileBase64,
      uploadedAt: new Date().toISOString()
    };

    session.attachments.push(fileData);
    await saveSession(sessionId, session);

    // Delete temp file immediately after storing in session
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.error('Error deleting temp file:', unlinkError);
    }

    // Return file metadata (without base64 to reduce response size)
    res.json({
      success: true,
      data: {
        id: req.file.filename,
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

/**
 * POST /api/chat/save-system-message
 * Save system message (like LOG request prompt) to chat history
 */
router.post('/save-system-message', async (req, res) => {
  try {
    const { sessionId, message, messageType } = req.body;

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

    // Save system message to database
    const { error } = await req.supabase
      .from('chat_history')
      .insert([{
        conversation_id: session.conversationId,
        employee_id: session.employeeId,
        role: 'assistant',
        content: message,
        metadata: {
          isSystemMessage: true,
          messageType: messageType || 'system'
        }
      }]);

    if (error) {
      console.error('Error saving system message:', error);
      throw error;
    }

    // Update session activity
    await touchSession(sessionId);

    res.json({
      success: true,
      message: 'System message saved'
    });
  } catch (error) {
    console.error('Error saving system message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save system message'
    });
  }
});

/**
 * POST /api/chat/request-log
 * Request LOG (conversation history + attachments) via email
 */
router.post('/request-log', async (req, res) => {
  try {
    const { sessionId, message, attachmentIds = [], userEmail } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
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

    // Save user's message to database if provided
    if (message && message.trim() && message !== 'User requested LOG via button') {
      await req.supabase
        .from('chat_history')
        .insert([{
          conversation_id: session.conversationId,
          employee_id: session.employeeId,
          role: 'user',
          content: message,
          metadata: {
            messageType: 'log_request_details'
          }
        }]);
    }

    // Check if LOG already requested for this conversation
    const { data: existingLog } = await req.supabase
      .from('log_requests')
      .select('id')
      .eq('conversation_id', session.conversationId)
      .single();

    if (existingLog) {
      return res.status(400).json({
        success: false,
        error: 'LOG already requested for this conversation'
      });
    }

    // Get employee data
    const { data: employee, error: empError } = await req.supabase
      .from('employees')
      .select('*')
      .eq('id', session.employeeId)
      .single();

    if (empError || !employee) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve employee data'
      });
    }

    // Get full conversation history
    const { data: conversationHistory, error: histError } = await req.supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', session.conversationId)
      .order('created_at', { ascending: true });

    if (histError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve conversation history'
      });
    }

    // Process attachments from session (files are already stored as base64)
    const attachments = [];

    if (attachmentIds.length > 0 && session.attachments) {
      // Get files from session storage
      for (const fileId of attachmentIds) {
        const fileData = session.attachments.find(att => att.id === fileId);

        if (fileData) {
          // Use base64 data from session
          attachments.push({
            id: fileData.id,
            name: fileData.name,
            size: fileData.size,
            mimetype: fileData.mimetype,
            base64: fileData.base64 // Already encoded and stored in session
          });

          console.log(`Successfully retrieved attachment from session: ${fileData.name}`);
        } else {
          console.error(`Attachment ${fileId} not found in session`);
        }
      }
    }

    // Get company configuration for email settings
    const companyConfig = {
      log_request_email_to: req.company?.log_request_email_to || null,
      log_request_email_cc: req.company?.log_request_email_cc || null
    };

    console.log('[LOG Request] Company:', req.company?.name);
    console.log('[LOG Request] Email Config:', {
      to: companyConfig.log_request_email_to,
      cc: companyConfig.log_request_email_cc,
      fallback: process.env.LOG_REQUEST_EMAIL_TO
    });

    // Send email to support team
    const emailResult = await sendLogRequestEmail({
      employee,
      conversationHistory,
      conversationId: session.conversationId,
      requestType: 'button',
      requestMessage: message || 'User requested LOG via button',
      attachments,
      companyConfig
    });

    // Send acknowledgment email to user (if email provided)
    let ackResult = null;
    if (userEmail) {
      ackResult = await sendAcknowledgmentEmail({
        userEmail,
        userName: employee.name,
        conversationId: session.conversationId,
        attachmentCount: attachments.length
      });
    }

    // Save LOG request to database
    const { data: logRequest, error: logError } = await req.supabase
      .from('log_requests')
      .insert([{
        conversation_id: session.conversationId,
        employee_id: employee.id,
        request_type: 'button',
        request_message: message || 'User requested LOG via button',
        user_email: userEmail || null,
        acknowledgment_sent: ackResult?.success || false,
        acknowledgment_sent_at: ackResult?.emailSentAt || null,
        email_sent: true,
        email_sent_at: emailResult.emailSentAt,
        attachments: attachments.map(att => ({
          name: att.name,
          size: att.size,
          path: att.path
        }))
      }])
      .select()
      .single();

    if (logError) {
      console.error('Error saving LOG request:', logError);
    }

    res.json({
      success: true,
      data: {
        logRequestId: logRequest?.id,
        emailSent: true,
        attachmentCount: attachments.length,
        acknowledgmentSent: ackResult?.success || false
      }
    });

  } catch (error) {
    console.error('Error processing LOG request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process LOG request'
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

    // Get company AI settings (will be null/undefined if not configured)
    const companyAISettings = req.company?.ai_settings || null;

    // Search knowledge base (use company-specific client and settings)
    // Pass employee's policy_type for filtering to reduce token usage
    const contexts = await searchKnowledgeBase(
      message,
      req.supabase,
      companyAISettings?.top_k_results || 5,           // topK from company settings
      companyAISettings?.similarity_threshold || 0.7,  // threshold from company settings
      null,        // category
      employee.policy_type  // policyType for filtering
    );

    // Debug logging to track knowledge base matching
    console.log(`[Knowledge Search] Query: "${message}"`);
    console.log(`[Knowledge Search] Found ${contexts?.length || 0} matching contexts`);
    if (contexts && contexts.length > 0) {
      contexts.forEach((ctx, idx) => {
        console.log(`[Context ${idx + 1}] Category: ${ctx.category}, Similarity: ${ctx.similarity}, Title: ${ctx.title}`);
        console.log(`[Context ${idx + 1}] Content: ${ctx.content?.substring(0, 200)}...`);
      });
    } else {
      console.log(`[Knowledge Search] No contexts found - AI will likely escalate`);
    }

    // Get conversation history (with employee validation for security)
    const history = await getConversationHistory(session.conversationId, 10, session.employeeId);

    // Format history for OpenAI
    const formattedHistory = history.map(h => ({
      role: h.role,
      content: h.content
    }));

    // Generate RAG response with company-specific AI settings
    const response = await generateRAGResponse(
      message,
      contexts,
      employee,
      formattedHistory,
      companyAISettings  // Pass company AI settings
    );

    // Debug: Log AI response for escalation analysis
    console.log(`[AI Response] Answer preview: ${response.answer?.substring(0, 150)}...`);
    console.log(`[AI Response] Confidence: ${response.confidence}`);
    const hasEscalationPhrase = response.answer?.toLowerCase().includes('for such query, let us check back with the team');
    console.log(`[AI Response] Contains escalation phrase: ${hasEscalationPhrase}`);

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
 * POST /api/chat/instant-answer
 * Save instant answer (from quick questions) to chat history
 */
router.post('/instant-answer', async (req, res) => {
  try {
    const { sessionId, question, answer } = req.body;

    if (!sessionId || !question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, question, and answer are required'
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

    // Save messages to Redis
    await addMessageToHistory(session.conversationId, {
      role: 'user',
      content: question
    });

    await addMessageToHistory(session.conversationId, {
      role: 'assistant',
      content: answer,
      isInstantAnswer: true
    });

    // Save to database for persistence
    const messages = [
      {
        conversation_id: session.conversationId,
        employee_id: session.employeeId,
        role: 'user',
        content: question,
        metadata: { source: 'quick_question' }
      },
      {
        conversation_id: session.conversationId,
        employee_id: session.employeeId,
        role: 'assistant',
        content: answer,
        confidence_score: 1.0, // Instant answers are pre-approved
        metadata: {
          source: 'quick_question',
          isInstantAnswer: true
        }
      }
    ];

    const { error } = await req.supabase
      .from('chat_history')
      .insert(messages);

    if (error) {
      console.error('Error saving instant answer to database:', error);
      throw error;
    }

    // Update session activity
    await touchSession(sessionId);

    res.json({
      success: true,
      message: 'Instant answer saved to history'
    });
  } catch (error) {
    console.error('Error saving instant answer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save instant answer'
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

/**
 * POST /api/chat/callback-request
 * Create a callback request when user cannot login
 */
router.post('/callback-request', async (req, res) => {
  console.log('\n========== CALLBACK REQUEST START ==========');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'x-widget-domain': req.headers['x-widget-domain'],
    'user-agent': req.headers['user-agent']
  });

  try {
    const { contactNumber, employeeId } = req.body;
    const supabaseClient = req.supabaseClient;
    const company = req.company;

    console.log('Parsed data:', {
      contactNumber,
      employeeId,
      hasSupabaseClient: !!supabaseClient,
      company: company ? { id: company.id, name: company.name } : null
    });

    if (!contactNumber || !contactNumber.trim()) {
      console.log('ERROR: Contact number is required');
      return res.status(400).json({ error: 'Contact number is required' });
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-()]{8,}$/;
    if (!phoneRegex.test(contactNumber.trim())) {
      console.log('ERROR: Invalid contact number format:', contactNumber);
      return res.status(400).json({ error: 'Invalid contact number format' });
    }

    console.log('Validation passed, proceeding to insert...');

    // Create callback request record
    console.log('Attempting to insert callback request into database...');
    const { data: callbackRequest, error: insertError } = await supabaseClient
      .from('callback_requests')
      .insert({
        contact_number: contactNumber.trim(),
        employee_id: employeeId || null,
        status: 'pending',
        metadata: {
          user_agent: req.headers['user-agent'],
          ip_address: req.ip,
          company_id: company?.id
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('ERROR: Failed to insert callback request:', {
        error: insertError,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
      return res.status(500).json({ error: 'Failed to create callback request' });
    }

    console.log('Callback request created successfully:', {
      id: callbackRequest.id,
      contact_number: callbackRequest.contact_number
    });

    // Send email notification to support team
    let emailSent = false;
    let emailError = null;
    try {
      console.log('Sending email notification...');
      await sendCallbackNotificationEmail({
        callbackRequest,
        contactNumber: contactNumber.trim(),
        employeeId: employeeId || 'Not provided',
        company
      });
      emailSent = true;
      console.log('Email notification sent successfully');

      // Update callback request with email sent status
      await supabaseClient
        .from('callback_requests')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', callbackRequest.id);
    } catch (emailErr) {
      console.error('ERROR: Failed to send email notification:', {
        error: emailErr.message,
        stack: emailErr.stack
      });
      emailError = emailErr.message;

      // Update with error
      await supabaseClient
        .from('callback_requests')
        .update({
          email_error: emailError
        })
        .eq('id', callbackRequest.id);
    }

    // Send Telegram notification
    let telegramSent = false;
    let telegramError = null;
    try {
      console.log('Sending Telegram notification...');
      await sendCallbackTelegramNotification({
        callbackRequest,
        contactNumber: contactNumber.trim(),
        employeeId: employeeId || 'Not provided',
        company,
        schemaName: req.schemaName
      });
      telegramSent = true;
      console.log('Telegram notification sent successfully');

      // Update callback request with telegram sent status
      await supabaseClient
        .from('callback_requests')
        .update({
          telegram_sent: true,
          telegram_sent_at: new Date().toISOString()
        })
        .eq('id', callbackRequest.id);
    } catch (telegramErr) {
      console.error('ERROR: Failed to send Telegram notification:', {
        error: telegramErr.message,
        stack: telegramErr.stack
      });
      telegramError = telegramErr.message;

      // Update with error
      await supabaseClient
        .from('callback_requests')
        .update({
          telegram_error: telegramError
        })
        .eq('id', callbackRequest.id);
    }

    console.log('Callback request process completed. Sending response...');
    const response = {
      success: true,
      requestId: callbackRequest.id,
      emailSent,
      telegramSent,
      message: 'Callback request submitted successfully'
    };
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('========== CALLBACK REQUEST END ==========\n');

    res.json(response);
  } catch (error) {
    console.error('ERROR: Callback request failed:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    console.log('========== CALLBACK REQUEST END (ERROR) ==========\n');
    res.status(500).json({ error: 'Failed to create callback request' });
  }
});

/**
 * Send callback notification email to support team
 */
async function sendCallbackNotificationEmail(data) {
  console.log('sendCallbackNotificationEmail called with:', {
    hasCallbackRequest: !!data.callbackRequest,
    contactNumber: data.contactNumber,
    employeeId: data.employeeId,
    hasCompany: !!data.company
  });

  const { callbackRequest, contactNumber, employeeId, company } = data;

  // Import at function level to avoid circular dependencies
  const { sendLogRequestEmail } = await import('../services/email.js');

  const companyConfig = {
    log_request_email_to: company?.callback_email_to || company?.log_request_email_to,
    log_request_email_cc: company?.callback_email_cc || company?.log_request_email_cc
  };

  console.log('Email config:', companyConfig);

  // Format as if it's a LOG request but for callback
  const emailData = {
    employee: {
      name: 'Callback Request',
      employee_id: employeeId,
      policy_type: 'N/A',
      email: 'Not available',
      coverage_limit: 0
    },
    conversationHistory: [{
      role: 'user',
      content: `User requested a callback at: ${contactNumber}`,
      created_at: new Date().toISOString()
    }],
    conversationId: callbackRequest.id,
    requestType: 'button',
    requestMessage: `Callback requested - Contact number: ${contactNumber}`,
    attachments: [],
    companyConfig
  };

  console.log('Calling sendLogRequestEmail...');
  const result = await sendLogRequestEmail(emailData);
  console.log('sendLogRequestEmail completed');
  return result;
}

/**
 * Send callback notification to Telegram
 */
async function sendCallbackTelegramNotification(data) {
  console.log('sendCallbackTelegramNotification called with:', {
    hasCallbackRequest: !!data.callbackRequest,
    contactNumber: data.contactNumber,
    employeeId: data.employeeId,
    hasCompany: !!data.company,
    schemaName: data.schemaName
  });

  const { callbackRequest, contactNumber, employeeId, company, schemaName } = data;

  // Check if bot is configured
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured - callback notification not sent');
    return;
  }

  console.log('Telegram is configured, proceeding to send...');

  try {
    const { Telegraf } = await import('telegraf');
    const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    const message = `
🔔 <b>Callback Request</b>

<b>Contact Number:</b> ${contactNumber}
<b>Employee ID:</b> ${employeeId}
<b>Company:</b> ${company?.name || 'Unknown'}
<b>Status:</b> 🟡 Pending Callback

<b>Request Time:</b> ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}

<i>[Callback Request: ${callbackRequest.id}${schemaName ? `|Schema: ${schemaName}` : ''}]</i>

📞 Please contact the user within the next working day.
  `.trim();

    console.log('Sending Telegram message to chat ID:', process.env.TELEGRAM_CHAT_ID);
    await telegramBot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML'
    });

    console.log(`✓ Callback request ${callbackRequest.id} sent to Telegram`);
  } catch (error) {
    console.error('Error in sendCallbackTelegramNotification:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export default router;
