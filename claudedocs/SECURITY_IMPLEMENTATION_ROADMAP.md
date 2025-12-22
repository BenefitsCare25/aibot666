# Security Implementation Guide

**What**: Fix security risks in chatbot widget embedding
**Timeline**: 3 months
**Cost**: $50K (Phase 4 only)

---

## Summary of Risks

**Current embed code**:
```html
<script src="https://aibot666.onrender.com/widget.iife.js"></script>
```

**Main risks**:
1. 🔴 If your server is hacked → attacker can inject malicious code into ALL customer websites
2. 🔴 Widget has full access to customer website (can read passwords, cookies, etc.)
3. 🟡 No integrity verification (SRI) → can't detect if files are modified
4. 🟠 Hosted on Render free tier → no SLA, could go down

---

## Phase 1: Backend Security (Week 1)

**Effort**: 16-20 hours | **Cost**: $0 | **Customer impact**: None

### Install dependencies
```bash
cd backend
npm install helmet express-rate-limit cors winston
```

### 1. Security headers
Create `backend/middleware/security.js`:
```javascript
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'sameorigin' },
  noSniff: true,
  xssFilter: true
});
```

### 2. Rate limiting
Create `backend/middleware/rateLimiting.js`:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests',
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many messages',
});

module.exports = { apiLimiter, chatLimiter };
```

### 3. Update server.js
```javascript
const securityMiddleware = require('./middleware/security');
const { apiLimiter, chatLimiter } = require('./middleware/rateLimiting');

app.use(securityMiddleware);
app.use('/api/', apiLimiter);
app.use('/api/chat', chatLimiter);
```

### 4. Run security audit
```bash
npm audit
npm audit fix
```

### Checklist
- [ ] Install dependencies
- [ ] Create security middleware
- [ ] Create rate limiting middleware
- [ ] Update server.js
- [ ] Run npm audit fix
- [ ] Test locally
- [ ] Deploy
- [ ] Verify headers: `curl -I https://aibot666.onrender.com`

---

## Phase 2: SRI Integrity (Week 2-3)

**Effort**: 24-32 hours | **Cost**: $0 | **Customer impact**: Need to update embed code

### 1. Create SRI generation script
Create `scripts/generate-sri.sh`:
```bash
#!/bin/bash

WIDGET_HASH=$(openssl dgst -sha384 -binary backend/public/widget.iife.js | openssl base64 -A)
CSS_HASH=$(openssl dgst -sha384 -binary backend/public/widget.css | openssl base64 -A)

cat > backend/public/embed-code.html <<EOF
<script
  src="https://aibot666.onrender.com/widget.iife.js"
  integrity="sha384-$WIDGET_HASH"
  crossorigin="anonymous">
</script>
<link
  rel="stylesheet"
  href="https://aibot666.onrender.com/widget.css"
  integrity="sha384-$CSS_HASH"
  crossorigin="anonymous">
EOF

echo "SRI hashes generated"
```

Make executable:
```bash
chmod +x scripts/generate-sri.sh
```

### 2. Update package.json
```json
{
  "scripts": {
    "build": "your-build-command && bash scripts/generate-sri.sh"
  }
}
```

### 3. Email customers
```
Subject: Security Update - New Embed Code

We've added integrity verification to prevent code tampering.

Please update your embed code:

OLD:
<script src="https://aibot666.onrender.com/widget.iife.js"></script>

NEW:
[Copy from backend/public/embed-code.html]

This takes 2 minutes and improves security.
```

### Checklist
- [ ] Create generate-sri.sh
- [ ] Test script works
- [ ] Add to build process
- [ ] Generate current hashes
- [ ] Email all customers
- [ ] Create docs page with new embed code

---

## Phase 3: Iframe Option (Month 1)

**Effort**: 40-60 hours | **Cost**: $0 | **Customer impact**: None (optional feature)

### 1. Create iframe endpoint
Create `backend/routes/iframe.js`:
```javascript
router.get('/chat', (req, res) => {
  const config = {
    companyId: req.query.company,
    color: req.query.color || '#3b82f6',
  };
  res.render('chat-iframe', { config });
});
```

### 2. Create iframe template
Create `backend/views/chat-iframe.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/widget.css">
</head>
<body>
  <div id="chat-widget"></div>
  <script src="/widget.iife.js"></script>
</body>
</html>
```

### 3. Customer usage
```html
<iframe
  src="https://aibot666.onrender.com/chat?company=ABC123"
  sandbox="allow-scripts allow-same-origin allow-forms"
  style="width: 400px; height: 600px; border: none;">
</iframe>
```

### Checklist
- [ ] Create /chat route
- [ ] Create iframe template
- [ ] Test iframe loads correctly
- [ ] Test sandbox restrictions work
- [ ] Document iframe option
- [ ] Offer to enterprise customers

---

## Phase 4: Enterprise Infrastructure (Quarter 1)

**Effort**: 200+ hours | **Cost**: $50K + $500/month | **Customer impact**: Better uptime

### 1. AWS Migration
```bash
# Steps:
1. Create AWS account
2. Set up RDS PostgreSQL
3. Migrate database
4. Deploy to Elastic Beanstalk
5. Configure CloudFront CDN
6. Update DNS
7. Test
8. Switch traffic
```

### 2. Encryption at rest
- Enable RDS encryption
- Application-level encryption for sensitive fields

### 3. SOC2 preparation
- Document security policies
- Hire auditor ($15-30K)
- Timeline: 6-9 months

### 4. Monitoring
- AWS CloudWatch
- PagerDuty for alerts
- Sentry for errors

### Checklist
- [ ] Choose AWS/GCP/Azure
- [ ] Set up account
- [ ] Provision infrastructure
- [ ] Migrate database
- [ ] Deploy application
- [ ] Enable encryption
- [ ] Set up monitoring
- [ ] Start SOC2 audit

---

## Quick Reference

### What companies will ask

**"Is it secure?"**
→ "Yes, we use HTTPS, rate limiting, and security headers. SRI coming Week 2, iframe option Month 1."

**"What data do you collect?"**
→ "Chat messages, page URL. We DON'T collect passwords, cookies, or form data."

**"Are you GDPR compliant?"**
→ "Working toward full compliance Q1 2025. DPA available on request."

**"Do you have SOC2?"**
→ "Certification in progress, expected Q3 2025."

### Priority by customer type

| Customer | Risk | Needs | Timeline |
|----------|------|-------|----------|
| Small business | Low | Current code OK | Now |
| Mid-market | Medium | SRI + docs | Week 2 |
| Enterprise | High | Full roadmap | Q3 2025 |

---

## Budget

| Phase | Cost | Timeline |
|-------|------|----------|
| Phase 1 | $0 | Week 1 |
| Phase 2 | $0 | Week 2-3 |
| Phase 3 | $0 | Month 1 |
| Phase 4 | $50K | Quarter 1 |
| Ongoing | $500/mo | After migration |

**ROI**: $50K investment prevents $99K+ expected losses + enables enterprise sales

---

## Next Steps

1. Start Phase 1 this week
2. Test and deploy
3. Move to Phase 2
4. Decide on Phase 4 based on customer demand
