import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './ChatWidget';
import './index.css';

// Mount widget for development
const root = document.getElementById('insurance-chat-widget-root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ChatWidget apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:3000'} />
    </React.StrictMode>
  );
}
