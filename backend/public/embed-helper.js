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

  // Track state for change detection
  var lastState = 'closed';

  // Detect mobile based on PARENT window (not iframe) - this is stable
  var isParentMobile = window.innerWidth < 640;

  // Disable all transitions to prevent flickering
  iframe.style.transition = 'none';

  // Send parent viewport info to iframe when it loads
  function sendParentInfo() {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'chatWidgetParentInfo',
        parentWidth: window.innerWidth,
        isMobile: isParentMobile
      }, '*');
    }
  }

  // Send parent info when iframe loads
  iframe.addEventListener('load', sendParentInfo);

  // Also send immediately in case iframe is already loaded
  setTimeout(sendParentInfo, 100);

  // Update mobile detection when parent window resizes (not the iframe)
  window.addEventListener('resize', function() {
    var newIsMobile = window.innerWidth < 640;
    if (newIsMobile !== isParentMobile) {
      isParentMobile = newIsMobile;
      sendParentInfo();
    }
  });

  // Handle resize messages from the widget
  window.addEventListener('message', function(event) {
    // Verify message type
    if (!event.data || event.data.type !== 'chatWidgetResize') {
      return;
    }

    var state = event.data.state;
    var w = event.data.width;
    var h = event.data.height;
    var isFullscreen = state === 'open' && isParentMobile;

    // Track state changes (no transition - instant resize)
    lastState = state;

    if (isFullscreen) {
      // Mobile fullscreen: cover entire viewport
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.height = '100dvh'; // Dynamic viewport height for mobile browsers
      iframe.style.margin = '0';
      iframe.style.padding = '0';
      iframe.style.border = 'none';
      iframe.style.zIndex = '999999';
      iframe.style.borderRadius = '0';
      iframe.style.boxShadow = 'none';

      // Lock body scroll on mobile and reset any margins
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
    } else {
      // Desktop or closed: corner positioning
      iframe.style.position = 'fixed';
      iframe.style.top = 'auto';
      iframe.style.left = 'auto';
      iframe.style.bottom = isParentMobile ? '12px' : '16px';
      iframe.style.right = isParentMobile ? '12px' : '16px';
      // Only apply numeric (pixel) dimensions on desktop — ignore '100vw'/'100vh' strings
      // which the widget may send during a race condition before it receives parent info
      if (typeof w === 'number') iframe.style.width = w + 'px';
      if (typeof h === 'number') iframe.style.height = h + 'px';
      iframe.style.zIndex = '9999';
      iframe.style.borderRadius = '16px';
      iframe.style.boxShadow = 'none';

      // Restore body scroll and margins
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
    }
  });

  console.log('[ChatWidget] Embed helper loaded successfully');
})();
