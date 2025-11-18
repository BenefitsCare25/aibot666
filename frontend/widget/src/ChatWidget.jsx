import { useState, useEffect } from 'react';
import { useChatStore } from './store/chatStore';
import ChatButton from './components/ChatButton';
import ChatWindow from './components/ChatWindow';
import LoginForm from './components/LoginForm';

export default function ChatWidget({ apiUrl, position = 'bottom-right', primaryColor = '#3b82f6', domain = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { initialize } = useChatStore();

  useEffect(() => {
    // Initialize store with API URL and optional domain override
    initialize(apiUrl, domain);

    // Check if user has existing session in localStorage
    const storedSession = localStorage.getItem('chat_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        if (session.sessionId && session.employeeId) {
          setIsAuthenticated(true);
          useChatStore.setState({
            sessionId: session.sessionId,
            employeeId: session.employeeId,
            employeeName: session.employeeName
          });
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem('chat_session');
      }
    }
  }, [apiUrl, domain, initialize]);

  const positionClasses = {
    'bottom-right': 'ic-bottom-4 ic-right-4',
    'bottom-left': 'ic-bottom-4 ic-left-4'
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleLogin = (sessionData) => {
    setIsAuthenticated(true);
    // Store session in localStorage for persistence
    localStorage.setItem('chat_session', JSON.stringify({
      sessionId: sessionData.sessionId,
      employeeId: sessionData.employee.id,
      employeeName: sessionData.employee.name
    }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('chat_session');
    useChatStore.getState().reset();
    setIsOpen(false);
  };

  return (
    <div className={`ic-fixed ${positionClasses[position]} ic-z-[999999]`}>
      {/* Chat Window */}
      {isOpen && (
        <div className="ic-mb-4 ic-animate-slide-up">
          {isAuthenticated ? (
            <ChatWindow
              onClose={handleToggle}
              onLogout={handleLogout}
              primaryColor={primaryColor}
            />
          ) : (
            <LoginForm
              onLogin={handleLogin}
              onClose={handleToggle}
              primaryColor={primaryColor}
            />
          )}
        </div>
      )}

      {/* Toggle Button */}
      <ChatButton
        isOpen={isOpen}
        onClick={handleToggle}
        primaryColor={primaryColor}
      />
    </div>
  );
}
