import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import QuickQuestions from './QuickQuestions';

export default function ChatWindow({ onClose, onLogout, primaryColor }) {
  const { employeeName, messages, isLoading, sendMessage } = useChatStore();
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

  const handleQuestionSelect = async (question) => {
    setShowQuickQuestions(false);
    setInputValue(question);

    // Automatically send the selected question
    try {
      await sendMessage(question);
    } catch (error) {
      console.error('Failed to send selected question:', error);
    }
  };

  const toggleQuickQuestions = () => {
    setShowQuickQuestions(!showQuickQuestions);
  };

  return (
    <div className="ic-bg-white ic-rounded-lg ic-shadow-xl ic-w-96 ic-h-[500px] ic-flex ic-flex-col ic-overflow-hidden">
      {/* Header */}
      <div
        className="ic-p-4 ic-text-white ic-flex ic-items-center ic-justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="ic-flex ic-items-center ic-gap-2">
          <div className="ic-w-8 ic-h-8 ic-bg-white/20 ic-rounded-full ic-flex ic-items-center ic-justify-center">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="ic-text-sm ic-font-semibold">{employeeName}</h3>
            <p className="ic-text-xs ic-opacity-90">Insurance Support</p>
          </div>
        </div>
        <div className="ic-flex ic-items-center ic-gap-2">
          <button
            onClick={toggleQuickQuestions}
            className="ic-text-white hover:ic-bg-white/20 ic-rounded ic-p-1 ic-transition-colors"
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
            className="ic-text-white hover:ic-bg-white/20 ic-rounded ic-p-1 ic-transition-colors"
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
            className="ic-text-white hover:ic-bg-white/20 ic-rounded ic-p-1 ic-transition-colors"
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

      {/* Input */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
        primaryColor={primaryColor}
      />
    </div>
  );
}
