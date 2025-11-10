import { create } from 'zustand';
import axios from 'axios';

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

  // New state for LOG request feature
  attachments: [],
  logRequested: false,
  uploadingAttachment: false,
  userEmail: '', // User's email for acknowledgment
  showEmailInput: false, // Whether to show email input field
  isLogMode: false, // Track if user is in LOG request mode

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
      isLogMode: false
    });
  },

  createSession: async (employeeId) => {
    const { apiUrl, domain: domainOverride } = get();
    set({ isLoading: true, error: null });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      const response = await axios.post(`${apiUrl}/api/chat/session`, {
        employeeId,
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

        console.log('[ChatStore] Session created - Employee email:', employee.email);

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
      id: Date.now().toString(),
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
          id: (Date.now() + 1).toString(),
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
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';

      // Add error message
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
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
      alert('Failed to upload file. Please try again.');
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
  enterLogMode: () => {
    const { employeeEmail, messages } = get();

    console.log('[ChatStore] Entering LOG mode - Employee email from state:', employeeEmail);

    // Auto-populate email if available from employee database
    const autoEmail = employeeEmail || '';

    console.log('[ChatStore] Auto-populating email field with:', autoEmail);

    // Create the bot message with document requirements
    const botMessage = {
      id: `assistant-log-${Date.now()}`,
      role: 'assistant',
      content: `For LOG request, you may attached the following documents:
- Financial care cost form or
- Pre-admission hospital form

Alternatively, you may provide the following information:
- Date of Admission:
- Name of Hospital:
- Medical Condition:`,
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
    const { sessionId, attachments, logRequested, userEmail, apiUrl, domain: domainOverride } = get();

    if (logRequested) {
      console.log('LOG already requested for this conversation');
      return;
    }

    set({ isLoading: true });

    // Use domain override if provided, otherwise extract from current page URL
    const domain = domainOverride || window.location.hostname;

    try {
      const response = await axios.post(`${apiUrl}/api/chat/request-log`, {
        sessionId,
        message: message || 'User requested LOG via button',
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
            role: 'assistant',
            content: `✅ Your LOG request has been sent to our support team. They will review your conversation and get back to you shortly.${emailConfirmation}`,
            timestamp: new Date().toISOString()
          }]
        }));

        console.log('LOG request sent successfully');
      }
    } catch (error) {
      console.error('Error requesting LOG:', error);
      alert('Failed to send LOG request. Please try again.');
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

      console.log('Instant answer saved to chat history');
    } catch (error) {
      console.error('Error saving instant answer:', error);
      // Don't show error to user - this is a background operation
    }
  }
}));
