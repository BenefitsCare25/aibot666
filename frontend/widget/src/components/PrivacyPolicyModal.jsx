import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield } from 'lucide-react';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ic-fixed ic-inset-0 ic-flex ic-items-center ic-justify-center ic-p-4"
          style={{ backgroundColor: 'var(--color-overlay)', zIndex: 100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ic-w-full ic-rounded-2xl ic-overflow-hidden ic-flex ic-flex-col"
            style={{
              maxWidth: 380,
              maxHeight: '85vh',
              backgroundColor: 'var(--color-bg-primary)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="ic-p-4 ic-text-white ic-flex ic-items-center ic-justify-between ic-flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)' }}
            >
              <div className="ic-flex ic-items-center ic-gap-2">
                <Shield className="ic-w-5 ic-h-5" strokeWidth={2} />
                <h3 className="ic-text-base ic-font-semibold">Privacy Notice</h3>
              </div>
              <button
                onClick={onClose}
                className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-1.5 ic-transition-colors ic-min-w-[36px] ic-min-h-[36px] ic-flex ic-items-center ic-justify-center"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Close privacy notice"
              >
                <X className="ic-w-5 ic-h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="ic-overflow-y-auto ic-flex-1" style={{ padding: '16px 20px' }}>
              <Section title="Data We Collect">
                <ul className="ic-space-y-1">
                  <Li>Employee ID / name (for authentication)</Li>
                  <Li>Email address (for LOG request acknowledgments)</Li>
                  <Li>Phone number (for callback requests)</Li>
                  <Li>Chat messages (to provide AI-assisted support)</Li>
                  <Li>File attachments (forwarded to support team via email)</Li>
                  <Li>Technical data (IP address, browser info for security)</Li>
                </ul>
              </Section>

              <Section title="How We Use Your Data">
                <ul className="ic-space-y-1">
                  <Li>Provide AI-powered support responses</Li>
                  <Li>Forward LOG requests and attachments to our support team</Li>
                  <Li>Send email confirmations and notifications to support staff</Li>
                  <Li>Improve our service quality</Li>
                </ul>
              </Section>

              <Section title="Third-Party Services">
                <ul className="ic-space-y-1">
                  <Li>OpenAI (processes your queries for AI responses)</Li>
                  <Li>Microsoft (email delivery)</Li>
                </ul>
              </Section>

              <Section title="Data Storage & Retention">
                <ul className="ic-space-y-1">
                  <Li>Chat history stored securely in our database</Li>
                  <Li>File attachments are sent via email and not permanently stored</Li>
                  <Li>Session data expires after 1 hour of inactivity</Li>
                </ul>
              </Section>

              <Section title="Your Rights (PDPA)">
                <ul className="ic-space-y-1">
                  <Li>Request access to your personal data</Li>
                  <Li>Request correction of inaccurate data</Li>
                  <Li>Withdraw consent (note: this may limit our ability to assist you)</Li>
                </ul>
              </Section>

              <div className="ic-mt-4 ic-pt-3 ic-border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  For data inquiries, contact{' '}
                  <span className="ic-font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    helpdesk@inspro.com.sg
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }) {
  return (
    <div className="ic-mb-4">
      <h4
        className="ic-text-sm ic-font-semibold ic-mb-1.5"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function Li({ children }) {
  return (
    <li
      className="ic-text-xs ic-flex ic-items-start ic-gap-1.5"
      style={{ color: 'var(--color-text-secondary)', listStyle: 'none' }}
    >
      <span className="ic-mt-0.5 ic-flex-shrink-0" style={{ color: 'var(--color-primary-500)' }}>&#8226;</span>
      <span>{children}</span>
    </li>
  );
}
