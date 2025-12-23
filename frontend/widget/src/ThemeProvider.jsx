import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem('chat-widget-theme');
    if (stored) return stored;

    // Always default to light mode for consistency
    // Don't auto-detect system dark mode preference
    return 'light';
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('chat-widget-theme', theme);

    // Apply theme class to widget root
    const root = document.getElementById('insurance-chat-widget-root');
    if (root) {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
