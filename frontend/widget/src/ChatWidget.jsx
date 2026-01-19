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

  // Check if we're in an iframe
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;

  // Detect mobile viewport - use parent's viewport when in iframe to prevent resize loops
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Initial detection based on window size (will be overridden by parent message if in iframe)
    return window.innerWidth < 640;
  });

  useEffect(() => {
    if (isInIframe) {
      // In iframe: listen for parent's viewport info to avoid resize loop
      const handleParentMessage = (event) => {
        if (event.data && event.data.type === 'chatWidgetParentInfo') {
          setIsMobile(event.data.isMobile);
        }
      };
      window.addEventListener('message', handleParentMessage);
      return () => window.removeEventListener('message', handleParentMessage);
    } else {
      // Not in iframe: use normal resize detection
      const handleResize = () => {
        setIsMobile(window.innerWidth < 640);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isInIframe]);

  // Lock body scroll and expand widget root on mobile when chat is open
  useEffect(() => {
    const widgetRoot = document.getElementById('insurance-chat-widget-root');
    const isMobileFullscreen = isMobile && isOpen;

    if (isMobileFullscreen) {
      // Lock body scroll for mobile fullscreen
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';

      // Add fullscreen class to widget root (CSS handles positioning)
      if (widgetRoot) {
        widgetRoot.classList.add('ic-mobile-fullscreen');
      }
    } else {
      // Reset body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';

      // Remove fullscreen class
      if (widgetRoot) {
        widgetRoot.classList.remove('ic-mobile-fullscreen');
      }
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      if (widgetRoot) {
        widgetRoot.classList.remove('ic-mobile-fullscreen');
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
          : { width: 420, height: 720, state: 'open' }
        : { width: 200, height: 80, state: 'closed' };

      window.parent.postMessage({
        type: 'chatWidgetResize',
        ...size
      }, '*');
    }
  }, [isOpen, isMobile]);

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
        width: '100%',
        height: '100%',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : isInIframe && isOpen
      ? {
          // When in iframe and open: fill the iframe from top
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column'
        }
      : {
          // Normal positioning (closed state or non-iframe)
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
    : isInIframe && isOpen
      ? {
          // Fill the iframe when open
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: 72 // Space for the close button
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
                isEmbedded={isInIframe}
                isMobileFullScreen={isMobileFullScreen}
              />
            ) : (
              <LoginForm
                onLogin={handleLogin}
                onClose={handleToggle}
                primaryColor={primaryColor}
                isEmbedded={isInIframe}
                isMobileFullScreen={isMobileFullScreen}
              />
            )}
          </div>
        )}

        {/* Toggle Button - Hidden when mobile fullscreen is active */}
        {!isMobileFullScreen && (
          <div style={isInIframe && isOpen ? {
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 12,
            flexShrink: 0
          } : undefined}>
            <ChatButton
              isOpen={isOpen}
              onClick={handleToggle}
              primaryColor={primaryColor}
            />
          </div>
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
