import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ChatButton({ isOpen, onClick, primaryColor }) {
  return (
    <motion.button
      onClick={onClick}
      className="ic-relative ic-w-14 ic-h-14 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-transition-colors ic-shadow-lg hover:ic-shadow-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-white/50 focus:ic-ring-offset-2 ic-border ic-border-white/20"
      style={{
        background: 'var(--gradient-primary)',
        color: 'white'
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Icon container with simple rotation */}
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="ic-flex ic-items-center ic-justify-center"
      >
        {isOpen ? (
          <X className="ic-w-6 ic-h-6" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <>
            {/* Chat bubble icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="ic-w-6 ic-h-6"
              aria-hidden="true"
            >
              <path
                d="M12 3C6.477 3 2 6.477 2 11c0 1.821.627 3.507 1.678 4.868L2.5 20.5l4.632-1.178A9.932 9.932 0 0012 20c5.523 0 10-3.477 10-8s-4.477-8-10-8z"
                fill="currentColor"
                opacity="0.9"
              />
              <rect x="7" y="9" width="10" height="1.5" rx="0.75" fill="var(--color-primary-600)" />
              <rect x="7" y="12" width="6" height="1.5" rx="0.75" fill="var(--color-primary-600)" />
            </svg>
            {/* Online indicator */}
            <span
              className="ic-absolute ic-w-3 ic-h-3 ic-bg-green-400 ic-rounded-full ic-border-2 ic-border-white"
              style={{ top: '2px', right: '2px' }}
            />
          </>
        )}
      </motion.div>
    </motion.button>
  );
}
