import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './ChatWidget';
import './index.css';

/**
 * Embeddable Insurance Chat Widget
 *
 * Usage:
 * <script src="https://your-domain.com/widget.iife.js"></script>
 * <script>
 *   InsuranceChatWidget.init({
 *     apiUrl: 'https://your-api.onrender.com',
 *     position: 'bottom-right', // or 'bottom-left'
 *     primaryColor: '#3b82f6'
 *   });
 * </script>
 */

(function() {
  'use strict';

  const InsuranceChatWidget = {
    /**
     * Initialize the chat widget
     * @param {Object} config Configuration options
     */
    init: function(config = {}) {
      const {
        apiUrl = 'https://insurance-chatbot-api.onrender.com',
        position = 'bottom-right',
        primaryColor = '#3b82f6',
        containerId = 'insurance-chat-widget-root'
      } = config;

      // Create container if it doesn't exist
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
      }

      // Mount React app
      const root = ReactDOM.createRoot(container);
      root.render(
        React.createElement(ChatWidget, {
          apiUrl,
          position,
          primaryColor
        })
      );
    }
  };

  // Auto-init if data attributes are present
  if (document.currentScript) {
    const script = document.currentScript;
    const apiUrl = script.getAttribute('data-api-url');
    const position = script.getAttribute('data-position');
    const primaryColor = script.getAttribute('data-color');

    if (apiUrl) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          InsuranceChatWidget.init({ apiUrl, position, primaryColor });
        });
      } else {
        InsuranceChatWidget.init({ apiUrl, position, primaryColor });
      }
    }
  }

  // Expose to global scope
  window.InsuranceChatWidget = InsuranceChatWidget;
})();
