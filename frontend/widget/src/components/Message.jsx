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
