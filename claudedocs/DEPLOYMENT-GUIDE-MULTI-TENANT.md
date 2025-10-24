# Multi-Tenant Deployment Guide for Render

This guide covers deploying the multi-tenant insurance chatbot system to Render.

## Overview

Your multi-tenant architecture consists of:
- **Backend API**: Node.js/Express server with multi-tenant middleware
- **Admin Dashboard**: React SPA for managing multiple companies
- **Chat Widget**: Embeddable chat widget that sends domain information
- **Supabase Database**: PostgreSQL with schema-per-company isolation

---

## Prerequisites

- [x] Supabase database with multi-tenant setup complete
- [x] Test data loaded for Company A and Company B
- [x] Frontend builds completed (`widget` and `admin`)
- [ ] Render account created
- [ ] Environment variables ready

---

## Part 1: Backend Deployment

### 1.1 Create Backend Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- Name: `insurance-chatbot-backend` (or your preferred name)
- Region: Choose closest to your users
- Branch: `main`
- Root Directory: `backend`
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

**Environment Variables:**

Add the following environment variables (Click "Environment" tab):

```
NODE_ENV=production
PORT=3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Redis Configuration (Render Redis)
REDIS_URL=redis://red-xxxxx:6379

# Telegram Bot (Optional - for escalations)
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here

# CORS Configuration
ALLOWED_ORIGINS=https://your-admin-domain.onrender.com,https://company-a.com,https://company-b.com
```

**Important Notes:**
- Get `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY` from Supabase Dashboard → Settings → API
- Add all company domains to `ALLOWED_ORIGINS` (comma-separated, no spaces)

### 1.2 Create Redis Instance

1. In Render Dashboard, click **"New +"** → **"Redis"**
2. Configure:
   - Name: `insurance-chatbot-redis`
   - Plan: Free (or paid for production)
   - Region: Same as backend
3. Once created, copy the **Internal Redis URL**
4. Add it as `REDIS_URL` environment variable in your backend service

### 1.3 Deploy Backend

1. Click **"Create Web Service"**
2. Render will automatically deploy
3. Wait for deployment to complete (check logs)
4. Note the backend URL: `https://insurance-chatbot-backend.onrender.com`

---

## Part 2: Admin Dashboard Deployment

### 2.1 Create Admin Service

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:

**Basic Settings:**
- Name: `insurance-chatbot-admin`
- Branch: `main`
- Root Directory: `frontend/admin`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

**Environment Variables:**

```
VITE_API_URL=https://insurance-chatbot-backend.onrender.com
```

### 2.2 Deploy Admin Dashboard

1. Click **"Create Static Site"**
2. Wait for deployment
3. Your admin dashboard will be available at: `https://insurance-chatbot-admin.onrender.com`

---

## Part 3: Widget Deployment

### 3.1 Create Widget Service

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:

**Basic Settings:**
- Name: `insurance-chatbot-widget`
- Branch: `main`
- Root Directory: `frontend/widget`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

**Environment Variables:**

```
VITE_API_URL=https://insurance-chatbot-backend.onrender.com
```

### 3.2 Deploy Widget

1. Click **"Create Static Site"**
2. Wait for deployment
3. Widget files will be available at: `https://insurance-chatbot-widget.onrender.com`

---

## Part 4: Update CORS Configuration

### 4.1 Update Backend CORS

Edit `backend/api/middleware/cors.js`:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://insurance-chatbot-admin.onrender.com',
  'https://insurance-chatbot-widget.onrender.com',
  'https://company-a.com',  // Add your actual company domains
  'https://company-b.com',
  'https://www.company-a.com',
  'https://www.company-b.com'
];
```

Commit and push changes. Render will auto-deploy.

---

## Part 5: Widget Integration for Companies

### 5.1 Widget Embed Code

Provide this code to Company A and Company B to embed the widget on their websites:

```html
<!-- Insurance Chat Widget -->
<script>
  // Load widget CSS
  const widgetCSS = document.createElement('link');
  widgetCSS.rel = 'stylesheet';
  widgetCSS.href = 'https://insurance-chatbot-widget.onrender.com/widget.css';
  document.head.appendChild(widgetCSS);

  // Load widget JavaScript
  const widgetScript = document.createElement('script');
  widgetScript.src = 'https://insurance-chatbot-widget.onrender.com/widget.iife.js';
  widgetScript.async = true;

  widgetScript.onload = function() {
    // Initialize widget
    if (window.InsuranceChatWidget) {
      window.InsuranceChatWidget.init({
        apiUrl: 'https://insurance-chatbot-backend.onrender.com',
        position: 'bottom-right',
        primaryColor: '#3b82f6'  // Customize per company
      });
    }
  };

  document.body.appendChild(widgetScript);
</script>
```

**Company-Specific Customization:**

For **Company A** (use their brand color):
```javascript
primaryColor: '#3b82f6'  // Company A blue
```

For **Company B** (use their brand color):
```javascript
primaryColor: '#10b981'  // Company B green
```

### 5.2 Widget Automatic Domain Detection

The widget automatically detects the domain it's running on and sends it in the `X-Widget-Domain` header. No additional configuration needed!

**How it works:**
1. Employee visits `company-a.com` and opens chat widget
2. Widget captures `window.location.hostname` = `company-a.com`
3. Widget sends `X-Widget-Domain: company-a.com` header with all API requests
4. Backend middleware extracts domain and routes to `company_a` schema
5. Employee sees only Company A's data (employees, knowledge base, etc.)

---

## Part 6: Testing Multi-Tenant Deployment

### 6.1 Test Company A

1. Open `https://company-a.com` (with widget embedded)
2. Click chat widget
3. Login with: `EMP001`
4. Expected: See "Alice Anderson" (Company A employee)
5. Ask: "What are my dental benefits?"
6. Expected: "$2,000 annual limit for Premium plan" (Company A data)

### 6.2 Test Company B

1. Open `https://company-b.com` (with widget embedded)
2. Click chat widget
3. Login with: `EMP001`
4. Expected: See "David Davis" (Company B employee)
5. Ask: "What are my dental benefits?"
6. Expected: "$1,000 annual limit for Basic plan" (Company B data)

### 6.3 Verify Data Isolation

**Critical Test:**
- Company A's EMP001 = Alice Anderson
- Company B's EMP001 = David Davis
- These should NEVER cross-contaminate

**Check backend logs:**
```
[POST] /api/chat/session - Company: Company A (company_a)
[POST] /api/chat/session - Company: Company B (company_b)
```

---

## Part 7: Admin Dashboard Usage

### 7.1 Access Admin Dashboard

1. Navigate to: `https://insurance-chatbot-admin.onrender.com`
2. You'll see the company selector in the header
3. Select "Company A" or "Company B" from dropdown

### 7.2 Company Selector Behavior

When you select a company:
- All API requests include `X-Widget-Domain` header with selected company's domain
- Admin sees only that company's data (employees, KB, chat history, etc.)
- Page reloads to apply new company context

### 7.3 Managing Companies

**Current Companies:**
- Company A: `company-a.local` → schema `company_a`
- Company B: `company-b.local` → schema `company_b`

**To add new company:**
1. Run new company schema SQL in Supabase (use templates in `backend/config/supabase-setup/`)
2. Insert company record in `public.companies` table
3. Refresh admin dashboard - new company appears in dropdown

---

## Part 8: Environment-Specific Configuration

### 8.1 Local Development

**Widget:**
```env
VITE_API_URL=http://localhost:3000
```

**Admin:**
```env
VITE_API_URL=http://localhost:3000
```

**Backend:**
```env
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 8.2 Production (Render)

**Widget:**
```env
VITE_API_URL=https://insurance-chatbot-backend.onrender.com
```

**Admin:**
```env
VITE_API_URL=https://insurance-chatbot-backend.onrender.com
```

**Backend:**
```env
NODE_ENV=production
ALLOWED_ORIGINS=https://insurance-chatbot-admin.onrender.com,https://company-a.com,https://company-b.com
```

---

## Part 9: Monitoring and Logs

### 9.1 Backend Logs

View in Render Dashboard → Your Backend Service → Logs

**Look for:**
```
[Cache Hit] Company found for domain: company-a.com
[DB Lookup] Company found: Company A (company_a)
[POST] /api/chat/session - Company: Company A (company_a)
```

### 9.2 Error Monitoring

**Common errors:**
- `"Company not found for this domain"` → Domain not registered in `public.companies`
- `"relation does not exist"` → Schema not created in Supabase
- `"Employee not found"` → Employee doesn't exist in company's schema

**Fix:**
1. Check domain mapping in `public.companies`
2. Verify schema exists in Supabase
3. Check employee data in correct schema

---

## Part 10: Security Checklist

- [ ] All environment variables set correctly
- [ ] `SUPABASE_SERVICE_KEY` kept secure (never commit to git)
- [ ] CORS configured with only allowed domains
- [ ] Redis password protected (Render handles this)
- [ ] Rate limiting enabled in production
- [ ] HTTPS enforced on all services
- [ ] Company data isolation verified through testing

---

## Part 11: Troubleshooting

### Issue: Widget not loading

**Check:**
1. Widget URL is correct: `https://insurance-chatbot-widget.onrender.com/widget.iife.js`
2. CORS allows the company domain
3. Check browser console for errors

**Fix:**
```javascript
// Add company domain to backend CORS
const allowedOrigins = [
  // ... existing origins
  'https://company-a.com'
];
```

### Issue: Wrong company data showing

**Check:**
1. Backend logs show correct domain detection
2. Domain normalized correctly (no `www`, protocol, etc.)
3. Company registered in `public.companies` with correct domain

**Fix:**
```sql
-- Verify company registration
SELECT domain, schema_name FROM public.companies;

-- Check domain normalization
-- Should be: 'company-a.com' NOT 'www.company-a.com' or 'https://company-a.com'
```

### Issue: Admin dashboard shows no data

**Check:**
1. Company selected in dropdown
2. `X-Widget-Domain` header sent with requests (check Network tab)
3. Company has test data in Supabase

**Fix:**
- Select company from dropdown
- Clear localStorage and refresh
- Verify test data: `SELECT * FROM company_a.employees;`

---

## Part 12: Scaling Considerations

### Add New Company

**Steps:**
1. Create new schema SQL (copy from `03-company-a-schema.sql`)
2. Run in Supabase SQL Editor
3. Insert company record:
   ```sql
   INSERT INTO public.companies (name, domain, schema_name, status)
   VALUES ('Company C', 'company-c.com', 'company_c', 'active');
   ```
4. Load test data for new company
5. Add domain to backend CORS
6. Company automatically appears in admin dropdown

### Performance Optimization

**For 10+ companies:**
- Enable Redis caching (already configured)
- Company lookups cached for 5 minutes
- Schema clients cached in memory
- Consider connection pooling for Supabase

**For 100+ companies:**
- Implement company sharding
- Dedicated Supabase instances per region
- CDN for widget distribution
- Load balancing for backend

---

## Summary

Your multi-tenant system is now deployed with:

- ✅ Backend API handling multiple companies via domain detection
- ✅ Admin dashboard with company selector
- ✅ Chat widget auto-detecting company domain
- ✅ Complete data isolation per company schema
- ✅ Test data for Company A and Company B

**Next Steps:**
1. Deploy to Render following this guide
2. Test with real company domains
3. Monitor logs and performance
4. Add more companies as needed

---

## Support

**Common Commands:**

```bash
# Rebuild widget
cd frontend/widget && npm run build

# Rebuild admin
cd frontend/admin && npm run build

# Test locally
cd backend && npm run dev
```

**Render Auto-Deploy:**
- Push to `main` branch → Automatic deployment
- Check "Deploy" tab in Render for status

**Database Changes:**
- Run SQL in Supabase SQL Editor
- Changes are instant (no deployment needed)
