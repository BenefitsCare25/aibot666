import { motion } from 'framer-motion';
import { FileText, ArrowRight } from 'lucide-react';

export default function OptionSelector({ onSelectChat, onSelectLog, showChat = true, showLog = true }) {
  return (
    <div className="ic-space-y-3">
      {/* Chat Option Card */}
      {showChat && (
        <motion.button
          onClick={onSelectChat}
          className="ic-w-full ic-p-4 ic-rounded-xl ic-bg-white ic-shadow-soft hover:ic-shadow-soft-lg ic-transition-all ic-flex ic-items-center ic-justify-between ic-group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="ic-text-base ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Send us a message
          </span>
          <ArrowRight className="ic-w-5 ic-h-5 group-hover:ic-translate-x-1 ic-transition-transform" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
        </motion.button>
      )}

      {/* LOG Request Option Card */}
      {showLog && (
        <motion.button
          onClick={onSelectLog}
          className="ic-w-full ic-p-4 ic-rounded-xl ic-bg-white ic-shadow-soft hover:ic-shadow-soft-lg ic-transition-all ic-flex ic-items-center ic-justify-between ic-group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="ic-flex ic-items-center ic-gap-3">
            <FileText className="ic-w-5 ic-h-5" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
            <span className="ic-text-base ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Request Letter of Guarantee
            </span>
          </div>
          <ArrowRight className="ic-w-5 ic-h-5 group-hover:ic-translate-x-1 ic-transition-transform" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
        </motion.button>
      )}
    </div>
  );
}
