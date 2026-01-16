import { X } from 'lucide-react';

export default function ChatButton({ isOpen, onClick, primaryColor }) {
  const buttonStyle = {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
  };

  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
    >
      {isOpen ? (
        <X style={{ width: 24, height: 24 }} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <>
          {/* Chat bubble icon */}
          <svg
            width="24"
            height="24"
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
          {/* Online indicator */}
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 12,
              height: 12,
              backgroundColor: '#4ade80',
              borderRadius: '50%',
              border: '2px solid white'
            }}
          />
        </>
      )}
    </button>
  );
}
