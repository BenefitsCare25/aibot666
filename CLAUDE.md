# AI Chatbot Project - Claude Code Instructions

## Project Overview

This is an AI chatbot widget that can be embedded on client websites (e.g., Inspro, CBRE). The widget supports both direct script embedding and iframe embedding.

## Widget Deployment Architecture

### How Client Updates Work Automatically

Clients use an **iframe embed** approach with a hosted helper script. This means:

1. **Widget files are hosted on Azure**: `https://app-aibot-api.azurewebsites.net/`
2. **Clients only reference our hosted files** - they don't host widget code themselves
3. **Any updates we push automatically apply** to all client sites

### Client Embed Code (Iframe Only)

Clients embed this code on their website (get from Admin Portal → Company Management → Embed Code):

```html
<!-- Company Name AI Chatbot Widget -->
<iframe
  id="chat-widget-iframe"
  src="https://app-aibot-api.azurewebsites.net/chat?company=COMPANY_ID&color=%233b82f6"
  style="position: fixed; bottom: 16px; right: 16px; width: 200px; height: 80px; border: none; background: transparent; z-index: 9999; transition: all 0.3s ease;"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  allow="clipboard-write"
  allowtransparency="true"
  title="Company Name Chat Widget">
</iframe>

<!-- Embed Helper Script (handles mobile fullscreen automatically) -->
<script src="https://app-aibot-api.azurewebsites.net/embed-helper.js"></script>
```

**Note:** Only iframe embed is supported. Auto-initialize and manual-initialize methods have been removed.

### Files That Auto-Update on Client Sites

| File | Location | Purpose |
|------|----------|---------|
| `widget.iife.js` | `backend/public/` | Main widget JavaScript |
| `widget.css` | `backend/public/` | Widget styles |
| `embed-helper.js` | `backend/public/` | Iframe resize/fullscreen handler |

**When you update these files and push to GitHub → Azure deploys → All client sites get the update automatically.**

## How to Update the Widget

### Step 1: Make Changes to Widget Source

Widget source files are in `frontend/widget/src/`:

```
frontend/widget/src/
├── ChatWidget.jsx       # Main widget component
├── index.css            # Widget styles (Tailwind + custom)
├── components/
│   ├── ChatWindow.jsx   # Chat interface
│   ├── ChatButton.jsx   # Floating button
│   ├── MessageInput.jsx # Input area
│   ├── MessageList.jsx  # Message display
│   ├── LoginForm.jsx    # Authentication form
│   └── ...
└── store/
    └── chatStore.js     # Zustand state management
```

### Step 2: Build Widget (One Command)

```bash
cd backend
npm run build-widget
```

This single command:
1. Builds the widget in `frontend/widget`
2. Copies `widget.iife.js` and `widget.css` to `backend/public/`
3. Regenerates SRI hashes (required for security integrity checks)

**IMPORTANT:** Always use `npm run build-widget` instead of building manually. If SRI hashes are not regenerated after a build, the widget will silently fail to load on client sites.

### Step 3: Commit and Push

```bash
git add -A
git commit -m "fix: description of changes"
git push origin main
```

GitHub Actions will automatically deploy to Azure.

## Key Files Reference

### Backend Public Files (Hosted Assets)

| File | Purpose |
|------|---------|
| `backend/public/widget.iife.js` | Compiled widget JS |
| `backend/public/widget.css` | Compiled widget CSS |
| `backend/public/embed-helper.js` | Iframe communication script |
| `backend/public/test-iframe-mobile.html` | Test page for iframe embed |

### Embed Helper Script (`embed-helper.js`)

This script handles:
- **Mobile fullscreen**: Expands iframe to full viewport on mobile when chat opens
- **Desktop positioning**: Keeps widget in bottom-right corner
- **Body scroll lock**: Prevents background scrolling on mobile
- **Safe area handling**: Accounts for notches and home indicators

When updating mobile/desktop behavior, update this file.

### Admin Portal Embed Code Generator

Location: `backend/api/routes/admin.js` (around line 1512-1526)

This generates the embed code shown in Admin Portal → Company Management → Embed Code.

## Mobile Requirements

### Must Support:
1. **Full-screen mode on mobile** (viewport < 640px)
2. **Safe area insets** for notched devices (iPhone)
3. **Dynamic viewport height** (`100dvh`) for mobile browsers with address bars
4. **Body scroll lock** when chat is open

### Key CSS Properties:
```css
/* For mobile fullscreen */
height: 100dvh;
height: -webkit-fill-available;
padding-bottom: env(safe-area-inset-bottom);
```

### Key JavaScript (embed-helper.js):
```javascript
// Mobile fullscreen detection
var isMobile = window.innerWidth < 640;
var isFullscreen = state === 'open' && isMobile;

// Fullscreen positioning
iframe.style.top = '0';
iframe.style.left = '0';
iframe.style.right = '0';
iframe.style.bottom = '0';
iframe.style.width = '100vw';
iframe.style.height = '100dvh';
```

## Testing

### Test Page for Iframe Embed
URL: `https://app-aibot-api.azurewebsites.net/test-iframe-mobile.html`

Use this to test mobile fullscreen behavior before telling clients to update.

### Admin Portal
URL: `https://gray-flower-0e68c8a00-preview.eastasia.6.azurestaticapps.net/`

Use Company Management → Embed Code to see the current embed code.

## Deployment

- **Backend**: Azure Web App (`app-aibot-api.azurewebsites.net`)
- **Frontend Admin**: Azure Static Web Apps
- **Auto-deploy**: Push to `main` branch triggers GitHub Actions

## Iframe Dynamic Resize Mechanism

The widget dynamically resizes the iframe to fit its content. This is critical for proper display.

### How It Works (Two-Part System)

**Part 1: Widget sends size to parent** (`ChatWidget.jsx`):
```javascript
// Widget measures content and sends postMessage to parent
window.parent.postMessage({
  type: 'chatWidgetResize',
  width: 380,
  height: calculatedHeight,
  state: 'open' // or 'closed'
}, '*');
```

**Part 2: Parent resizes iframe** (`embed-helper.js`):
```javascript
// Parent listens for messages and resizes iframe
window.addEventListener('message', function(event) {
  if (event.data.type === 'chatWidgetResize') {
    iframe.style.width = event.data.width + 'px';
    iframe.style.height = event.data.height + 'px';
  }
});
```

### Key Implementation Details

**Content measurement** (`ChatWidget.jsx` lines ~158-180):
- Uses `data-chat-content` attribute on LoginForm/ChatWindow to target the actual content
- `scrollHeight` measures the natural content height
- Multiple delayed measurements (50ms, 150ms, 300ms) ensure content is fully rendered
- ResizeObserver + MutationObserver detect content changes (e.g., form expansion)

**Size states:**
| State | Width | Height | Notes |
|-------|-------|--------|-------|
| Closed (button only) | 80px | 80px | Fixed size |
| Open - Teaser | 380px | ~280px | 2 options + footer |
| Open - Form | 380px | up to 700px | Expands to fit form |
| Mobile Open | 100vw | 100dvh | Fullscreen |

**Critical CSS for measurement:**
```javascript
// Container must NOT constrain height (ChatWidget.jsx)
isInIframe ? {
  position: 'relative',
  width: '100%'
  // NO minHeight - let content determine height
}
```

### Adding New Content Components

When creating new components that display in the widget:

1. **Add `data-chat-content` attribute** to the root element:
```jsx
<div style={containerStyle} data-chat-content>
  {/* content */}
</div>
```

2. **Avoid fixed heights** - let content flow naturally

3. **Test resize behavior** - verify iframe resizes when content changes

### Debugging Resize Issues

**Content cut off:**
- Check if `data-chat-content` attribute is present
- Verify no `overflow: hidden` on parent containers constraining height
- Add more measurement delays if content renders slowly

**Extra whitespace:**
- Check for `minHeight` or `height: 100%` on containers
- Ensure `scrollHeight` is measuring actual content, not iframe size

**Resize not triggering:**
- Verify MutationObserver is watching for DOM changes
- Check that content changes are in the observed subtree

### Test the resize behavior:
URL: `https://app-aibot-api.azurewebsites.net/test-iframe-mobile.html`

Click through different states (teaser → form → back) and verify iframe resizes smoothly.

## Common Issues & Fixes

### Mobile input area cut off
- Add `paddingBottom: env(safe-area-inset-bottom)` to input container
- Use `height: 100%` instead of `height: 100vh` in containers

### Widget flickering on load
- Ensure CSS has default positioning (`bottom: 16px; right: 16px`)
- Use CSS classes instead of inline styles for state changes

### Iframe not going fullscreen on mobile
- Update `embed-helper.js` with proper fullscreen logic
- Ensure `top: 0; left: 0; right: 0; bottom: 0` are all set

## Client Communication

**Clients do NOT need to update their code for:**
- Bug fixes
- UI improvements
- Mobile optimizations
- New features (that don't require new parameters)

**Clients NEED to update their code for:**
- API URL changes
- New required parameters
- Breaking changes to iframe ID
