# 🚀 Quick Start Guide

Get your AI insurance chatbot live in 30 minutes!

## What You'll Deploy

1. **Backend API** (handles AI requests)
2. **Chat Widget** (embeds on your website)
3. **Admin Dashboard** (manage data)

---

## Prerequisites (5 minutes)

1. **GitHub Account** - https://github.com
2. **Render Account** - https://render.com (sign up free)
3. **Supabase Account** - https://supabase.com (sign up free)
4. **Redis Cloud Account** - https://redis.com (sign up free)
5. **OpenAI API Key** - https://platform.openai.com/api-keys

---

## Step 1: Setup Services (10 minutes)

### A. Setup Redis Cloud

1. Go to https://redis.com/try-free/
2. Create account → New Database
3. Name: `insurance-chat`
4. Copy **Public Endpoint** and **Password**
5. Format as: `redis://default:PASSWORD@ENDPOINT`

### B. Setup Supabase

1. Go to https://supabase.com
2. New Project → Name: `insurance-chatbot`
3. Go to **Database** → **Extensions** → Enable `vector`
4. Go to **SQL Editor** → New Query
5. Copy contents of `backend/config/schema.sql` and run it
6. Go to **Settings** → **API**
7. Copy **Project URL** and **service_role key**

### C. Get OpenAI Key

1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Copy and save it

---

## Step 2: Push to GitHub (2 minutes)

```bash
cd aibot
git init
git add .
git commit -m "AI chatbot system"
git remote add origin https://github.com/YOUR_USERNAME/insurance-chatbot.git
git push -u origin main
```

---

## Step 3: Deploy Backend (5 minutes)

1. Go to https://dashboard.render.com
2. **New +** → **Web Service**
3. Connect GitHub → Select `insurance-chatbot` repo
4. Configure:
   - Name: `insurance-chatbot-api`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: Free
5. Click **Advanced** → Add Environment Variables:

```env
PORT=3000
NODE_ENV=production
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_TEMPERATURE=0
OPENAI_MAX_TOKENS=1000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
REDIS_URL=redis://default:password@your-endpoint.redis.cloud:port
REDIS_SESSION_TTL=3600
VECTOR_SIMILARITY_THRESHOLD=0.7
TOP_K_RESULTS=5
CONFIDENCE_THRESHOLD=0.7
MAX_CONTEXT_LENGTH=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
JWT_SECRET=your-random-32-char-secret
CORS_ORIGIN=*
```

6. **Create Web Service**
7. Wait for deploy (3-5 min)
8. Copy URL: `https://insurance-chatbot-api.onrender.com`

---

## Step 4: Deploy Chat Widget (3 minutes)

1. Go to Render Dashboard
2. **New +** → **Static Site**
3. Connect same GitHub repo
4. Configure:
   - Name: `insurance-chat-widget`
   - Root Directory: `frontend/widget`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
5. Add Environment Variable:
   ```env
   VITE_API_URL=https://insurance-chatbot-api.onrender.com
   ```
6. **Create Static Site**
7. Copy URL: `https://insurance-chat-widget.onrender.com`

---

## Step 5: Deploy Admin Dashboard (3 minutes)

1. Go to Render Dashboard
2. **New +** → **Static Site**
3. Connect same GitHub repo
4. Configure:
   - Name: `insurance-admin-dashboard`
   - Root Directory: `frontend/admin`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
5. Add Environment Variable:
   ```env
   VITE_API_URL=https://insurance-chatbot-api.onrender.com
   ```
6. **Create Static Site**
7. Copy URL: `https://insurance-admin-dashboard.onrender.com`

---

## Step 6: Embed Widget on Your Website (1 minute)

Add this code before `</body>` on your website:

```html
<script src="https://insurance-chat-widget.onrender.com/widget.iife.js"></script>
<script>
  InsuranceChatWidget.init({
    apiUrl: 'https://insurance-chatbot-api.onrender.com',
    position: 'bottom-right',
    primaryColor: '#3b82f6'
  });
</script>
```

**Done! Your chat widget is now live!** 🎉

---

## Step 7: Add Initial Data (5 minutes)

### A. Upload Employees

1. Go to `https://insurance-admin-dashboard.onrender.com/employees`
2. Click "Download Template"
3. Fill in employee data:
   - employee_id: EMP001
   - name: John Doe
   - email: john@company.com
   - policy_type: Premium
   - coverage_limit: 100000
   - etc.
4. Drag & drop Excel file to upload

### B. Add Knowledge Base

1. Go to `/knowledge` page
2. Click "Add Entry"
3. Add entries like:
   - Title: "Dental Coverage"
   - Content: "Our dental plan covers..."
   - Category: Benefits
4. Repeat for 5-10 entries

---

## Step 8: Test Everything (2 minutes)

### Test Widget

1. Visit your website
2. See chat widget in bottom-right corner
3. Click to open
4. Enter employee ID: `EMP001`
5. Send test question: "What is my dental coverage?"
6. Get AI response!

### Test Admin

1. Visit admin dashboard
2. Check Dashboard shows statistics
3. Verify employees are listed
4. Check knowledge base entries

---

## ✅ You're Live!

Your AI insurance chatbot is now running! 🚀

### Your URLs

- Backend API: `https://insurance-chatbot-api.onrender.com`
- Chat Widget: `https://insurance-chat-widget.onrender.com`
- Admin Dashboard: `https://insurance-admin-dashboard.onrender.com`

---

## Next Steps

1. **Add More Employees**: Upload full employee list via Excel
2. **Expand Knowledge Base**: Add more insurance policies and FAQs
3. **Setup Telegram** (optional): For human-in-the-loop escalations
4. **Customize Widget**: Change colors to match your brand
5. **Monitor Analytics**: Track usage and improve responses

---

## Troubleshooting

### Widget Not Showing

1. Check browser console for errors
2. Verify backend health: `https://your-backend.onrender.com/health`
3. Check CORS settings in backend

### API Errors

1. Check Render logs for backend
2. Verify all environment variables are set
3. Test Supabase connection
4. Verify OpenAI API key is valid

### Need Help?

- See `DEPLOYMENT.md` for detailed deployment guide
- See `WIDGET_GUIDE.md` for integration examples
- See `IMPLEMENTATION_COMPLETE.md` for full system overview

---

## Free vs Paid

### Free Tier (Perfect for Testing)

- Backend: Sleeps after 15 min inactivity
- Widget & Admin: Always on
- Cost: $10-50/month (OpenAI only)

### Paid Tier (For Production)

- Backend: Always on ($7/month)
- Better performance
- Cost: $92-242/month total

**Start free, upgrade when needed!**

---

## Summary

You've just deployed:

✅ AI-powered chatbot with GPT-4
✅ Embeddable widget (works on any website)
✅ Admin dashboard for management
✅ Vector database for smart responses
✅ Session management for 1000+ users
✅ Human-in-the-loop escalation system

**Total Time**: ~30 minutes
**Total Cost**: $10-50/month (free tier)

**Congratulations!** 🎉

Now your employees can get instant answers to insurance questions 24/7!

---

**Questions?** Check the documentation files in this repo.
