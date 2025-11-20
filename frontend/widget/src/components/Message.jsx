import ReactMarkdown from 'react-markdown';

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`ic-flex ic-mb-4 ${isUser ? 'ic-justify-end' : 'ic-justify-start'}`}>
      <div
        className={`ic-max-w-[80%] ic-px-4 ic-py-3 ic-shadow-md ${
          isUser
            ? 'ic-rounded-3xl ic-rounded-br-md ic-text-white'
            : isError
            ? 'ic-rounded-3xl ic-rounded-bl-md ic-bg-red-50 ic-border-2 ic-border-red-200 ic-text-red-700'
            : 'ic-rounded-3xl ic-rounded-bl-md ic-bg-white ic-border ic-border-gray-200 ic-text-gray-800'
        }`}
        style={isUser ? {
          background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)'
        } : {}}
      >
        <div className="ic-text-sm ic-prose ic-prose-sm ic-max-w-none ic-break-words markdown-content">
          {isUser ? (
            <p className="ic-whitespace-pre-wrap ic-mb-0">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="ic-mb-2 ic-last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="ic-list-disc ic-list-inside ic-mb-2 ic-space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="ic-list-decimal ic-list-inside ic-mb-2 ic-space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="ic-ml-2" {...props} />,
                strong: ({node, ...props}) => <strong className="ic-font-semibold" {...props} />,
                em: ({node, ...props}) => <em className="ic-italic" {...props} />,
                code: ({node, ...props}) => <code className="ic-bg-gray-100 ic-px-2 ic-py-0.5 ic-rounded-md ic-text-xs ic-font-mono" {...props} />,
                h1: ({node, ...props}) => <h1 className="ic-text-lg ic-font-bold ic-mb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="ic-text-base ic-font-bold ic-mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="ic-text-sm ic-font-bold ic-mb-1" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        <p className={`ic-text-xs ic-mt-2 ${isUser ? 'ic-text-white/80' : 'ic-text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
