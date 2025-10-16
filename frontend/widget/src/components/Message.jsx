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
        <p className="ic-text-sm ic-whitespace-pre-wrap ic-break-words">
          {message.content}
        </p>

        {/* Metadata for AI responses */}
        {!isUser && !isError && message.confidence !== undefined && (
          <div className="ic-mt-2 ic-pt-2 ic-border-t ic-border-gray-200">
            <div className="ic-flex ic-items-center ic-gap-2 ic-text-xs ic-text-gray-500">
              <div className="ic-flex ic-items-center ic-gap-1">
                <span>Confidence:</span>
                <span className={`ic-font-medium ${
                  message.confidence >= 0.7 ? 'ic-text-green-600' :
                  message.confidence >= 0.5 ? 'ic-text-yellow-600' :
                  'ic-text-red-600'
                }`}>
                  {Math.round(message.confidence * 100)}%
                </span>
              </div>

              {message.escalated && (
                <span className="ic-px-2 ic-py-0.5 ic-bg-yellow-100 ic-text-yellow-700 ic-rounded-full ic-text-xs">
                  Escalated to support
                </span>
              )}
            </div>

            {message.sources && message.sources.length > 0 && (
              <div className="ic-mt-2">
                <p className="ic-text-xs ic-text-gray-500 ic-mb-1">Sources:</p>
                <ul className="ic-space-y-1">
                  {message.sources.map((source, idx) => (
                    <li key={idx} className="ic-text-xs ic-text-gray-600">
                      • {source.title}
                      <span className="ic-text-gray-400 ic-ml-1">
                        ({Math.round(source.similarity * 100)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
