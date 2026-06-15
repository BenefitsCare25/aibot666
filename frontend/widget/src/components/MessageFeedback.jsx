import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export default function MessageFeedback({ message }) {
  const submitFeedback = useChatStore(state => state.submitFeedback);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rateMessage = async rating => {
    if (rating === 'negative' && !showReason) {
      setShowReason(true);
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback(message.messageId, rating, reason);
      setShowReason(false);
    } catch {
      // Keep controls available for retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ic-mt-3 ic-border-t ic-pt-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="ic-flex ic-items-center ic-gap-2">
        <span className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Was this helpful?
        </span>
        <RatingButton
          label="Helpful answer"
          active={message.feedback?.rating === 'positive'}
          disabled={submitting}
          activeColor="var(--color-success)"
          onClick={() => rateMessage('positive')}
        >
          <ThumbsUp size={14} />
        </RatingButton>
        <RatingButton
          label="Unhelpful answer"
          active={message.feedback?.rating === 'negative'}
          disabled={submitting}
          activeColor="var(--color-error-text)"
          onClick={() => rateMessage('negative')}
        >
          <ThumbsDown size={14} />
        </RatingButton>
      </div>

      {showReason && (
        <div className="ic-mt-2 ic-space-y-2">
          <textarea
            value={reason}
            maxLength={500}
            rows={2}
            onChange={event => setReason(event.target.value)}
            placeholder="What could be improved? (optional)"
            className="ic-w-full ic-rounded-lg ic-border ic-p-2 ic-text-xs"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)'
            }}
          />
          <div className="ic-flex ic-gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => rateMessage('negative')}
              className="ic-rounded-lg ic-px-3 ic-py-1.5 ic-text-xs ic-text-white disabled:ic-opacity-50"
              style={{ backgroundColor: 'var(--color-primary-600)' }}
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowReason(false)}
              className="ic-rounded-lg ic-border ic-px-3 ic-py-1.5 ic-text-xs"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingButton({ label, active, disabled, activeColor, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="ic-rounded ic-border ic-p-1.5 disabled:ic-opacity-50"
      style={{
        borderColor: active ? activeColor : 'var(--color-border)',
        color: active ? activeColor : 'var(--color-text-tertiary)'
      }}
    >
      {children}
    </button>
  );
}
