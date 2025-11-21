import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, HelpCircle, LogOut, X } from 'lucide-react';
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
    <motion.div
      className="ic-rounded-2xl ic-shadow-soft-lg ic-w-full sm:ic-w-[450px] ic-max-w-[95vw] ic-h-[85vh] sm:ic-h-[650px] ic-max-h-[85vh] sm:ic-max-h-[650px] ic-flex ic-flex-col ic-overflow-hidden ic-border ic-transition-colors"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)'
      }}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
    >
      {/* Header with Glass Morphism */}
      <motion.div
        className="ic-p-4 ic-text-white ic-relative ic-backdrop-blur-md"
        style={{
          background: 'var(--gradient-primary)',
          borderRadius: '1rem 1rem 0 0'
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="ic-flex ic-items-center ic-justify-between">
          <div className="ic-flex ic-items-center ic-gap-3">
            <motion.div
              className="ic-w-10 ic-h-10 ic-bg-white/20 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-backdrop-blur-sm ic-border ic-border-white/30"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <User className="ic-w-5 ic-h-5" strokeWidth={2} />
            </motion.div>
            <div>
              <h3 className="ic-text-sm ic-font-semibold ic-tracking-wide">
                Welcome, {employeeName}
              </h3>
            </div>
          </div>

          {/* Action Buttons - Optimized for mobile touch targets */}
          <div className="ic-flex ic-items-center ic-gap-1">
            <motion.button
              onClick={toggleQuickQuestions}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 sm:ic-p-2 ic-min-w-[44px] ic-min-h-[44px] sm:ic-min-w-0 sm:ic-min-h-0 ic-flex ic-items-center ic-justify-center ic-transition-colors ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-white/50"
              title={showQuickQuestions ? "Hide Quick Questions" : "Show Quick Questions"}
              aria-label={showQuickQuestions ? "Hide Quick Questions" : "Show Quick Questions"}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <HelpCircle className="ic-w-5 ic-h-5" strokeWidth={2} />
            </motion.button>

            <motion.button
              onClick={onLogout}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 sm:ic-p-2 ic-min-w-[44px] ic-min-h-[44px] sm:ic-min-w-0 sm:ic-min-h-0 ic-flex ic-items-center ic-justify-center ic-transition-colors ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-white/50"
              title="Logout"
              aria-label="Logout"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="ic-w-5 ic-h-5" strokeWidth={2} />
            </motion.button>

            <motion.button
              onClick={onClose}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 sm:ic-p-2 ic-min-w-[44px] ic-min-h-[44px] sm:ic-min-w-0 sm:ic-min-h-0 ic-flex ic-items-center ic-justify-center ic-transition-colors ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-white/50"
              aria-label="Close chat window"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="ic-w-5 ic-h-5" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </motion.div>

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
    </motion.div>
  );
}
