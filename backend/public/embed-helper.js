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

  // Ensure allow-downloads is in sandbox (for LOG form PDF downloads)
  var sandbox = iframe.getAttribute('sandbox');
  if (sandbox && sandbox.indexOf('allow-downloads') === -1) {
    iframe.setAttribute('sandbox', sandbox + ' allow-downloads');
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

  // Fallback timeouts in case the load event fires before the widget's
  // message listener is registered (common on slower browsers like Safari)
  setTimeout(sendParentInfo, 100);
  setTimeout(sendParentInfo, 500);
  setTimeout(sendParentInfo, 1500);

  // Update mobile detection when parent window resizes (not the iframe)
  window.addEventListener('resize', function() {
    var newIsMobile = window.innerWidth < 640;
    if (newIsMobile !== isParentMobile) {
      isParentMobile = newIsMobile;
      sendParentInfo();
    }
  });

  // Determine the expected widget origin from the iframe src
  var widgetOrigin = '';
  try {
    widgetOrigin = new URL(iframe.src).origin;
  } catch (e) {
    console.warn('[ChatWidget] Could not parse iframe src origin');
  }

  // Handle messages from the widget (with origin validation)
  window.addEventListener('message', function(event) {
    if (!event.data) return;

    // SECURITY: Validate message origin matches the widget iframe origin
    if (widgetOrigin && event.origin !== widgetOrigin) {
      return;
    }

    // Widget signals it has mounted and is ready to receive viewport info.
    // Respond immediately with parent viewport dimensions.
    // This is more reliable than a fixed timeout, especially on Safari where
    // cross-origin postMessage delivery is slower.
    if (event.data.type === 'chatWidgetReady') {
      console.log('[CW:debug] chatWidgetReady received → sending parentInfo (isMobile:', isParentMobile, ')');
      sendParentInfo();
      return;
    }

    // Handle file download requests from widget
    // Uses <a> navigation (not fetch) to avoid parent page CSP connect-src restrictions
    // Server returns Content-Disposition: attachment, so browser downloads without navigating away
    if (event.data.type === 'chatWidgetDownload') {
      // SECURITY: Only allow downloads from the widget's own API origin
      var downloadUrl = event.data.url || '';
      if (widgetOrigin && downloadUrl.indexOf(widgetOrigin) !== 0) {
        console.warn('[ChatWidget] Blocked download from untrusted URL:', downloadUrl);
        return;
      }
      var a = document.createElement('a');
      a.href = downloadUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Handle resize messages
    if (event.data.type !== 'chatWidgetResize') {
      return;
    }

    var state = event.data.state;
    var w = event.data.width;
    var h = event.data.height;
    var isFullscreen = state === 'open' && isParentMobile;

    console.log('[CW:debug] resize msg → state:', state,
      '| w:', w, '(type:', typeof w, ')',
      '| h:', h, '(type:', typeof h, ')',
      '| isParentMobile:', isParentMobile,
      '| isFullscreen:', isFullscreen);

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

  console.log('[CW:debug] embed-helper loaded | window.innerWidth:', window.innerWidth, '| isParentMobile:', isParentMobile);
})();
