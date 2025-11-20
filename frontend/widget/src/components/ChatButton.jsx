export default function ChatButton({ isOpen, onClick, primaryColor }) {
  return (
    <button
      onClick={onClick}
      className="ic-px-6 ic-py-4 ic-rounded-full ic-shadow-2xl ic-flex ic-items-center ic-gap-3 ic-transition-all ic-duration-300 hover:ic-scale-105 hover:ic-shadow-[0_20px_50px_rgba(220,38,38,0.4)] ic-focus:outline-none ic-focus:ring-2 ic-focus:ring-red-500 ic-focus:ring-offset-2 ic-border-2 ic-border-white/20"
      style={{
        background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
        color: 'white'
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ic-w-6 ic-h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="ic-font-bold ic-text-base ic-tracking-wide">Close</span>
        </>
      ) : (
        <>
          <div className="ic-relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ic-w-7 ic-h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="ic-absolute ic--top-1 ic--right-1 ic-w-3 ic-h-3 ic-bg-green-400 ic-rounded-full ic-border-2 ic-border-white ic-animate-pulse"></span>
          </div>
          <span className="ic-font-bold ic-text-base ic-tracking-wide">Chat with us</span>
        </>
      )}
    </button>
  );
}
