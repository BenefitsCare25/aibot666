import { useState, useEffect } from 'react';
import { useChatStore } from './store/chatStore';
import ChatButton from './components/ChatButton';
import ChatWindow from './components/ChatWindow';
import LoginForm from './components/LoginForm';
import { ThemeProvider } from './ThemeProvider';
import { Toaster } from 'react-hot-toast';

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

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll and expand widget root on mobile when chat is open
  useEffect(() => {
    const widgetRoot = document.getElementById('insurance-chat-widget-root');
    const isMobileFullscreen = isMobile && isOpen;

    if (isMobileFullscreen) {
      // Lock body scroll for mobile fullscreen
      document.body.style.cssText = 'overflow: hidden !important; position: fixed !important; width: 100% !important; height: 100% !important; top: 0 !important; left: 0 !important;';

      // Force widget root to full screen with inline styles
      if (widgetRoot) {
        widgetRoot.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          z-index: 999999 !important;
          background: #ffffff !important;
        `;
      }
    } else {
      // Reset body scroll
      document.body.style.cssText = '';

      // Only reset widget root inline styles if they were previously set for mobile fullscreen
      // Desktop positioning is handled by CSS (bottom: 16px; right: 16px)
      if (widgetRoot && widgetRoot.style.cssText) {
        widgetRoot.style.cssText = '';
      }
    }

    return () => {
      document.body.style.cssText = '';
      if (widgetRoot) {
        widgetRoot.style.cssText = '';
      }
    };
  }, [isMobile, isOpen]);

  // Notify parent window of size changes (for iframe embedding)
  useEffect(() => {
    if (window.parent !== window) {
      // Mobile: full screen, Desktop: fixed size popup
      const size = isOpen
        ? isMobile
          ? { width: '100vw', height: '100vh', state: 'open' }
          : { width: 420, height: 650, state: 'open' }
        : { width: 200, height: 80, state: 'closed' };

      window.parent.postMessage({
        type: 'chatWidgetResize',
        ...size
      }, '*');
    }
  }, [isOpen, isMobile]);

  // Check if we're in an iframe
  const isInIframe = window.parent !== window;

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

  // Mobile full-screen uses inline styles, desktop uses positioned popup
  const isMobileFullScreen = isMobile && isOpen;

  // Container styles - inline for reliability
  const containerStyle = isMobileFullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        position: 'fixed',
        bottom: isInIframe ? 0 : 16,
        right: isInIframe ? 0 : 16,
        zIndex: 999999
      };

  // Chat content wrapper styles
  const chatWrapperStyle = isMobileFullScreen
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        marginBottom: 16
      };

  return (
    <ThemeProvider>
      <div style={containerStyle}>
        {/* Chat Window */}
        {isOpen && (
          <div style={chatWrapperStyle}>
            {isAuthenticated ? (
              <ChatWindow
                onClose={handleToggle}
                onLogout={handleLogout}
                primaryColor={primaryColor}
                isEmbedded={false}
                isMobileFullScreen={isMobileFullScreen}
              />
            ) : (
              <LoginForm
                onLogin={handleLogin}
                onClose={handleToggle}
                primaryColor={primaryColor}
                isEmbedded={false}
                isMobileFullScreen={isMobileFullScreen}
              />
            )}
          </div>
        )}

        {/* Toggle Button - Hidden when mobile fullscreen is active */}
        {!isMobileFullScreen && (
          <ChatButton
            isOpen={isOpen}
            onClick={handleToggle}
            primaryColor={primaryColor}
          />
        )}

        {/* Toast Notifications */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.75rem',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#e74c5e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#e74c5e',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </ThemeProvider>
  );
}
