# Fix: Admin Dashboard Widget Domain Issue

## Problem
The admin dashboard widget was showing "Company not found for this domain" error because:
- Admin dashboard URL: `aibot666.onrender.com`
- Widget automatically detects domain from `window.location.hostname`
- Companies table only has `company-a.local` and `company-b.local` registered
- The Render domain `aibot666.onrender.com` was not registered in the companies table

## Solution
Added a `domain` parameter to the widget initialization to override automatic domain detection.

### Changes Made

#### 1. Widget Core (`frontend/widget/src/embed.js`)
- Added `domain` parameter to `init()` config
- Passes domain to ChatWidget component

#### 2. ChatWidget Component (`frontend/widget/src/ChatWidget.jsx`)
- Accepts `domain` prop
- Passes domain to chatStore on initialization

#### 3. Chat Store (`frontend/widget/src/store/chatStore.js`)
- Added `domain` state
- Updated `initialize()` to accept domain parameter
- Modified `createSession()`, `sendMessage()`, and `loadHistory()` to use domain override if provided
- Falls back to `window.location.hostname` if no override

#### 4. Admin Dashboard (`frontend/admin/index.html`)
- Reads selected company domain from localStorage
- Passes domain to widget init configuration
- Default fallback to `company-a.local`

## Usage

### Standard Embedding (Auto-detect domain)
```html
<script src="https://aibot666.onrender.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://aibot666.onrender.com',
    position: 'bottom-right',
    primaryColor: '#3b82f6'
  });
</script>
```

### Admin Dashboard (Override domain)
```html
<script>
  const selectedDomain = localStorage.getItem('selected_company_domain') || 'company-a.local';

  InsuranceChatWidget.init({
    apiUrl: 'https://aibot666.onrender.com',
    position: 'bottom-right',
    primaryColor: '#3b82f6',
    domain: selectedDomain // Override automatic detection
  });
</script>
```

## Testing

1. **Admin Dashboard**: The widget now uses the selected company from the CompanySelector dropdown
2. **Client Websites**: Widgets embedded on `company-a.local` or `company-b.local` continue to work with automatic domain detection
3. **Domain Override**: Any deployment can specify which company's data to use via the `domain` parameter

## Deployment

After making these changes:
1. Built widget: `cd frontend/widget && npm run build`
2. Copied to backend: `cp dist/widget.* backend/public/`
3. Deploy backend with updated widget files
4. Admin dashboard will now work with the selected company's knowledge base

## Alternative Solution (Not Recommended)

You could also add the Render domain to the companies table:
```sql
UPDATE public.companies
SET additional_domains = array_append(additional_domains, 'aibot666.onrender.com')
WHERE schema_name = 'company_a';
```

However, this approach is less flexible because:
- It ties the admin dashboard to a single company
- Can't test different companies in the admin interface
- Requires database changes for new domains
