import { create } from 'zustand';
import axios from 'axios';

export const useChatStore = create((set, get) => ({
  // State
  apiUrl: '',
  sessionId: null,
  employeeId: null,
  employeeName: '',
  messages: [],
  isLoading: false,
  error: null,

  // Actions
  initialize: (apiUrl) => {
    set({ apiUrl });
  },

  reset: () => {
    set({
      sessionId: null,
      employeeId: null,
      employeeName: '',
      messages: [],
      isLoading: false,
      error: null
    });
  },

  createSession: async (employeeId) => {
    const { apiUrl } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await axios.post(`${apiUrl}/api/chat/session`, {
        employeeId,
        metadata: {
          source: 'widget',
          timestamp: new Date().toISOString()
        }
      });

      if (response.data.success) {
        const { sessionId, conversationId, employee } = response.data.data;

        set({
          sessionId,
          employeeId: employee.id,
          employeeName: employee.name,
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
    const { apiUrl, sessionId, messages } = get();

    if (!sessionId) {
      throw new Error('No active session');
    }

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
    const { apiUrl } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await axios.get(`${apiUrl}/api/chat/history/${conversationId}?limit=50`);

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
  }
}));
