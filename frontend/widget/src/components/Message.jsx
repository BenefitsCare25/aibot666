import MessageContent from './MessageContent';
import MessageFeedback from './MessageFeedback';

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const canRate = !isUser && !isError && Boolean(message.messageId);

  const bubbleStyle = isUser
    ? { background: 'var(--gradient-primary)' }
    : isError
      ? {
          backgroundColor: 'var(--color-error-bg)',
          borderColor: 'var(--color-error-border)',
          color: 'var(--color-error-text)'
        }
      : {
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)'
        };

  return (
    <div className={`ic-mb-3 ic-flex ${isUser ? 'ic-justify-end' : 'ic-justify-start'}`}>
      <div
        className={`ic-max-w-[85%] ic-px-4 ic-py-3 ic-transition-all ${
          isUser
            ? 'ic-rounded-2xl ic-rounded-br-md ic-text-white ic-shadow-soft'
            : 'ic-rounded-2xl ic-rounded-bl-md ic-border ic-shadow-soft'
        }`}
        style={bubbleStyle}
      >
        <div className="ic-max-w-none ic-break-words ic-text-sm ic-leading-relaxed">
          <MessageContent message={message} isUser={isUser} isError={isError} />
        </div>

        {canRate && <MessageFeedback message={message} />}

        <p
          className="ic-mt-2 ic-text-xs ic-font-medium"
          style={{
            color: isUser ? 'var(--color-text-on-primary-muted)' : 'var(--color-text-tertiary)'
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
