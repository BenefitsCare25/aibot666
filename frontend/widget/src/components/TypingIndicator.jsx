export default function TypingIndicator() {
  return (
    <div className="ic-flex ic-justify-start">
      <div className="ic-bg-white ic-shadow ic-rounded-lg ic-px-4 ic-py-3">
        <div className="ic-flex ic-gap-1 ic-items-center">
          <div className="ic-w-2 ic-h-2 ic-bg-gray-400 ic-rounded-full ic-typing-dot"></div>
          <div className="ic-w-2 ic-h-2 ic-bg-gray-400 ic-rounded-full ic-typing-dot"></div>
          <div className="ic-w-2 ic-h-2 ic-bg-gray-400 ic-rounded-full ic-typing-dot"></div>
        </div>
      </div>
    </div>
  );
}
