import { motion } from 'framer-motion';

export default function SuccessScreen({ email, onClose, onSubmitAnother }) {
  return (
    <motion.div
      className="ic-space-y-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success Icon and Message */}
      <div className="ic-text-center ic-py-8">
        <motion.div
          className="ic-w-20 ic-h-20 ic-mx-auto ic-mb-4 ic-bg-green-100 ic-rounded-full ic-flex ic-items-center ic-justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <svg
            className="ic-w-10 ic-h-10 ic-text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        <h3
          className="ic-text-2xl ic-font-bold ic-mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Request Submitted!
        </h3>

        <p
          className="ic-text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Your LOG request has been successfully submitted. You will receive a confirmation email at <strong>{email}</strong> shortly.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="ic-space-y-2">
        <motion.button
          type="button"
          onClick={onClose}
          className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all hover:ic-shadow-soft-lg"
          style={{ background: 'var(--gradient-primary)' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Close
        </motion.button>

        <button
          type="button"
          onClick={onSubmitAnother}
          className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          &larr; Submit Another Request
        </button>
      </div>
    </motion.div>
  );
}
