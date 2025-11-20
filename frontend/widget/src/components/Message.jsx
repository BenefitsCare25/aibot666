import ReactMarkdown from 'react-markdown';

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`ic-flex ic-mb-3 ${isUser ? 'ic-justify-end' : 'ic-justify-start'}`}>
      <div
        className={`ic-max-w-[85%] ic-px-4 ic-py-3 ic-transition-all ${
          isUser
            ? 'ic-rounded-2xl ic-rounded-br-md ic-text-white ic-shadow-soft'
            : isError
            ? 'ic-rounded-2xl ic-rounded-bl-md ic-border ic-shadow-soft'
            : 'ic-rounded-2xl ic-rounded-bl-md ic-border ic-shadow-soft'
        }`}
        style={
          isUser
            ? { background: 'var(--gradient-primary)' }
            : isError
            ? { backgroundColor: '#fef2f2', borderColor: '#fecdd3', color: '#be123c' }
            : {
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }
        }
      >
        <div className="ic-text-sm ic-leading-relaxed ic-max-w-none ic-break-words">
          {isUser ? (
            <p className="ic-whitespace-pre-wrap ic-m-0 ic-font-normal ic-leading-relaxed">
              {message.content}
            </p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => (
                  <p
                    className="ic-mb-2 ic-last:mb-0 ic-leading-relaxed"
                    style={{ color: isError ? '#be123c' : 'var(--color-text-primary)' }}
                    {...props}
                  />
                ),
                ul: ({node, ...props}) => (
                  <ul className="ic-list-disc ic-list-inside ic-mb-2 ic-space-y-1 ic-pl-1" {...props} />
                ),
                ol: ({node, ...props}) => (
                  <ol className="ic-list-decimal ic-list-inside ic-mb-2 ic-space-y-1 ic-pl-1" {...props} />
                ),
                li: ({node, ...props}) => <li className="ic-ml-2 ic-leading-relaxed" {...props} />,
                strong: ({node, ...props}) => <strong className="ic-font-semibold" {...props} />,
                em: ({node, ...props}) => <em className="ic-italic" {...props} />,
                code: ({node, inline, ...props}) =>
                  inline ? (
                    <code
                      className="ic-px-1.5 ic-py-0.5 ic-rounded ic-text-xs ic-font-mono ic-border"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-primary-600)'
                      }}
                      {...props}
                    />
                  ) : (
                    <code
                      className="ic-block ic-px-3 ic-py-2 ic-rounded-lg ic-text-xs ic-font-mono ic-border ic-my-2 ic-overflow-x-auto"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border)'
                      }}
                      {...props}
                    />
                  ),
                h1: ({node, ...props}) => <h1 className="ic-text-base ic-font-bold ic-mb-2 ic-mt-1" {...props} />,
                h2: ({node, ...props}) => <h2 className="ic-text-sm ic-font-bold ic-mb-2 ic-mt-1" {...props} />,
                h3: ({node, ...props}) => <h3 className="ic-text-sm ic-font-semibold ic-mb-1" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        <p
          className="ic-text-xs ic-mt-2 ic-font-medium"
          style={{ color: isUser ? 'rgba(255, 255, 255, 0.75)' : 'var(--color-text-tertiary)' }}
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
