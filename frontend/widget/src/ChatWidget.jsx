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

  // Add iframe mode class to widget root for CSS overrides
  useEffect(() => {
    const widgetRoot = document.getElementById('insurance-chat-widget-root');
    if (widgetRoot && isInIframe) {
      widgetRoot.classList.add('ic-iframe-mode');
    }
    return () => {
      if (widgetRoot) {
        widgetRoot.classList.remove('ic-iframe-mode');
      }
    };
  }, [isInIframe]);

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
  // Use ResizeObserver to dynamically size iframe to content
  useEffect(() => {
    if (window.parent === window) return; // Not in iframe

    if (!isOpen) {
      // Closed state: accommodate tooltip bubble + button + shadows/hover effects
      // Tooltip (~190px) + gap (12px) + button (64px) + padding (24px) = ~290px
      // Height: button (64px) + shadow/indicator overlap + padding = 88px
      window.parent.postMessage({
        type: 'chatWidgetResize',
        width: 300,
        height: 88,
        state: 'closed'
      }, '*');
      return;
    }

    // Mobile fullscreen
    if (isMobile) {
      window.parent.postMessage({
        type: 'chatWidgetResize',
        width: '100vw',
        height: '100vh',
        state: 'open'
      }, '*');
      return;
    }

    // Desktop open: observe content height and resize dynamically
    const widgetRoot = document.getElementById('insurance-chat-widget-root');
    if (!widgetRoot) return;

    const sendSize = () => {
      // Find the actual content container (LoginForm or ChatWindow)
      const contentContainer = widgetRoot.querySelector('[data-chat-content]');

      let contentHeight;
      if (contentContainer) {
        // Measure the actual content element's natural height
        contentHeight = contentContainer.scrollHeight;
      } else {
        // Fallback to root scrollHeight
        contentHeight = widgetRoot.scrollHeight;
      }

      // Add padding for button below and ensure min/max bounds
      // Min 280 for teaser, max 850 for longer forms (LOG request)
      const height = Math.min(Math.max(contentHeight + 80, 280), 850);

      window.parent.postMessage({
        type: 'chatWidgetResize',
        width: 380,
        height: height,
        state: 'open'
      }, '*');
    };

    // Send initial size after delays to ensure content is fully rendered
    sendSize();
    const timer1 = setTimeout(sendSize, 50);
    const timer2 = setTimeout(sendSize, 150);
    const timer3 = setTimeout(sendSize, 300);

    // Observe for content changes (e.g., form expansion)
    const resizeObserver = new ResizeObserver(() => {
      sendSize();
    });
    resizeObserver.observe(widgetRoot);

    // Also observe mutations for dynamic content
    const mutationObserver = new MutationObserver(() => {
      setTimeout(sendSize, 50); // Small delay for DOM to settle
    });
    mutationObserver.observe(widgetRoot, {
      childList: true,
      subtree: true,
      attributes: true
    });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
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
    : isInIframe
      ? {
          // In iframe: let content determine height naturally
          // The iframe itself handles the positioning on the parent page
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOpen ? 'stretch' : 'flex-end' // Button to right when closed
        }
      : {
          // Not in iframe: fixed positioning at bottom-right corner
          position: 'fixed',
          bottom: 16,
          right: 16,
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
    : isInIframe
      ? {
          // In iframe: content flows naturally, button below
          marginBottom: 8
        }
      : {
          // Not in iframe: popup above button
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

        {/* Toggle Button - Hidden when chat is open (desktop uses header chevron to close) */}
        {!isOpen && (
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
