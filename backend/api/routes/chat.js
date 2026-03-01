import express from 'express';
import { generateRAGResponse } from '../services/openai.js';
import { searchKnowledgeBase, getEmployeeByEmployeeId, getEmployeeByIdentifier } from '../services/vectorDB.js';
import {
  createSession,
  getSession,
  saveSession,
  touchSession,
  addMessageToHistory,
  getConversationHistory,
  checkRateLimit,
  cacheQueryResult,
  getCachedQueryResult,
  updateConversationState,
  getConversationState
} from '../utils/session.js';
import supabase from '../../config/supabase.js';
import { createHash } from 'crypto';
import { notifyLogRequest } from '../services/telegram.js';
import { companyContextMiddleware } from '../middleware/companyContext.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sendLogRequestEmail, sendAcknowledgmentEmail } from '../services/email.js';
import path from 'path';
import fs from 'fs/promises';
import { groupQuestionsByCategory } from '../utils/quickQuestionUtils.js';
import { isContactInformation, handleEscalation } from '../services/escalationService.js';
import { sendCallbackNotificationEmail, sendCallbackTelegramNotification } from '../services/callbackService.js';

const router = express.Router();

// Apply company context middleware to all chat routes
router.use(companyContextMiddleware);

const ESCALATE_ON_NO_KNOWLEDGE = process.env.ESCALATE_ON_NO_KNOWLEDGE !== 'false';

// GET /api/chat/config - Return company widget feature flags
router.get('/config', (req, res) => {
  const settings = req.company?.settings || {};
  res.json({
    success: true,
    data: {
      features: {
        showChat: settings.showChat !== false,
        showLog: settings.showLog !== false
      }
    }
  });
});

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
 * Accepts identifier (tries against employeeId, userId, and email columns)
 */
router.post('/session', async (req, res) => {
  try {
    const { employeeId, userId, email, identifier, metadata } = req.body;

    // Support both new 'identifier' field and legacy separate fields
    const searchValue = identifier || employeeId || userId || email;

    if (!searchValue) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, User ID, or Email is required'
      });
    }

    // Verify employee exists using flexible lookup (use company-specific client)
    const employee = await getEmployeeByIdentifier(
      searchValue,
      req.supabase
    );

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
          email: employee.email || null,
          employeeId: employee.employee_id,
          userId: employee.user_id
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
        error: 'Employee not found. Please check your credentials.'
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

    // Validate file magic bytes
    const { validateFileMagicBytes } = await import('../utils/fileValidation.js');
    const fileValidation = await validateFileMagicBytes(req.file.path, req.file.mimetype);
    if (!fileValidation.valid) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: fileValidation.reason || 'Invalid file type'
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

    // Clear uploaded attachments from session (free Redis memory after email sent)
    if (attachmentIds.length > 0 && session.attachments) {
      session.attachments = session.attachments.filter(att => !attachmentIds.includes(att.id));
      await saveSession(sessionId, session);
    }

    // Send Telegram notification
    if (logRequest?.id) {
      await notifyLogRequest({
        employee,
        requestType: 'button',
        requestMessage: message || 'User requested LOG via button',
        conversationId: session.conversationId,
        attachmentCount: attachments.length,
        companyName: req.company?.name || 'Unknown Company',
        logRequestId: logRequest.id
      });
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
 * POST /api/chat/anonymous-log-request
 * Submit a LOG request without requiring an active session
 * Accepts email (required), description (optional), and employeeId (optional)
 */
router.post('/anonymous-log-request', async (req, res) => {
  try {
    const { email, description, employeeId, attachments = [] } = req.body;
    const supabaseClient = req.supabase;
    const company = req.company;

    // Validate required fields
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Try to find employee if employeeId is provided
    let employee = null;
    if (employeeId && employeeId.trim()) {
      const { data: empData } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('employee_id', employeeId.trim())
        .single();

      employee = empData;
    }

    // Store anonymous LOG request in database
    const { data: logRequest, error: insertError } = await supabaseClient
      .from('log_requests')
      .insert({
        conversation_id: null, // No conversation for anonymous requests
        employee_id: employee?.id || null,
        request_type: 'anonymous',
        request_message: description?.trim() || 'Anonymous LOG request submitted via widget',
        user_email: email.trim(),
        acknowledgment_sent: false,
        email_sent: false,
        attachments: attachments.map(att => ({
          name: att.name,
          size: att.size,
          mimetype: att.mimetype
        })),
        metadata: {
          user_agent: req.headers['user-agent'],
          ip_address: req.ip,
          company_id: company?.id,
          employee_identifier: employeeId?.trim() || null
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert anonymous LOG request:', insertError);
      return res.status(500).json({ error: 'Failed to create LOG request' });
    }

    // Send email notification to support team
    let emailSent = false;
    let ackSent = false;

    try {
      const companyConfig = {
        log_request_email_to: company?.log_request_email_to || null,
        log_request_email_cc: company?.log_request_email_cc || null
      };


      // Send email to support team
      await sendLogRequestEmail({
        employee: employee || {
          name: 'Anonymous User',
          email: email.trim(),
          employee_id: employeeId?.trim() || 'Not provided'
        },
        conversationHistory: [],
        conversationId: logRequest.id, // Use LOG request ID as reference
        requestType: 'anonymous',
        requestMessage: description?.trim() || 'Anonymous LOG request submitted via widget',
        attachments: attachments, // Pass base64-encoded attachments from frontend
        companyConfig
      });

      emailSent = true;

      // Send acknowledgment email to user
      await sendAcknowledgmentEmail({
        userEmail: email.trim(),
        userName: employee?.name || 'User',
        conversationId: logRequest.id,
        attachmentCount: attachments.length
      });

      ackSent = true;

      // Update log request with email status
      await supabaseClient
        .from('log_requests')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          acknowledgment_sent: true,
          acknowledgment_sent_at: new Date().toISOString()
        })
        .eq('id', logRequest.id);

      // Send Telegram notification for anonymous LOG request
      await notifyLogRequest({
        employee: employee || {
          name: 'Anonymous User',
          email: email.trim(),
          employee_id: employeeId?.trim() || 'Not provided'
        },
        requestType: 'anonymous',
        requestMessage: description?.trim() || 'Anonymous LOG request submitted via widget',
        conversationId: null,
        attachmentCount: attachments.length,
        companyName: company?.name || 'Unknown Company',
        logRequestId: logRequest.id
      });

    } catch (emailErr) {
      console.error('Failed to send LOG request email:', emailErr);

      // Update with error
      await supabaseClient
        .from('log_requests')
        .update({
          metadata: {
            ...logRequest.metadata,
            email_error: emailErr.message
          }
        })
        .eq('id', logRequest.id);
    }

    res.json({
      success: true,
      data: {
        logRequestId: logRequest.id,
        emailSent,
        acknowledgmentSent: ackSent
      }
    });

  } catch (error) {
    console.error('Error processing anonymous LOG request:', error);
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

    // Classify intent to determine if KB search is needed
    const messageIntent = classifyMessageIntent(message);
    const needsKBSearch = messageIntent === 'domain_question';

    // Search knowledge base only for domain questions
    const contexts = needsKBSearch
      ? await searchKnowledgeBase(
          message,
          req.supabase,
          companyAISettings?.top_k_results || 5,
          companyAISettings?.similarity_threshold || 0.7,
          null
        )
      : [];

    // Additional context logging after search
    if (contexts && contexts.length > 0) {
      contexts.forEach((ctx, idx) => {
      });
    } else {
    }

    // Get conversation history (with employee validation for security)
    const history = await getConversationHistory(session.conversationId, 10, session.employeeId);

    // Format history for OpenAI
    const formattedHistory = history.map(h => ({
      role: h.role,
      content: h.content
    }));


    // Pre-process: Check if user is responding to escalation with contact info
    let messageToProcess = message;
    const conversationState = await getConversationState(sessionId);
    const lastAssistantMsg = formattedHistory
      .filter(m => m.role === 'assistant')
      .slice(-1)[0];

    const wasEscalation = lastAssistantMsg?.content
      ?.toLowerCase()
      .includes('check back with the team');

    const isContactInfo = isContactInformation(message);
    const awaitingContact = conversationState?.awaitingContactInfo === true;

    if ((wasEscalation || awaitingContact) && isContactInfo) {
      // Inject context hint to help AI understand this is a contact info response
      messageToProcess = `[User is providing contact information in response to escalation request] ${message}`;

      // Clear the awaiting contact info state
      if (awaitingContact) {
        await updateConversationState(sessionId, {
          awaitingContactInfo: false,
          lastBotAction: 'received_contact_info',
          contactReceivedAt: new Date().toISOString()
        });
      }
    }


    // Generate RAG response with company-specific AI settings
    const response = await generateRAGResponse(
      messageToProcess,
      contexts,
      employee,
      formattedHistory,
      companyAISettings  // Pass company AI settings
    );

    // Greetings/conversational messages are always handled correctly — override low base confidence
    if (messageIntent !== 'domain_question') {
      response.confidence = 0.9;
    }

    const hasEscalationPhrase = response.answer?.toLowerCase().includes('for such query, let us check back with the team');

    // Save messages to Redis (sequential - order matters in Redis list)
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

    // Parallelize post-response ops (DB save + session touch + cache are independent)
    await Promise.all([
      saveMessageToDB(session, message, response, employee.id, req.supabase),
      touchSession(sessionId)
    ]);

    // Check if escalation is needed based on configuration
    let escalated = false;
    let escalationReason = null;


    // Get escalation threshold from company settings (default 0.55)
    // Base confidence when KB has no results is 0.5 — threshold must exceed 0.5 to catch no-context cases
    const escalationThreshold = companyAISettings?.escalation_threshold ?? 0.55;

    // Check if AI explicitly says it cannot answer — detect both the exact template phrase
    // and common deviations where the AI improvises its own escalation wording
    const cleanAnswer = response.answer ? response.answer.replace(/[*_]/g, '') : '';
    const cleanLower = cleanAnswer.toLowerCase();
    const aiSaysNoKnowledge =
      cleanLower.includes('for such query, let us check back with the team') ||
      (cleanLower.includes('escalate') && cleanLower.includes('contact')) ||
      (cleanLower.includes('specific details of your policy') && cleanLower.includes('contact'));

    // Check if confidence is strictly below threshold (< not <=, to avoid escalating on-threshold responses)
    const lowConfidence = response.confidence < escalationThreshold;

    // Escalate if:
    // 1. This is a domain question (not a greeting/conversational message), AND
    // 2. AI explicitly cannot answer (uses escalation phrase), OR confidence is below threshold
    if (needsKBSearch && ESCALATE_ON_NO_KNOWLEDGE && (aiSaysNoKnowledge || lowConfidence)) {
      escalated = true;
      escalationReason = aiSaysNoKnowledge ? 'ai_unable_to_answer' : 'low_confidence';

    } else {
    }

    if (escalated) {
      await handleEscalation(session, message, response, employee, escalationReason, req.supabase, req.company.schemaName);

      // Update conversation state to track escalation
      await updateConversationState(sessionId, {
        lastBotAction: 'escalated',
        awaitingContactInfo: true,
        escalationTimestamp: new Date().toISOString(),
        escalationReason
      });
    }

    // Cache the result if confidence is high
    if (response.confidence >= 0.8) {
      await cacheQueryResult(queryHash, {
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources
      }, 300);
    }

    // Final summary log

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
    const { limit = 20, sessionId } = req.query;

    // Require sessionId for authentication
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Validate session owns this conversation
    const session = await getSession(sessionId);
    if (!session || session.conversationId !== conversationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    const cappedLimit = Math.min(parseInt(limit) || 20, 100);

    // Use company-specific client
    const { data, error } = await req.supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(cappedLimit);

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
 * GET /api/chat/validate-session
 * Lightweight session validation (for widget reconnection)
 */
router.get('/validate-session', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.json({ success: true, valid: false });
    }
    const session = await getSession(sessionId);
    res.json({ success: true, valid: !!session });
  } catch (error) {
    res.json({ success: true, valid: false });
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
 * Helper: Classify message intent to determine if KB search is needed
 * Returns 'greeting' | 'conversational' | 'domain_question'
 */
function classifyMessageIntent(message) {
  const msg = message.trim();
  const greetingPattern = /^(hi+|hello+|hey+|good (morning|afternoon|evening|day)|howdy|greetings|sup|yo|what'?s up|how are you|how r u|你好|早上好|下午好|晚上好|嗨|喂)\W*$/i;
  const conversationalPattern = /^(ok|okay|got it|i see|sure|alright|understood|noted|cool|great|sounds good|perfect|thanks|thank you|ty|thx|no problem|np|bye|goodbye|see you|take care|谢谢|好的|明白)\W*$/i;

  if (greetingPattern.test(msg)) return 'greeting';
  if (conversationalPattern.test(msg)) return 'conversational';
  return 'domain_question';
}

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
 * POST /api/chat/callback-request
 * Create a callback request when user cannot login
 * Accepts employeeId, userId, or email for identification
 */
router.post('/callback-request', async (req, res) => {
  try {
    const { contactNumber, employeeId, userId, email } = req.body;
    const supabaseClient = req.supabaseClient;
    const company = req.company;

    if (!contactNumber || !contactNumber.trim()) {
      return res.status(400).json({ error: 'Contact number is required' });
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-()]{8,}$/;
    if (!phoneRegex.test(contactNumber.trim())) {
      return res.status(400).json({ error: 'Invalid contact number format' });
    }

    // Store the identifier that was provided (for reference)
    const identifierUsed = employeeId || userId || email || 'Not provided';
    const identifierType = employeeId ? 'employee_id' : (userId ? 'user_id' : (email ? 'email' : 'none'));

    // Create callback request record
    const { data: callbackRequest, error: insertError } = await supabaseClient
      .from('callback_requests')
      .insert({
        contact_number: contactNumber.trim(),
        employee_id: identifierUsed,
        status: 'pending',
        metadata: {
          user_agent: req.headers['user-agent'],
          ip_address: req.ip,
          company_id: company?.id,
          identifier_type: identifierType,
          identifier_value: identifierUsed
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert callback request:', insertError);
      return res.status(500).json({ error: 'Failed to create callback request' });
    }

    // Send email notification to support team
    let emailSent = false;
    let emailError = null;
    try {
      await sendCallbackNotificationEmail({
        callbackRequest,
        contactNumber: contactNumber.trim(),
        employeeId: identifierUsed,
        identifierType: identifierType,
        company
      });
      emailSent = true;

      // Update callback request with email sent status
      await supabaseClient
        .from('callback_requests')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', callbackRequest.id);
    } catch (emailErr) {
      console.error('Failed to send callback email notification:', emailErr);
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
      await sendCallbackTelegramNotification({
        callbackRequest,
        contactNumber: contactNumber.trim(),
        employeeId: identifierUsed,
        identifierType: identifierType,
        company,
        schemaName: req.schemaName
      });
      telegramSent = true;

      // Update callback request with telegram sent status
      await supabaseClient
        .from('callback_requests')
        .update({
          telegram_sent: true,
          telegram_sent_at: new Date().toISOString()
        })
        .eq('id', callbackRequest.id);
    } catch (telegramErr) {
      console.error('Failed to send callback Telegram notification:', telegramErr);
      telegramError = telegramErr.message;

      // Update with error
      await supabaseClient
        .from('callback_requests')
        .update({
          telegram_error: telegramError
        })
        .eq('id', callbackRequest.id);
    }

    res.json({
      success: true,
      requestId: callbackRequest.id,
      emailSent,
      telegramSent,
      message: 'Callback request submitted successfully'
    });
  } catch (error) {
    console.error('Callback request failed:', error);
    res.status(500).json({ error: 'Failed to create callback request' });
  }
});

/**
 * GET /api/chat/quick-questions
 * Get active quick questions for chatbot widget (public, no auth required)
 */
router.get('/quick-questions', async (req, res) => {
  try {
    const schemaName = req.company?.schemaName;

    if (!schemaName) {
      return res.status(400).json({
        success: false,
        error: 'Company schema not found. Please ensure the domain is configured correctly.'
      });
    }


    // Use RPC function to query quick questions without requiring authentication
    const { data: questions, error } = await supabase
      .rpc('get_quick_questions_by_schema', { schema_name: schemaName });

    if (error) {
      console.error('[Quick Questions] Error fetching:', error);
      throw error;
    }


    res.json({
      success: true,
      data: groupQuestionsByCategory(questions)
    });
  } catch (error) {
    console.error('[Quick Questions] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quick questions',
      details: error.message
    });
  }
});

export default router;
