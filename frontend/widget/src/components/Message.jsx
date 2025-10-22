import ReactMarkdown from 'react-markdown';

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`ic-flex ${isUser ? 'ic-justify-end' : 'ic-justify-start'}`}>
      <div
        className={`ic-max-w-[80%] ic-rounded-lg ic-px-4 ic-py-2 ${
          isUser
            ? 'ic-bg-blue-600 ic-text-white'
            : isError
            ? 'ic-bg-red-50 ic-border ic-border-red-200 ic-text-red-700'
            : 'ic-bg-white ic-shadow ic-text-gray-800'
        }`}
      >
        <div className="ic-text-sm ic-prose ic-prose-sm ic-max-w-none ic-break-words markdown-content">
          {isUser ? (
            <p className="ic-whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="ic-mb-2 ic-last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="ic-list-disc ic-list-inside ic-mb-2 ic-space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="ic-list-decimal ic-list-inside ic-mb-2 ic-space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="ic-ml-2" {...props} />,
                strong: ({node, ...props}) => <strong className="ic-font-semibold" {...props} />,
                em: ({node, ...props}) => <em className="ic-italic" {...props} />,
                code: ({node, ...props}) => <code className="ic-bg-gray-100 ic-px-1 ic-rounded ic-text-xs" {...props} />,
                h1: ({node, ...props}) => <h1 className="ic-text-lg ic-font-bold ic-mb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="ic-text-base ic-font-bold ic-mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="ic-text-sm ic-font-bold ic-mb-1" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        <p className="ic-text-xs ic-text-gray-400 ic-mt-1">
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
