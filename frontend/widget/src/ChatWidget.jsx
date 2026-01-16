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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

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

    if (isMobile && isOpen) {
      document.body.classList.add('ic-chat-open');
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      // Add fullscreen class to widget root
      if (widgetRoot) {
        widgetRoot.classList.add('ic-mobile-fullscreen');
      }
    } else {
      document.body.classList.remove('ic-chat-open');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      // Remove fullscreen class from widget root
      if (widgetRoot) {
        widgetRoot.classList.remove('ic-mobile-fullscreen');
      }
    }
    return () => {
      document.body.classList.remove('ic-chat-open');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
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

  // In iframe mode, position at edge (iframe provides offset from page)
  // In direct mode, add padding from page edges
  const positionClasses = {
    'bottom-right': isInIframe ? 'ic-bottom-0 ic-right-0' : 'ic-bottom-4 ic-right-4',
    'bottom-left': isInIframe ? 'ic-bottom-0 ic-left-0' : 'ic-bottom-4 ic-left-4'
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

  // Mobile full-screen: fill entire viewport
  // Desktop: positioned popup
  const containerClasses = isMobile && isOpen
    ? "ic-fixed ic-inset-0 ic-z-[999999]"
    : isInIframe && isOpen
      ? "ic-fixed ic-bottom-0 ic-right-0 ic-z-[999999]"
      : `ic-fixed ${positionClasses[position]} ic-z-[999999]`;

  return (
    <ThemeProvider>
      <div className={containerClasses}>
        {/* Chat Window */}
        {isOpen && (
          <div className={isMobile ? "ic-h-full ic-w-full" : "ic-mb-4 ic-animate-slide-up"}>
            {isAuthenticated ? (
              <ChatWindow
                onClose={handleToggle}
                onLogout={handleLogout}
                primaryColor={primaryColor}
                isEmbedded={false}
                isMobileFullScreen={isMobile}
              />
            ) : (
              <LoginForm
                onLogin={handleLogin}
                onClose={handleToggle}
                primaryColor={primaryColor}
                isEmbedded={false}
                isMobileFullScreen={isMobile}
              />
            )}
          </div>
        )}

        {/* Toggle Button - Hidden when mobile fullscreen is active */}
        {!(isMobile && isOpen) && (
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
