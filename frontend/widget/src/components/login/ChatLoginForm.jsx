import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function ChatLoginForm({
  identifier,
  setIdentifier,
  isLoading,
  onSubmit,
  onBack,
}) {
  return (
    <form onSubmit={onSubmit} className="ic-space-y-4">
      <div>
        <label
          htmlFor="identifier"
          className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Employee ID / User ID / Email
        </label>
        <input
          type="text"
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="e.g., EMP001 or user@example.com"
          className="ic-w-full ic-px-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
          style={{
            backgroundColor: '#ffffff',
            border: 'none',
            color: 'var(--color-text-primary)'
          }}
          disabled={isLoading}
          autoFocus
        />
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
            Starting...
          </span>
        ) : (
          'Start Chat'
        )}
      </motion.button>

      <button
        type="button"
        onClick={onBack}
        className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        &larr; Back to options
      </button>
    </form>
  );
}
