const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 12'];

  const context = await browser.newContext({
    ...iPhone,
    bypassCSP: true,
  });

  const page = await context.newPage();

  // Navigate to staging site
  console.log('Navigating to staging site...');
  await page.goto('https://benefits-staging.inspro.com.sg/cbre', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait for widget to load
  await page.waitForTimeout(3000);

  // Check for iframes
  const iframes = await page.$$('iframe');
  console.log('Found', iframes.length, 'iframes');

  // Check for widget in main page
  let widgetRoot = await page.$('#insurance-chat-widget-root');
  console.log('Widget root in main page:', widgetRoot ? 'FOUND' : 'NOT FOUND');

  // Look for any element with the chat widget class
  const anyWidget = await page.evaluate(() => {
    // Check all elements
    const allElements = document.querySelectorAll('*');
    const results = [];
    for (const el of allElements) {
      if (el.id && el.id.includes('widget')) {
        results.push({ id: el.id, tag: el.tagName });
      }
      if (el.id && el.id.includes('chat')) {
        results.push({ id: el.id, tag: el.tagName });
      }
    }
    return results;
  });
  console.log('Elements with widget/chat in ID:', anyWidget);

  // Screenshot 1: Initial state
  console.log('Taking screenshot of initial state...');
  await page.screenshot({ path: 'mobile-test-1-initial.png', fullPage: false });

  // Try to find any button that looks like a chat button
  const allButtons = await page.$$('button');
  console.log('Found', allButtons.length, 'buttons');

  // Look for the chat button by its position (bottom right)
  const viewport = page.viewportSize();
  console.log('Viewport:', viewport);

  // Try clicking at the position where the button should be (bottom-right)
  const clickX = viewport.width - 40;
  const clickY = viewport.height - 40;
  console.log('Clicking at position:', clickX, clickY);

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(2000);

  // Screenshot 2: After clicking
  console.log('Taking screenshot after click...');
  await page.screenshot({ path: 'mobile-test-2-opened.png', fullPage: false });

  // Check if widget root now exists with fullscreen class
  const stylesAfter = await page.evaluate(() => {
    const el = document.getElementById('insurance-chat-widget-root');
    if (el) {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        bottom: computed.bottom,
        right: computed.right,
        top: computed.top,
        left: computed.left,
        width: computed.width,
        height: computed.height,
        classes: el.className,
        hasFullscreenClass: el.classList.contains('ic-mobile-fullscreen')
      };
    }
    return null;
  });
  console.log('Widget root styles AFTER clicking:', stylesAfter);

  await browser.close();
  console.log('Done!');
})();
