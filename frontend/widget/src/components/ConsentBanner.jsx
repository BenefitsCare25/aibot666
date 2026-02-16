import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function ConsentBanner({ onConsent, onShowPrivacyPolicy }) {
  const handleAccept = () => {
    localStorage.setItem('pdpa_consent', JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString()
    }));
    onConsent();
  };

  return (
    <motion.div
      className="ic-space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="ic-rounded-xl ic-p-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
      >
        <div className="ic-flex ic-items-center ic-gap-2 ic-mb-3">
          <Shield className="ic-w-5 ic-h-5" style={{ color: 'var(--color-primary-500)' }} strokeWidth={2} />
          <h4 className="ic-text-sm ic-font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Data Protection Notice
          </h4>
        </div>

        <p className="ic-text-xs ic-leading-relaxed ic-mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          We collect and process your personal data (such as employee ID, email, and chat messages)
          to provide support assistance. Your messages may be processed by AI services and shared
          with our support team.
        </p>

        <button
          onClick={onShowPrivacyPolicy}
          className="ic-text-xs ic-font-medium ic-mb-4 hover:ic-underline"
          style={{ color: 'var(--color-primary-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Read full Privacy Notice &rarr;
        </button>

        <motion.button
          onClick={handleAccept}
          className="ic-w-full ic-py-2.5 ic-rounded-lg ic-text-white ic-text-sm ic-font-semibold ic-transition-all"
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
            border: 'none',
            cursor: 'pointer'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          I Agree
        </motion.button>
      </div>
    </motion.div>
  );
}
