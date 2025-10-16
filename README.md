# AI Insurance Chatbot System

An enterprise-grade AI chatbot system for employee insurance benefits and claims support, built with OpenAI GPT-4, Supabase (pgvector), Redis, and Telegram integration for human-in-the-loop learning.

## Features

- **RAG-Powered AI Chatbot**: OpenAI GPT-4 with Retrieval Augmented Generation for accurate insurance queries
- **Vector Database**: Supabase with pgvector for semantic search and knowledge base management
- **Concurrent User Support**: Redis-based session management handling 1000+ simultaneous users
- **Human-in-the-Loop (HITL)**: Telegram integration for escalations and continuous learning
- **Excel Data Import**: Bulk employee data upload with automatic embedding generation
- **Admin Dashboard**: Manage employees, knowledge base, chat history, and escalations
- **Real-time Analytics**: Track query volume, confidence scores, and escalation rates
- **Scalable Architecture**: Designed for production deployment with monitoring and error handling

## System Architecture

```
┌──────────────────┐
│  Employee Portal │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────────────────┐
│           Express.js API Server              │
│  ┌─────────────────────────────────────────┐ │
│  │ Chat Routes  │  Admin Routes            │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ OpenAI Service (GPT-4 + Embeddings)     │ │
│  │ Vector DB Service (Supabase pgvector)   │ │
│  │ Session Manager (Redis)                 │ │
│  │ Telegram Bot (HITL)                     │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
         │         │          │
         ↓         ↓          ↓
    ┌────────┐ ┌──────┐ ┌──────────────┐
    │Supabase│ │Redis │ │Telegram Bot  │
    │pgvector│ │Cache │ │   Support    │
    └────────┘ └──────┘ └──────────────┘
```

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **AI/ML**: OpenAI API (GPT-4 + text-embedding-3-large)
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Cache**: Redis (ioredis)
- **File Processing**: xlsx (Excel parsing)
- **Bot Framework**: Telegraf (Telegram Bot API)

### Key Libraries
- `@supabase/supabase-js`: Database client with vector search
- `openai`: Official OpenAI SDK
- `ioredis`: Redis client for session management
- `telegraf`: Telegram bot framework
- `xlsx`: Excel file parser
- `express-rate-limit`: API rate limiting
- `helmet`: Security headers
- `multer`: File upload handling

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** installed
2. **Redis** server running (local or cloud)
3. **Supabase Account** ([supabase.com](https://supabase.com))
4. **OpenAI API Key** ([platform.openai.com](https://platform.openai.com))
5. **Telegram Bot Token** (optional, for HITL feature)

## Installation

### 1. Clone the Repository

```bash
cd aibot
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Setup Supabase Database

a. Create a new Supabase project at [supabase.com](https://supabase.com)

b. Enable the pgvector extension:
   - Go to Database → Extensions
   - Enable `vector` extension

c. Run the database schema:
   - Go to SQL Editor
   - Copy and paste the contents of `backend/config/schema.sql`
   - Execute the SQL script

### 4. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp backend/.env.example backend/.env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_TEMPERATURE=0
OPENAI_MAX_TOKENS=1000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_SESSION_TTL=3600

# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-group-chat-id

# RAG Configuration
VECTOR_SIMILARITY_THRESHOLD=0.7
TOP_K_RESULTS=5
CONFIDENCE_THRESHOLD=0.7
MAX_CONTEXT_LENGTH=3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Security
JWT_SECRET=your-jwt-secret-key
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=info
```

### 5. Setup Telegram Bot (Optional for HITL)

If you want human-in-the-loop escalation support:

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Create a Telegram group for support team
4. Add the bot to the group
5. Get the chat ID (use [@userinfobot](https://t.me/userinfobot))
6. Add credentials to `.env`

### 6. Start Redis Server

**Option A: Local Redis**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
redis-server
```

**Option B: Cloud Redis**
Use Redis Cloud, AWS ElastiCache, or Upstash and update `REDIS_URL` in `.env`

### 7. Start the Backend Server

```bash
cd backend
npm start
```

For development with auto-reload:
```bash
npm run dev
```

You should see:
```
═══════════════════════════════════════════════════════
  Insurance Chatbot API Server
═══════════════════════════════════════════════════════

  🚀 Server running on port 3000
  🌍 Environment: development
  📡 API Base URL: http://localhost:3000
  🏥 Health Check: http://localhost:3000/health

  Endpoints:
    - Chat API: /api/chat
    - Admin API: /api/admin

  Services:
    ✓ OpenAI API: Configured
    ✓ Supabase: Configured
    ✓ Redis: Connected
    ✓ Telegram Bot: Configured

  Press Ctrl+C to stop the server
═══════════════════════════════════════════════════════
```

## API Documentation

### Chat Endpoints

#### Create Session
```http
POST /api/chat/session
Content-Type: application/json

{
  "employeeId": "EMP001",
  "metadata": {}
}
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "conversationId": "uuid",
    "employee": {
      "id": "uuid",
      "name": "John Doe",
      "policyType": "Premium"
    }
  }
}
```

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "sessionId": "uuid",
  "message": "What is my dental coverage limit?"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "answer": "Based on your Premium policy, your dental coverage limit is $2,000 annually...",
    "confidence": 0.92,
    "sources": [
      {
        "id": "uuid",
        "title": "Premium Plan Benefits",
        "category": "benefits",
        "similarity": 0.89
      }
    ],
    "escalated": false,
    "sessionId": "uuid",
    "conversationId": "uuid"
  }
}
```

#### Get Chat History
```http
GET /api/chat/history/{conversationId}?limit=20
```

### Admin Endpoints

#### Upload Employees (Excel)
```http
POST /api/admin/employees/upload
Content-Type: multipart/form-data

file: employee_data.xlsx
```

#### Download Excel Template
```http
GET /api/admin/employees/template
```

#### Add Knowledge Base Entry
```http
POST /api/admin/knowledge
Content-Type: application/json

{
  "title": "Dental Coverage Policy",
  "content": "Dental coverage includes...",
  "category": "benefits",
  "subcategory": "dental"
}
```

#### Get Analytics
```http
GET /api/admin/analytics?startDate=2024-01-01&endDate=2024-12-31
```

Response:
```json
{
  "success": true,
  "data": {
    "queries": {
      "total": 1250,
      "escalated": 87,
      "escalationRate": "6.96",
      "avgConfidence": "0.85"
    },
    "escalations": {
      "total": 87,
      "pending": 5,
      "resolved": 82,
      "avgResolutionTimeMinutes": "12.45"
    }
  }
}
```

## Data Import

### Employee Data Format

Download the Excel template and fill in employee information:

```bash
curl http://localhost:3000/api/admin/employees/template -o template.xlsx
```

Required columns:
- `employee_id`: Unique employee identifier
- `name`: Full name
- `email`: Email address
- `policy_type`: Insurance plan type
- `coverage_limit`: Total coverage amount
- `annual_claim_limit`: Annual claim limit
- `outpatient_limit`: Outpatient coverage
- `dental_limit`: Dental coverage
- `optical_limit`: Optical coverage
- `policy_start_date`: Policy start date
- `policy_end_date`: Policy end date

### Initial Knowledge Base Setup

Create a JSON file with insurance policies and FAQs:

```json
[
  {
    "title": "Premium Plan Dental Benefits",
    "content": "Premium plan members are entitled to $2,000 annual dental coverage including...",
    "category": "benefits",
    "subcategory": "dental"
  },
  {
    "title": "Claims Submission Process",
    "content": "To submit a claim, follow these steps: 1. Complete the claim form...",
    "category": "claims",
    "subcategory": "procedures"
  }
]
```

Import via API:
```bash
curl -X POST http://localhost:3000/api/admin/knowledge/batch \
  -H "Content-Type: application/json" \
  -d @knowledge_base.json
```

## Human-in-the-Loop Workflow

When the chatbot's confidence is below the threshold (default: 0.7):

1. **Escalation Created**: Query is saved to the `escalations` table
2. **Telegram Notification**: Support team receives a message in the Telegram group:
   ```
   🔔 New Escalation

   Employee: John Doe
   Policy: Premium
   Coverage: $100,000

   Question:
   What happens if I need emergency surgery abroad?

   Context:
   Confidence: 62.5%

   [Escalation: abc123]

   👉 Reply to this message with your answer
   ```
3. **Team Responds**: Support team replies directly to the Telegram message
4. **Auto-Learning**: System automatically:
   - Saves the response to knowledge base
   - Generates embeddings for future queries
   - Marks escalation as resolved
   - Updates chat history

Telegram Bot Commands:
- `/start` - Initialize bot
- `/help` - Show help message
- `/pending` - List pending escalations
- `/stats` - Show escalation statistics

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use strong `JWT_SECRET`
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domains
- [ ] Setup Redis in cluster mode
- [ ] Enable Supabase connection pooling
- [ ] Configure rate limits appropriately
- [ ] Setup monitoring (Sentry, DataDog, etc.)
- [ ] Enable logging to external service
- [ ] Backup database regularly
- [ ] Setup CI/CD pipeline

### Recommended Hosting

**Backend**:
- Railway ([railway.app](https://railway.app))
- Render ([render.com](https://render.com))
- AWS EC2/ECS
- Google Cloud Run
- Azure App Service

**Redis**:
- Redis Cloud ([redis.com](https://redis.com))
- AWS ElastiCache
- Upstash ([upstash.com](https://upstash.com))

**Database**:
- Supabase (includes hosting)

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000

# Use production-grade API keys
OPENAI_API_KEY=sk-prod-...
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_KEY=prod-key...

# Redis with authentication
REDIS_URL=rediss://username:password@your-redis-host:6379

# Production domains
CORS_ORIGIN=https://your-frontend-domain.com

# Tighter rate limits
RATE_LIMIT_MAX_REQUESTS=60

# Secure JWT secret
JWT_SECRET=your-very-long-random-secret-here
```

## Performance Optimization

### Concurrent User Handling

The system is designed to handle 1000+ concurrent users:

1. **Redis Session Management**: In-memory session storage with TTL
2. **Connection Pooling**: Supabase client connection pooling
3. **Rate Limiting**: Prevents API abuse
4. **Query Caching**: Frequently asked questions cached for 5 minutes
5. **Async Processing**: Non-blocking I/O for all operations

### Scaling Strategies

**Horizontal Scaling**:
- Deploy multiple backend instances behind a load balancer
- Redis handles distributed session management
- Stateless API design allows easy scaling

**Vertical Scaling**:
- Increase server resources (CPU/RAM)
- Optimize Redis memory usage
- Tune connection pool sizes

**Database Optimization**:
- pgvector indexes for fast similarity search
- Proper database indexes on frequently queried columns
- Regular VACUUM and ANALYZE operations

## Monitoring

### Key Metrics to Track

- API response times (p50, p95, p99)
- OpenAI API latency and errors
- Redis connection pool usage
- Database query performance
- Escalation rate
- Average confidence scores
- Session duration
- Concurrent active sessions

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "redis": "connected"
}
```

## Troubleshooting

### Common Issues

**Redis Connection Failed**
```
Error: Redis connection error: ECONNREFUSED
```
Solution: Ensure Redis is running (`redis-cli ping` should return `PONG`)

**OpenAI API Rate Limit**
```
Error: Rate limit exceeded
```
Solution: Implement request queuing with BullMQ or upgrade OpenAI tier

**Supabase Connection Error**
```
Error: Failed to fetch employee data
```
Solution: Check Supabase credentials and network connectivity

**Embedding Generation Timeout**
```
Error: Request timeout
```
Solution: Increase timeout limits or batch smaller chunks

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## Security Considerations

- **API Keys**: Never commit `.env` file to version control
- **Rate Limiting**: Protects against DDoS attacks
- **Input Validation**: All inputs sanitized and validated
- **SQL Injection**: Using parameterized queries via Supabase client
- **XSS Protection**: Helmet middleware for security headers
- **CORS**: Restrict origins to trusted domains
- **Authentication**: Implement JWT-based auth for production
- **Row-Level Security**: Enabled on Supabase tables

## Cost Estimation (Monthly)

For 100-500 employees with moderate usage:

- **Supabase Pro**: $25/month
- **OpenAI API**: $50-200 (usage-based)
- **Redis Cloud**: $10-30/month
- **Hosting**: $20-50/month
- **Telegram Bot**: Free

**Total**: $105-305/month

## Contributing

This is a production system. For contributions:
1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Submit a pull request

## License

ISC License

## Support

For issues and questions:
- Create an issue on GitHub
- Contact the development team
- Check the troubleshooting section

---

Built with ❤️ using OpenAI GPT-4, Supabase, and Node.js
