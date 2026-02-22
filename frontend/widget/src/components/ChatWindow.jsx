import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, HelpCircle, LogOut, X, ChevronDown } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import QuickQuestions from './QuickQuestions';
import { isLogCategory } from '../utils/logDetection';

export default function ChatWindow({ onClose, onLogout, primaryColor, isEmbedded = false, isMobileFullScreen = false, isInIframe = false }) {
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

  // Container styles - inline for reliability
  const containerStyle = isMobileFullScreen
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }
    : isEmbedded
      ? {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#ffffff'
        }
      : isInIframe
        ? {
            // In iframe: let content flow naturally for proper height measurement
            // The iframe itself handles sizing via postMessage resize
            width: '100%',
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(231, 76, 94, 0.16)',
            border: '1px solid #e5e5e5'
            // Note: NO maxHeight, NO overflow:hidden - allows scrollHeight measurement
          }
        : {
            width: '100%',
            maxWidth: 450,
            maxHeight: '85vh',
            minHeight: 400,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(231, 76, 94, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e5e5'
          };

  return (
    <div style={containerStyle} data-chat-content>
      {/* Header with Glass Morphism */}
      <div
        className="ic-p-4 ic-text-white ic-relative ic-flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
          borderRadius: (isEmbedded || isMobileFullScreen) ? 0 : '1rem 1rem 0 0'
        }}
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
              <h3 className="ic-text-sm ic-font-semibold ic-tracking-wide ic-flex ic-items-center ic-gap-2">
                Welcome, {employeeName}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  padding: '1px 6px',
                  borderRadius: 6,
                  letterSpacing: '0.5px'
                }}>BETA</span>
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

            {/* Minimize/close button - chevron down */}
            <motion.button
              onClick={onClose}
              className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 sm:ic-p-2 ic-min-w-[44px] ic-min-h-[44px] sm:ic-min-w-0 sm:ic-min-h-0 ic-flex ic-items-center ic-justify-center ic-transition-colors ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-white/50"
              aria-label="Minimize chat"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronDown className="ic-w-6 ic-h-6" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content Area - Toggle between Messages and Quick Questions */}
      {/* In iframe mode: maxHeight allows scrolling when content exceeds widget bounds */}
      {showQuickQuestions ? (
        <div style={isInIframe ? { flex: 'none', maxHeight: 550, overflowY: 'auto' } : { flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <QuickQuestions
            onQuestionSelect={handleQuestionSelect}
            primaryColor={primaryColor}
            isInIframe={isInIframe}
          />
        </div>
      ) : (
        <div style={isInIframe ? { flex: 'none', maxHeight: 550, overflowY: 'auto' } : { flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <MessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
            isInIframe={isInIframe}
          />
        </div>
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
