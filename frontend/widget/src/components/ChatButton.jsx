import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

export default function ChatButton({ isOpen, onClick, primaryColor }) {
  return (
    <motion.button
      onClick={onClick}
      className="ic-group ic-px-6 ic-py-4 ic-rounded-full ic-flex ic-items-center ic-gap-3 ic-transition-all ic-duration-300 ic-shadow-soft-lg hover:ic-shadow-glow ic-focus-visible:outline-none ic-focus-visible:ring-2 ic-focus-visible:ring-primary-500 ic-focus-visible:ring-offset-2 ic-border ic-border-white/10"
      style={{
        background: 'var(--gradient-primary)',
        color: 'white'
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-expanded={isOpen}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            className="ic-flex ic-items-center ic-gap-3"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <X
              className="ic-w-5 ic-h-5"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <span className="ic-font-semibold ic-text-sm ic-tracking-wide">
              Close
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="open"
            className="ic-flex ic-items-center ic-gap-3"
            initial={{ opacity: 0, rotate: 90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -90 }}
            transition={{ duration: 0.2 }}
          >
            <div className="ic-relative">
              <MessageCircle
                className="ic-w-6 ic-h-6 ic-transition-transform group-hover:ic-scale-110"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <motion.span
                className="ic-absolute ic--top-1 ic--right-1 ic-w-2.5 ic-h-2.5 ic-bg-green-400 ic-rounded-full ic-border-2 ic-border-white"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.8, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
            <span className="ic-font-semibold ic-text-sm ic-tracking-wide">
              Chat with us
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
