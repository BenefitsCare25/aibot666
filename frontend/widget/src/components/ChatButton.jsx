import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

export default function ChatButton({ isOpen, onClick, primaryColor }) {
  return (
    <div className="ic-relative">
      {/* Pulse ring animation - only when closed */}
      {!isOpen && (
        <motion.div
          className="ic-absolute ic-inset-0 ic-rounded-full"
          style={{
            background: 'var(--gradient-primary)',
            opacity: 0.3
          }}
          animate={{
            scale: [1, 1.4, 1.4],
            opacity: [0.4, 0, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
      )}

      <motion.button
        onClick={onClick}
        className="ic-relative ic-w-14 ic-h-14 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-transition-all ic-duration-300 ic-shadow-soft-lg hover:ic-shadow-glow ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-white/50 ic-focus-visible:ring-offset-2 ic-border ic-border-white/20"
        style={{
          background: 'var(--gradient-primary)',
          color: 'white'
        }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20
        }}
      >
        {/* Gradient overlay for depth */}
        <div
          className="ic-absolute ic-inset-0 ic-rounded-full ic-opacity-0 hover:ic-opacity-100 ic-transition-opacity ic-duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)'
          }}
        />

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              className="ic-relative ic-z-10"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <X
                className="ic-w-6 ic-h-6"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              className="ic-relative ic-z-10"
              initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {/* Custom chat bubble icon */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-6 ic-h-6"
                aria-hidden="true"
              >
                {/* Main bubble */}
                <path
                  d="M12 3C6.477 3 2 6.477 2 11c0 1.821.627 3.507 1.678 4.868L2.5 20.5l4.632-1.178A9.932 9.932 0 0012 20c5.523 0 10-3.477 10-8s-4.477-8-10-8z"
                  fill="currentColor"
                  opacity="0.9"
                />
                {/* Chat line 1 */}
                <rect
                  x="7"
                  y="9"
                  width="10"
                  height="1.5"
                  rx="0.75"
                  fill="var(--color-primary-600)"
                />
                {/* Chat line 2 */}
                <rect
                  x="7"
                  y="12"
                  width="6"
                  height="1.5"
                  rx="0.75"
                  fill="var(--color-primary-600)"
                />
              </svg>

              {/* Online indicator dot */}
              <motion.span
                className="ic-absolute ic-w-3 ic-h-3 ic-bg-green-400 ic-rounded-full ic-border-2 ic-border-white"
                style={{ top: '-2px', right: '-2px', boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)' }}
                animate={{
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
