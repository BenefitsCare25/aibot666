/**
 * Chat Widget Embed Helper
 * This script handles iframe resizing for the chat widget.
 * Include this script on your page and it will automatically handle
 * widget resize events, including mobile fullscreen.
 *
 * Usage:
 * <script src="https://app-aibot-api.azurewebsites.net/embed-helper.js"></script>
 */
(function() {
  'use strict';

  // Find the chat widget iframe
  var iframe = document.getElementById('chat-widget-iframe');
  if (!iframe) {
    console.warn('[ChatWidget] iframe#chat-widget-iframe not found');
    return;
  }

  // Track if this is the first resize (initial load)
  var isFirstResize = true;
  var lastState = 'closed';

  // Remove any transition on initial load to prevent flickering
  iframe.style.transition = 'none';

  // Handle resize messages from the widget
  window.addEventListener('message', function(event) {
    // Verify message type
    if (!event.data || event.data.type !== 'chatWidgetResize') {
      return;
    }

    var w = event.data.width;
    var h = event.data.height;
    var state = event.data.state;
    var isMobile = window.innerWidth < 640;
    var isFullscreen = state === 'open' && isMobile;

    // Enable smooth transition only after first resize and on state changes
    if (isFirstResize) {
      isFirstResize = false;
      // Keep transition disabled for initial positioning
    } else if (lastState !== state) {
      // Enable transition for open/close state changes
      iframe.style.transition = 'width 0.2s ease, height 0.2s ease';
    }
    lastState = state;

    if (isFullscreen) {
      // Mobile fullscreen: cover entire viewport (no transition for fullscreen)
      iframe.style.transition = 'none';
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.height = '100dvh'; // Dynamic viewport height for mobile browsers
      iframe.style.zIndex = '999999';
      iframe.style.borderRadius = '0';

      // Lock body scroll on mobile
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
    } else {
      // Desktop or closed: corner positioning
      iframe.style.position = 'fixed';
      iframe.style.top = 'auto';
      iframe.style.left = 'auto';
      iframe.style.bottom = isMobile ? '12px' : '16px';
      iframe.style.right = isMobile ? '12px' : '16px';
      iframe.style.width = typeof w === 'string' ? w : w + 'px';
      iframe.style.height = typeof h === 'string' ? h : h + 'px';
      iframe.style.zIndex = '9999';
      iframe.style.borderRadius = '';

      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.left = '';
    }
  });

  console.log('[ChatWidget] Embed helper loaded successfully');
})();
