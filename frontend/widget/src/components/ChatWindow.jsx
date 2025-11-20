import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import QuickQuestions from './QuickQuestions';
import { isLogCategory } from '../utils/logDetection';

export default function ChatWindow({ onClose, onLogout, primaryColor }) {
  const {
    employeeName,
    messages,
    isLoading,
    sendMessage,
    attachments,
    addAttachment,
    removeAttachment,
    requestLog,
    logRequested,
    userEmail,
    setUserEmail,
    showEmailInput,
    toggleEmailInput,
    isLogMode,
    enterLogMode,
    exitLogMode,
    saveInstantAnswer
  } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [showQuickQuestions, setShowQuickQuestions] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuestionSelect = async (questionData, categoryTitle) => {
    setShowQuickQuestions(false);

    // Check if this is a LOG-related category - auto-trigger LOG mode
    if (categoryTitle && isLogCategory(categoryTitle)) {
      await enterLogMode();
      return;
    }

    // Check if this is a Q&A object with pre-defined answer
    if (questionData && typeof questionData === 'object' && questionData.q && questionData.a) {
      // Add user message
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: questionData.q,
        timestamp: new Date().toISOString()
      };

      // Add assistant message with instant answer
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: questionData.a,
        timestamp: new Date().toISOString(),
        isInstantAnswer: true
      };

      // Update messages in store directly
      useChatStore.setState(state => ({
        messages: [...state.messages, userMessage, assistantMessage]
      }));

      // Save to database in background
      await saveInstantAnswer(questionData.q, questionData.a);
    } else {
      // Legacy format or typed question - send to API
      const message = typeof questionData === 'string' ? questionData : questionData.q || questionData;
      setInputValue(message);

      try {
        await sendMessage(message);
      } catch (error) {
        console.error('Failed to send selected question:', error);
      }
    }
  };

  const toggleQuickQuestions = () => {
    setShowQuickQuestions(!showQuickQuestions);
  };

  const handleRequestLog = async () => {
    await requestLog(inputValue);
    setInputValue(''); // Clear input after LOG request
  };

  return (
    <div className="ic-bg-white ic-rounded-2xl ic-shadow-2xl ic-w-96 ic-h-[600px] ic-flex ic-flex-col ic-overflow-hidden ic-border ic-border-gray-100">
      {/* Header with Red Gradient */}
      <div
        className="ic-p-5 ic-text-white ic-relative"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
          borderRadius: '1rem 1rem 0 0'
        }}
      >
        <div className="ic-flex ic-items-center ic-justify-between">
          <div className="ic-flex ic-items-center ic-gap-3">
            <div className="ic-w-12 ic-h-12 ic-bg-white/20 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-backdrop-blur-sm ic-border-2 ic-border-white/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-6 ic-h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="ic-text-base ic-font-bold">{employeeName}</h3>
              <p className="ic-text-xs ic-text-white/90 ic-mt-0.5">Online</p>
            </div>
          </div>
          <div className="ic-flex ic-items-center ic-gap-1">
            <button
              onClick={toggleQuickQuestions}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 hover:ic-scale-110"
              title={showQuickQuestions ? "Hide Quick Questions" : "Show Quick Questions"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-5 ic-h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 hover:ic-scale-110"
              title="Logout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-5 ic-h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 hover:ic-scale-110"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-5 ic-h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area - Toggle between Messages and Quick Questions */}
      {showQuickQuestions ? (
        <QuickQuestions
          onQuestionSelect={handleQuestionSelect}
          primaryColor={primaryColor}
        />
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />
      )}

      {/* Input - Enhanced with attachments and email */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
        primaryColor={primaryColor}
        attachments={attachments}
        onAddAttachment={addAttachment}
        onRemoveAttachment={removeAttachment}
        onRequestLog={handleRequestLog}
        logRequested={logRequested}
        userEmail={userEmail}
        onEmailChange={setUserEmail}
        showEmailInput={showEmailInput}
        onToggleEmailInput={toggleEmailInput}
        isLogMode={isLogMode}
        onEnterLogMode={enterLogMode}
        onExitLogMode={exitLogMode}
      />
    </div>
  );
}
