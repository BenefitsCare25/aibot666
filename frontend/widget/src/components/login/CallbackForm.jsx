import { AnimatePresence, motion } from 'framer-motion';
import { Phone, Loader2 } from 'lucide-react';

export default function CallbackForm({
  contactNumber,
  setContactNumber,
  isLoading,
  successMessage,
  onSubmit,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Divider */}
      <div className="ic-my-4 ic-flex ic-items-center">
        <div
          className="ic-flex-1 ic-border-t"
          style={{ borderColor: 'var(--color-border)' }}
        ></div>
        <span
          className="ic-px-3 ic-text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          OR
        </span>
        <div
          className="ic-flex-1 ic-border-t"
          style={{ borderColor: 'var(--color-border)' }}
        ></div>
      </div>

      {/* Contact Number Form */}
      <form onSubmit={onSubmit} className="ic-space-y-4">
        <div>
          <label
            htmlFor="contactNumber"
            className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Request Callback
          </label>
          <div className="ic-relative">
            <div className="ic-absolute ic-left-3 ic-top-1/2 ic-transform ic--translate-y-1/2">
              <Phone
                className="ic-w-4 ic-h-4"
                style={{ color: 'var(--color-text-tertiary)' }}
                strokeWidth={2}
              />
            </div>
            <input
              type="tel"
              id="contactNumber"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g., +65 9123 4567"
              className="ic-w-full ic-pl-10 ic-pr-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
              style={{
                backgroundColor: '#ffffff',
                border: 'none',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
          </div>
          <p
            className="ic-text-xs ic-mt-2 ic-italic"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            We'll call you back during office hours
          </p>
        </div>

        <motion.button
          type="submit"
          disabled={isLoading}
          className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-soft-lg"
          style={{ background: 'var(--gradient-primary)' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <span className="ic-flex ic-items-center ic-justify-center ic-gap-2">
              <Loader2 className="ic-animate-spin ic-h-4 ic-w-4" />
              Submitting...
            </span>
          ) : (
            'Submit Contact Number'
          )}
        </motion.button>
      </form>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            className="ic-mt-4 ic-p-4 ic-bg-green-50 ic-border-l-4 ic-border-green-500 ic-rounded-lg ic-shadow-soft"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="ic-text-sm ic-text-green-700 ic-font-medium">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
