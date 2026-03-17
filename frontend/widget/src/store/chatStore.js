import { create } from 'zustand';
import axios from 'axios';

// Shared helpers for domain resolution and headers
const getDomain = (state) => state.domain || window.location.hostname;
const getHeaders = (state, contentType = 'application/json') => ({
  ...(contentType && { 'Content-Type': contentType }),
  'X-Widget-Domain': getDomain(state)
});

export const useChatStore = create((set, get) => ({
  // State
  apiUrl: '',
  domain: null, // Optional domain override
  sessionId: null,
  employeeId: null,
  employeeName: '',
  employeeEmail: null, // Store employee email from database
  messages: [],
  isLoading: false,
  error: null,

  // Company widget feature flags
  companyFeatures: { showChat: true, showLog: true },
  logKeywords: null, // Per-company LOG trigger keywords (null = use hardcoded defaults)
  logConfig: null, // Per-company LOG route configuration

  // New state for LOG request feature
  attachments: [],
  logRequested: false,
  uploadingAttachment: false,
  userEmail: '', // User's email for acknowledgment
  showEmailInput: false, // Whether to show email input field
  isLogMode: false, // Track if user is in LOG request mode
  uploadError: null, // Error from file upload
  logError: null, // Error from LOG request

  // Actions
  initialize: (apiUrl, domain = null) => {
    set({ apiUrl, domain });
  },

  reset: () => {
    set({
      sessionId: null,
      employeeId: null,
      employeeName: '',
      employeeEmail: null,
      messages: [],
      isLoading: false,
      error: null,
      attachments: [],
      logRequested: false,
      userEmail: '',
      showEmailInput: false,
      isLogMode: false,
      uploadError: null,
      logError: null,
      companyFeatures: { showChat: true, showLog: true },
      logConfig: null
    });
  },

  fetchConfig: async () => {
    const state = get();
    try {
      const response = await axios.get(`${state.apiUrl}/api/chat/config`, {
        headers: getHeaders(state)
      });
      if (response.data.success) {
        set({
          companyFeatures: response.data.data.features,
          logKeywords: response.data.data.logKeywords || null,
          logConfig: response.data.data.logConfig || null
        });
      }
    } catch (e) {
      // Keep defaults on network error
    }
  },

  createSession: async (identifier) => {
    const { apiUrl, domain: domainOverride } = get();
    set({ isLoading: true, error: null });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      // Send single identifier - backend will try it against all columns
      const response = await axios.post(`${apiUrl}/api/chat/session`, {
        identifier,
        metadata: {
          source: 'widget',
          timestamp: new Date().toISOString()
        }
      }, {
        headers: {
          'X-Widget-Domain': domain
        }
      });

      if (response.data.success) {
        const { sessionId, conversationId, employee } = response.data.data;


        set({
          sessionId,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email || null,
          messages: [],
          isLoading: false
        });

        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to create session');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create session';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  sendMessage: async (message) => {
    const { apiUrl, sessionId, messages, domain: domainOverride } = get();

    if (!sessionId) {
      throw new Error('No active session');
    }

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    // Add user message immediately
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    set({
      messages: [...messages, userMessage],
      isLoading: true,
      error: null
    });

    try {
      const response = await axios.post(`${apiUrl}/api/chat/message`, {
        sessionId,
        message
      }, {
        headers: {
          'X-Widget-Domain': domain
        }
      });

      if (response.data.success) {
        const { answer, confidence, sources, escalated } = response.data.data;

        // Add AI response
        const aiMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          confidence,
          sources,
          escalated,
          timestamp: new Date().toISOString()
        };

        set({
          messages: [...get().messages, aiMessage],
          isLoading: false
        });

        return aiMessage;
      } else {
        throw new Error(response.data.error || 'Failed to send message');
      }
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';

      // Session expired — reset to login so user can start fresh
      if (statusCode === 404 || errorMessage.toLowerCase().includes('session not found') || errorMessage.toLowerCase().includes('session')) {
        set({ isLoading: false });
        get().reset();
        return;
      }

      // Map error codes to user-friendly messages
      let displayMessage;
      if (statusCode === 429) {
        displayMessage = "You're sending messages too quickly. Please wait a moment and try again.";
      } else if (statusCode >= 500) {
        displayMessage = "Something went wrong on our end. Please try again in a moment.";
      } else {
        displayMessage = "Unable to send your message. Please try again.";
      }

      const errorMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: displayMessage,
        isError: true,
        timestamp: new Date().toISOString()
      };

      set({
        messages: [...get().messages, errorMsg],
        error: errorMessage,
        isLoading: false
      });

      throw new Error(errorMessage);
    }
  },

  loadHistory: async (conversationId) => {
    const { apiUrl, domain: domainOverride } = get();
    set({ isLoading: true, error: null });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      const response = await axios.get(`${apiUrl}/api/chat/history/${conversationId}?limit=50`, {
        headers: {
          'X-Widget-Domain': domain
        }
      });

      if (response.data.success) {
        const history = response.data.data.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at
        }));

        set({
          messages: history,
          isLoading: false
        });

        return history;
      } else {
        throw new Error(response.data.error || 'Failed to load history');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load history';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Add attachment
  addAttachment: async (file) => {
    const { sessionId, attachments, apiUrl, domain: domainOverride } = get();

    if (attachments.length >= 5) {
      console.error('Maximum 5 attachments allowed');
      return;
    }

    set({ uploadingAttachment: true });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await axios.post(`${apiUrl}/api/chat/upload-attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Widget-Domain': domain
        }
      });

      if (response.data.success) {
        // Add uploaded file to attachments
        set(state => ({
          attachments: [...state.attachments, {
            ...response.data.data,
            file: file // Keep original file object for display
          }]
        }));
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
      set({ uploadError: 'Failed to upload file. Please try again.' });
    } finally {
      set({ uploadingAttachment: false });
    }
  },

  // Remove attachment
  removeAttachment: (index) => {
    set(state => ({
      attachments: state.attachments.filter((_, i) => i !== index)
    }));
  },

  // Clear all attachments
  clearAttachments: () => {
    set({ attachments: [] });
  },

  // Set user email
  setUserEmail: (email) => {
    set({ userEmail: email });
  },

  // Toggle email input visibility
  toggleEmailInput: (show) => {
    set({ showEmailInput: show });
  },

  // Enter LOG request mode
  enterLogMode: async () => {
    const { employeeEmail, messages, sessionId, apiUrl, domain: domainOverride } = get();


    // Auto-populate email if available from employee database
    const autoEmail = employeeEmail || '';


    // Create the bot message with document requirements
    const botMessageContent = `For LOG request, you may attached the following documents:
- Financial care cost form or
- Pre-admission hospital form

Alternatively, you may provide the following information:
- Date of Admission:
- Name of Hospital:
- Medical Condition:`;

    const botMessage = {
      id: `assistant-log-${crypto.randomUUID()}`,
      role: 'assistant',
      content: botMessageContent,
      timestamp: new Date().toISOString(),
      isSystemMessage: true
    };

    // Update state with LOG mode, email, and bot message
    set({
      isLogMode: true,
      showEmailInput: true,
      userEmail: autoEmail,
      messages: [...messages, botMessage]
    });

    // Save bot message to database
    const domain = domainOverride || window.location.hostname;
    try {
      await axios.post(`${apiUrl}/api/chat/save-system-message`, {
        sessionId,
        message: botMessageContent,
        messageType: 'log_request_prompt'
      }, {
        headers: {
          'X-Widget-Domain': domain
        }
      });
    } catch (error) {
      console.error('[ChatStore] Error saving bot message:', error);
      // Don't block the UI if saving fails
    }
  },

  // Exit LOG request mode (cancel)
  exitLogMode: () => {
    set({
      isLogMode: false,
      showEmailInput: false,
      attachments: [],
      userEmail: ''
    });
  },

  // Request LOG
  requestLog: async (message = '') => {
    const { sessionId, attachments, logRequested, userEmail, apiUrl, domain: domainOverride, messages: currentMessages } = get();

    if (logRequested) {
      return;
    }

    set({ isLoading: true });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    // Add user message to chat if they provided additional information
    const userMessageContent = message && message.trim() ? message.trim() : '';

    if (userMessageContent) {
      const userMessage = {
        id: `user-log-${crypto.randomUUID()}`,
        role: 'user',
        content: userMessageContent,
        timestamp: new Date().toISOString()
      };

      set({
        messages: [...currentMessages, userMessage]
      });
    }

    try {
      const response = await axios.post(`${apiUrl}/api/chat/request-log`, {
        sessionId,
        message: userMessageContent || 'User requested LOG via button',
        attachmentIds: attachments.map(att => att.id),
        userEmail: userEmail || null
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Domain': domain
        }
      });

      if (response.data.success) {
        const { userEmail: email } = get();

        set({
          logRequested: true,
          isLogMode: false, // Exit LOG mode after sending
          attachments: [], // Clear attachments after successful LOG request
          showEmailInput: false, // Hide email input
          userEmail: '' // Clear email for privacy
        });

        // Add system message to chat with email confirmation
        const emailConfirmation = email
          ? ` A confirmation email has been sent to ${email}.`
          : '';

        set(state => ({
          messages: [...state.messages, {
            id: `assistant-log-confirm-${crypto.randomUUID()}`,
            role: 'assistant',
            content: `✅ Your LOG request has been sent to our support team. They will review your conversation and get back to you shortly.${emailConfirmation}`,
            timestamp: new Date().toISOString()
          }]
        }));

      }
    } catch (error) {
      console.error('Error requesting LOG:', error);
      set({ logError: 'Failed to send LOG request. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Save instant answer (from quick questions) to chat history
  saveInstantAnswer: async (question, answer) => {
    const { sessionId, apiUrl, domain: domainOverride } = get();

    if (!sessionId) {
      console.warn('No active session - instant answer not saved to database');
      return;
    }

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      await axios.post(`${apiUrl}/api/chat/instant-answer`, {
        sessionId,
        question,
        answer
      }, {
        headers: {
          'X-Widget-Domain': domain
        }
      });

    } catch (error) {
      console.error('Error saving instant answer:', error);
      // Don't show error to user - this is a background operation
    }
  }
}));
