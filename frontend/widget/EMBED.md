# Insurance Chat Widget - Embedding Guide

## Quick Start

Add this chat widget to any website with just 2 lines of code!

### Method 1: Script Tag (Recommended)

Add this code before the closing `</body>` tag:

```html
<script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://insurance-chatbot-api.onrender.com'
  });
</script>
```

### Method 2: Script Tag with Data Attributes (Auto-Init)

```html
<script
  src="https://your-widget-domain.onrender.com/widget.iife.js"
  data-api-url="https://insurance-chatbot-api.onrender.com"
  data-position="bottom-right"
  data-color="#3b82f6"
></script>
```

### Method 3: iFrame Embed

```html
<iframe
  src="https://your-widget-domain.onrender.com"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 999999;"
></iframe>
```

---

## Configuration Options

### JavaScript Configuration

```javascript
InsuranceChatWidget.init({
  // Required: Your backend API URL
  apiUrl: 'https://insurance-chatbot-api.onrender.com',

  // Optional: Widget position
  position: 'bottom-right', // or 'bottom-left'

  // Optional: Primary color (hex)
  primaryColor: '#3b82f6',

  // Optional: Custom container ID
  containerId: 'insurance-chat-widget-root'
});
```

### Data Attributes Configuration

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-api-url` | Required | Your backend API endpoint |
| `data-position` | `bottom-right` | Widget position: `bottom-right` or `bottom-left` |
| `data-color` | `#3b82f6` | Primary color in hex format |

---

## Integration Examples

### WordPress

Add to your theme's `footer.php` before `</body>`:

```php
<script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://insurance-chatbot-api.onrender.com',
    primaryColor: '<?php echo get_theme_mod('primary_color', '#3b82f6'); ?>'
  });
</script>
```

### React

```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://your-widget-domain.onrender.com/widget.iife.js';
    script.async = true;

    script.onload = () => {
      window.InsuranceChatWidget.init({
        apiUrl: 'https://insurance-chatbot-api.onrender.com'
      });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div>Your App</div>;
}
```

### Next.js

Add to `pages/_document.js`:

```jsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />

        <script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              InsuranceChatWidget.init({
                apiUrl: 'https://insurance-chatbot-api.onrender.com'
              });
            `,
          }}
        />
      </body>
    </Html>
  );
}
```

### Vue.js

Add to `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>My App</title>
  </head>
  <body>
    <div id="app"></div>

    <script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        InsuranceChatWidget.init({
          apiUrl: 'https://insurance-chatbot-api.onrender.com'
        });
      });
    </script>
  </body>
</html>
```

### Shopify

1. Go to **Online Store** → **Themes**
2. Click **Actions** → **Edit code**
3. Open `layout/theme.liquid`
4. Add before `</body>`:

```liquid
<script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://insurance-chatbot-api.onrender.com',
    primaryColor: '{{ settings.color_primary }}'
  });
</script>
```

### HTML/Static Sites

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Website</title>
</head>
<body>
  <!-- Your website content -->
  <h1>Welcome to My Website</h1>

  <!-- Insurance Chat Widget -->
  <script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
  <script>
    InsuranceChatWidget.init({
      apiUrl: 'https://insurance-chatbot-api.onrender.com',
      position: 'bottom-right',
      primaryColor: '#2563eb'
    });
  </script>
</body>
</html>
```

---

## Customization

### Change Widget Position

```javascript
InsuranceChatWidget.init({
  apiUrl: 'https://insurance-chatbot-api.onrender.com',
  position: 'bottom-left' // Move to left corner
});
```

### Custom Brand Colors

```javascript
InsuranceChatWidget.init({
  apiUrl: 'https://insurance-chatbot-api.onrender.com',
  primaryColor: '#10b981' // Green
  // Or use your brand color: '#FF5733'
});
```

### Hide on Specific Pages

```html
<script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
<script>
  // Only show on /employee-portal pages
  if (window.location.pathname.startsWith('/employee-portal')) {
    InsuranceChatWidget.init({
      apiUrl: 'https://insurance-chatbot-api.onrender.com'
    });
  }
</script>
```

---

## Features

- **Floating Chat Button**: Appears in bottom-right (or left) corner
- **Employee Authentication**: Requires employee ID to start chatting
- **Session Persistence**: Saves session in browser localStorage
- **Real-time Messaging**: Instant responses from AI
- **Confidence Scores**: Shows AI confidence level
- **Source Attribution**: Displays knowledge base sources
- **Escalation Handling**: Automatically escalates low-confidence queries
- **Responsive Design**: Works on mobile and desktop
- **CSS Isolation**: Won't conflict with your website styles
- **Async Loading**: Doesn't slow down your page load

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Security

- **CORS Protected**: Only allowed origins can access API
- **No Cookies**: Uses localStorage for session management
- **Secure Communication**: HTTPS only in production
- **Input Validation**: All user inputs sanitized
- **Rate Limited**: Prevents API abuse

---

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify `apiUrl` is correct
3. Ensure script loads successfully (check Network tab)
4. Check if container div exists: `document.getElementById('insurance-chat-widget-root')`

### CORS Errors

Make sure your backend `CORS_ORIGIN` environment variable includes your website domain:

```env
CORS_ORIGIN=https://your-website.com,https://your-widget.onrender.com
```

### Widget Covered by Other Elements

Increase z-index in container:

```javascript
document.getElementById('insurance-chat-widget-root').style.zIndex = '9999999';
```

### Session Not Persisting

Check if localStorage is enabled:

```javascript
console.log(localStorage.getItem('insurance_chat_session'));
```

---

## Performance

- **Bundle Size**: ~150KB gzipped (includes React)
- **Load Time**: <1 second on 3G
- **Async Loading**: Doesn't block page rendering
- **Lazy Initialization**: Only loads when needed

---

## Support

For issues or questions:
- Email: support@company.com
- GitHub: Create an issue at your repository
- Documentation: See README.md

---

## Example: Complete Integration

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Employee Portal</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Employee Insurance Portal</h1>
    <p>Welcome! Need help? Use the chat widget in the bottom-right corner.</p>
  </header>

  <main>
    <section>
      <h2>Your Benefits</h2>
      <p>View your insurance coverage, submit claims, and more.</p>
    </section>
  </main>

  <!-- Insurance Chat Widget -->
  <script src="https://your-widget-domain.onrender.com/widget.iife.js"></script>
  <script>
    InsuranceChatWidget.init({
      apiUrl: 'https://insurance-chatbot-api.onrender.com',
      position: 'bottom-right',
      primaryColor: '#2563eb'
    });
  </script>
</body>
</html>
```

Save this as `index.html` and open in a browser to see the widget in action!

---

**Ready to embed?** Copy the code above and paste it into your website!
