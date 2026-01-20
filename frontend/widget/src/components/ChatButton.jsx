import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ChatButton({ isOpen, onClick, primaryColor }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  // Show tooltip after a delay when button is visible and chat is closed
  useEffect(() => {
    if (isOpen || tooltipDismissed) {
      setShowTooltip(false);
      return;
    }

    // Check if tooltip was dismissed this session
    const dismissed = sessionStorage.getItem('chat_tooltip_dismissed');
    if (dismissed) {
      setTooltipDismissed(true);
      return;
    }

    // Show tooltip after 2 seconds
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isOpen, tooltipDismissed]);

  const handleDismissTooltip = (e) => {
    e.stopPropagation();
    setShowTooltip(false);
    setTooltipDismissed(true);
    sessionStorage.setItem('chat_tooltip_dismissed', 'true');
  };

  const handleButtonClick = (e) => {
    setShowTooltip(false);
    onClick(e);
  };

  // Larger button for desktop (64px), smaller for mobile (56px)
  const buttonSize = 64;
  const iconSize = 28;

  const buttonStyle = {
    position: 'relative',
    width: buttonSize,
    height: buttonSize,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
    color: 'white',
    border: 'none',
    boxShadow: '0 6px 20px rgba(220, 38, 38, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  const tooltipStyle = {
    position: 'absolute',
    right: buttonSize + 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    color: '#1f2937',
    padding: '10px 14px',
    borderRadius: 24,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
    whiteSpace: 'nowrap',
    fontSize: 14,
    fontWeight: 500,
    animation: 'slideIn 0.3s ease-out',
    zIndex: 1
  };

  const dismissButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    cursor: 'pointer',
    marginLeft: 4,
    flexShrink: 0,
    transition: 'background-color 0.15s ease'
  };

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      padding: '12px' // Prevent clipping from iframe edges
    }}>
      {/* Tooltip bubble */}
      {showTooltip && !isOpen && (
        <div style={tooltipStyle}>
          <span>Hi. Need any help?</span>
          <button
            onClick={handleDismissTooltip}
            style={dismissButtonStyle}
            aria-label="Dismiss"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
          >
            <X style={{ width: 12, height: 12 }} strokeWidth={2.5} />
          </button>
          {/* Arrow pointing to button */}
          <div
            style={{
              position: 'absolute',
              right: -6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderLeft: '6px solid #ffffff'
            }}
          />
        </div>
      )}

      {/* Main chat button */}
      <button
        onClick={handleButtonClick}
        style={buttonStyle}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 28px rgba(220, 38, 38, 0.45), 0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.35), 0 2px 8px rgba(0, 0, 0, 0.1)';
        }}
      >
        {isOpen ? (
          <X style={{ width: iconSize, height: iconSize }} strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <>
            {/* Chat bubble icon */}
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 3C6.477 3 2 6.477 2 11c0 1.821.627 3.507 1.678 4.868L2.5 20.5l4.632-1.178A9.932 9.932 0 0012 20c5.523 0 10-3.477 10-8s-4.477-8-10-8z"
                fill="currentColor"
                opacity="0.9"
              />
              <rect x="7" y="9" width="10" height="1.5" rx="0.75" fill="#b5233d" />
              <rect x="7" y="12" width="6" height="1.5" rx="0.75" fill="#b5233d" />
            </svg>
            {/* Online indicator with pulse animation */}
            <span
              className="online-indicator"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 14,
                height: 14,
                backgroundColor: '#22c55e',
                borderRadius: '50%',
                border: '2.5px solid white',
                boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2)',
                animation: 'onlinePulse 2s ease-in-out infinite'
              }}
            />
          </>
        )}
      </button>

      {/* Keyframe animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }
        @keyframes onlinePulse {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15), 0 0 8px rgba(34, 197, 94, 0.3);
          }
        }
      `}</style>
    </div>
  );
}
