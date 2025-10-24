import { useState } from 'react';

export default function EmailInput({ value, onChange, onBlur, showError }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const validateEmail = (email) => {
    if (!email) return true; // Empty is ok (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsValid(validateEmail(newValue));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const valid = validateEmail(value);
    setIsValid(valid);
    if (onBlur) onBlur(valid);
  };

  return (
    <div className="ic-p-3 ic-bg-blue-50 ic-border-b ic-border-blue-200">
      <div className="ic-flex ic-items-start ic-gap-2">
        <div className="ic-flex-shrink-0 ic-mt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ic-w-5 ic-h-5 ic-text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="ic-flex-1">
          <label className="ic-block ic-text-sm ic-font-medium ic-text-gray-700 ic-mb-1">
            Your Email (Optional)
          </label>
          <input
            type="email"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder="email@example.com"
            className={`ic-w-full ic-px-3 ic-py-2 ic-border ic-rounded-md ic-text-sm focus:ic-outline-none focus:ic-ring-2 ic-text-gray-900 ic-transition-colors ${
              !isValid
                ? 'ic-border-red-500 focus:ic-ring-red-500'
                : 'ic-border-gray-300 focus:ic-ring-blue-500'
            }`}
          />
          {!isValid && value && (
            <p className="ic-text-xs ic-text-red-600 ic-mt-1">
              Please enter a valid email address
            </p>
          )}
          {isValid && (
            <p className="ic-text-xs ic-text-gray-600 ic-mt-1">
              💡 We'll send you a confirmation when your LOG request is received
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
