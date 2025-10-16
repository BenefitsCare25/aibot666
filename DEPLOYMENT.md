# Deployment Guide: AI Insurance Chatbot on Render

Complete step-by-step guide for deploying your AI chatbot system to production using Render, Redis Cloud, and Supabase.

## Prerequisites

Before you begin, ensure you have:

- GitHub account
- Render account (https://render.com)
- Redis Cloud account (https://redis.com/try-free/)
- Supabase project (already setup)
- OpenAI API key

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Production Stack                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (Render Static)  →  Backend (Render Web)      │
│       ↓                              ↓                   │
│  Widget Embed Code    →    Express API Server           │
│                              ↓        ↓        ↓         │
│                          Supabase  Redis   OpenAI        │
│                          (pgvector) Cloud   API          │
│                              ↓                           │
│                          Telegram Bot (HITL)             │
└─────────────────────────────────────────────────────────┘
```

---

## Part 1: Setup Redis Cloud

### Step 1: Create Redis Database

1. Go to https://redis.com/try-free/
2. Sign up and create a new account
3. Click **"New Database"**
4. Configure:
   - **Name**: `insurance-chatbot-sessions`
   - **Type**: Redis Stack (includes JSON support)
   - **Region**: Choose closest to your Render region
   - **Memory**: 30MB (free tier)
5. Click **"Activate Database"**

### Step 2: Get Redis Connection Details

1. Click on your database name
2. Navigate to **"Configuration"** tab
3. Copy these values:
   - **Public Endpoint**: `redis-xxxxx.redis.cloud:xxxxx`
   - **Password**: Click "show" to reveal
4. Format your Redis URL:
   ```
   redis://default:<password>@<endpoint>
   ```
   Example:
   ```
   redis://default:mypassword123@redis-12345.redis.cloud:12345
   ```

---

## Part 2: Prepare GitHub Repository

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `insurance-chatbot`
3. Description: `AI-powered insurance chatbot with RAG capabilities`
4. Privacy: Choose Public or Private
5. **DO NOT** initialize with README (we already have files)
6. Click **"Create repository"**

### Step 2: Push Your Code

Open terminal in your project directory:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: AI insurance chatbot system"

# Add remote repository (replace with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/insurance-chatbot.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify Upload

1. Refresh your GitHub repository page
2. Ensure you see:
   - `backend/` directory with all files
   - `frontend/` directory (we'll create this)
   - `README.md`
   - `.gitignore`
   - **IMPORTANT**: `.env` should NOT be visible (it's ignored)

---

## Part 3: Deploy Backend to Render

### Step 1: Create New Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository:
   - Click **"Connect account"** (if first time)
   - Grant access to your `insurance-chatbot` repository
   - Click **"Connect"** next to your repository

### Step 2: Configure Web Service

Fill in the deployment configuration:

| Field | Value |
|-------|-------|
| **Name** | `insurance-chatbot-api` |
| **Region** | Choose closest to you (e.g., Oregon, Singapore) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter $7/month for production) |

Click **"Advanced"** to expand additional settings.

### Step 3: Add Environment Variables

Click **"Add Environment Variable"** and add each of these:

#### Server Configuration
```env
PORT=3000
NODE_ENV=production
```

#### OpenAI Configuration
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_TEMPERATURE=0
OPENAI_MAX_TOKENS=1000
```

#### Supabase Configuration
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
```

#### Redis Configuration
```env
REDIS_URL=redis://default:your-password@your-endpoint.redis.cloud:port
REDIS_SESSION_TTL=3600
```

#### Telegram Bot (Optional)
```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-group-chat-id
```

#### RAG Configuration
```env
VECTOR_SIMILARITY_THRESHOLD=0.7
TOP_K_RESULTS=5
CONFIDENCE_THRESHOLD=0.7
MAX_CONTEXT_LENGTH=3000
```

#### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Security
```env
JWT_SECRET=your-very-long-random-secret-key-min-32-chars
CORS_ORIGIN=https://your-frontend-domain.onrender.com
```

**How to get these values:**

1. **OpenAI API Key**: https://platform.openai.com/api-keys
2. **Supabase Credentials**:
   - Login to Supabase → Your Project → Settings → API
   - Copy Project URL and anon/service keys
3. **Redis URL**: From Part 1 above
4. **Telegram Bot**:
   - Message @BotFather on Telegram
   - Send `/newbot` and follow instructions
   - Get chat ID using @userinfobot
5. **JWT Secret**: Generate with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will start building your application
3. Monitor the logs in real-time
4. Wait for: `✅ Build successful`
5. Then: `✅ Deploy live`

### Step 5: Verify Deployment

1. Copy your service URL: `https://insurance-chatbot-api.onrender.com`
2. Test health endpoint:
   ```bash
   curl https://insurance-chatbot-api.onrender.com/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-10-16T...",
     "uptime": 123,
     "redis": "connected"
   }
   ```

3. Test root endpoint:
   ```bash
   curl https://insurance-chatbot-api.onrender.com/
   ```

---

## Part 4: Setup Supabase Database

If you haven't already setup your Supabase database:

### Step 1: Enable pgvector Extension

1. Login to https://supabase.com
2. Select your project
3. Go to **Database** → **Extensions**
4. Find `vector` extension
5. Click **"Enable"**

### Step 2: Run Database Schema

1. Go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `backend/config/schema.sql`
4. Paste into the editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Wait for success message: `Success. No rows returned`

### Step 3: Verify Tables Created

1. Go to **Table Editor**
2. You should see these tables:
   - `employees`
   - `knowledge_base`
   - `chat_history`
   - `escalations`
   - `employee_embeddings`
   - `analytics`

---

## Part 5: Import Initial Data

### Step 1: Download Employee Template

```bash
curl https://insurance-chatbot-api.onrender.com/api/admin/employees/template -o template.xlsx
```

### Step 2: Fill Employee Data

Open `template.xlsx` in Excel and fill in:

| Column | Example |
|--------|---------|
| employee_id | EMP001 |
| name | John Doe |
| email | john.doe@company.com |
| policy_type | Premium |
| coverage_limit | 100000 |
| annual_claim_limit | 50000 |
| outpatient_limit | 5000 |
| dental_limit | 2000 |
| optical_limit | 1000 |
| policy_start_date | 2024-01-01 |
| policy_end_date | 2024-12-31 |

### Step 3: Upload Employee Data

```bash
curl -X POST https://insurance-chatbot-api.onrender.com/api/admin/employees/upload \
  -F "file=@template.xlsx"
```

Or use a tool like Postman/Insomnia for easier file uploads.

### Step 4: Add Knowledge Base Entries

Create a `knowledge.json` file:

```json
[
  {
    "title": "Premium Plan Dental Benefits",
    "content": "Premium plan members receive $2,000 annual dental coverage including preventive care, basic procedures, and major treatments. Coverage includes cleanings, fillings, root canals, and crowns.",
    "category": "benefits",
    "subcategory": "dental"
  },
  {
    "title": "Claims Submission Process",
    "content": "To submit a claim: 1. Complete claim form available on employee portal 2. Attach medical receipts and invoices 3. Submit within 30 days of treatment 4. Processing takes 5-7 business days 5. Reimbursement via bank transfer",
    "category": "claims",
    "subcategory": "procedures"
  },
  {
    "title": "Outpatient Coverage",
    "content": "Outpatient coverage includes doctor consultations, diagnostic tests, medication, and minor procedures. Annual limits vary by plan type: Basic ($3,000), Standard ($5,000), Premium ($10,000).",
    "category": "benefits",
    "subcategory": "outpatient"
  }
]
```

Upload via API:

```bash
curl -X POST https://insurance-chatbot-api.onrender.com/api/admin/knowledge/batch \
  -H "Content-Type: application/json" \
  -d @knowledge.json
```

---

## Part 6: Update CORS for Frontend

Once you deploy your frontend (next steps), update the CORS origin:

1. Go to Render dashboard
2. Click on `insurance-chatbot-api` service
3. Go to **Environment** tab
4. Find `CORS_ORIGIN` variable
5. Update value to:
   ```
   https://your-frontend-domain.onrender.com,https://insurance-chatbot-widget.onrender.com
   ```
   (Multiple domains separated by commas)
6. Save changes
7. Render will automatically redeploy

---

## Part 7: Monitoring and Maintenance

### Health Checks

Render automatically monitors your `/health` endpoint every 30 seconds.

### View Logs

1. Go to Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. View real-time application logs

### Auto-Deploy on Git Push

Render automatically deploys when you push to `main` branch:

```bash
# Make changes to your code
git add .
git commit -m "Update: your changes"
git push origin main

# Render will automatically:
# 1. Detect the push
# 2. Run npm install
# 3. Start npm start
# 4. Deploy new version
```

### Scaling

For production with high traffic:

1. Go to **Settings** → **Instance Type**
2. Upgrade to **Starter** ($7/month) or higher
3. Enable **Auto-Scaling** for horizontal scaling

### Monitoring Metrics

1. Go to **Metrics** tab to view:
   - CPU usage
   - Memory usage
   - Request count
   - Response times
   - Bandwidth usage

---

## Part 8: Setup Telegram Bot (Optional)

### Step 1: Create Bot with BotFather

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts:
   - Bot name: `Insurance Support Bot`
   - Username: `your_company_insurance_bot`
4. Copy the **bot token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Create Support Group

1. Create a new Telegram group
2. Add your bot to the group
3. Make bot an admin (required for sending messages)

### Step 3: Get Chat ID

1. Add `@userinfobot` to your group
2. The bot will send the group chat ID (looks like: `-1001234567890`)
3. Remove `@userinfobot` from group

### Step 4: Update Environment Variables

1. Go to Render dashboard
2. Update environment variables:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=-1001234567890
   ```
3. Save and redeploy

### Step 5: Test HITL Escalation

1. Send a query with low confidence to trigger escalation
2. Check your Telegram group for notification
3. Reply to the message
4. Response automatically added to knowledge base

---

## Troubleshooting

### Build Fails on Render

**Issue**: `npm install` fails

**Solution**:
- Check `package.json` syntax
- Ensure all dependencies are listed
- Check build logs for specific error

### Redis Connection Error

**Issue**: `Error: Redis connection failed`

**Solution**:
- Verify `REDIS_URL` format is correct
- Check Redis Cloud database is active
- Ensure password is correct (no spaces)

### OpenAI API Rate Limit

**Issue**: `Rate limit exceeded`

**Solution**:
- Check your OpenAI account usage
- Upgrade to paid tier if needed
- Implement request queuing in code

### Supabase Connection Timeout

**Issue**: `Failed to connect to Supabase`

**Solution**:
- Verify `SUPABASE_URL` is correct
- Check API keys are valid
- Ensure database is not paused (free tier auto-pauses after 7 days inactivity)

### CORS Errors in Browser

**Issue**: `Access-Control-Allow-Origin error`

**Solution**:
- Update `CORS_ORIGIN` environment variable with frontend URL
- Ensure no trailing slash in URL
- Redeploy backend after updating

---

## Cost Estimation

### Free Tier (Development/Testing)
- **Render**: Free (750 hours/month, sleeps after 15 min inactivity)
- **Redis Cloud**: Free (30MB)
- **Supabase**: Free (500MB database, 2GB bandwidth)
- **OpenAI**: Pay-per-use (~$10-50/month for moderate usage)

**Total**: $10-50/month

### Production (Recommended)
- **Render Starter**: $7/month (always-on, no sleep)
- **Redis Cloud**: $10/month (1GB)
- **Supabase Pro**: $25/month (8GB database, 100GB bandwidth)
- **OpenAI**: $50-200/month (usage-based)

**Total**: $92-242/month

---

## Security Checklist

Before going live:

- [ ] All environment variables set (no default values)
- [ ] `.env` file NOT committed to GitHub
- [ ] Strong `JWT_SECRET` (min 32 characters random)
- [ ] `NODE_ENV=production`
- [ ] CORS restricted to your domains only
- [ ] Rate limiting enabled
- [ ] Supabase Row Level Security (RLS) enabled
- [ ] Redis password protected
- [ ] HTTPS enabled (automatic on Render)
- [ ] Regular security updates scheduled

---

## Next Steps

1. ✅ Backend deployed and tested
2. ⏳ Deploy frontend admin dashboard
3. ⏳ Deploy embeddable chat widget
4. ⏳ Configure custom domain (optional)
5. ⏳ Setup monitoring and alerts
6. ⏳ Load test with expected traffic

---

## Support

For issues:
- Check Render logs first
- Review environment variables
- Test individual services (Redis, Supabase, OpenAI)
- Check GitHub issues or create new one

**Deployed Successfully?** Proceed to frontend deployment next!
