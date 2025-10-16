export default function ChatButton({ isOpen, onClick, primaryColor }) {
  return (
    <button
      onClick={onClick}
      className="ic-w-14 ic-h-14 ic-rounded-full ic-shadow-lg ic-flex ic-items-center ic-justify-center ic-transition-all ic-duration-300 hover:ic-scale-110 ic-focus:outline-none ic-focus:ring-2 ic-focus:ring-offset-2"
      style={{
        backgroundColor: primaryColor,
        color: 'white'
      }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="ic-w-6 ic-h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="ic-w-6 ic-h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      )}
    </button>
  );
}
