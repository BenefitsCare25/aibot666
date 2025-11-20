import { useState } from 'react';
import { Mail } from 'lucide-react';

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
    <div
      className="ic-px-4 ic-py-3 ic-border-b"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)'
      }}
    >
      <div className="ic-flex ic-items-start ic-gap-2">
        <Mail
          className="ic-w-4 ic-h-4 ic-mt-2 ic-flex-shrink-0"
          style={{ color: 'var(--color-primary-600)' }}
          strokeWidth={2}
        />
        <div className="ic-flex-1">
          <label
            className="ic-block ic-text-xs ic-font-medium ic-mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Your Email (Optional)
          </label>
          <input
            type="email"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder="email@example.com"
            className="ic-w-full ic-px-3 ic-py-2 ic-rounded-lg ic-text-sm focus:ic-outline-none focus:ic-ring-2 ic-transition-colors"
            style={{
              backgroundColor: '#ffffff',
              border: !isValid && value ? '1px solid #ef4444' : 'none',
              color: 'var(--color-text-primary)'
            }}
          />
          {!isValid && value && (
            <p className="ic-text-xs ic-mt-1" style={{ color: '#ef4444' }}>
              Please enter a valid email address
            </p>
          )}
          {isValid && (
            <p className="ic-text-xs ic-mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              💡 We'll send you a confirmation when your LOG request is received
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
