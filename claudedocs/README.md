# AI Chatbot Platform - Complete Documentation

**Last Updated:** January 20, 2025
**Version:** 3.0
**Status:** ✅ Production Ready

---

## 🚀 Quick Start

### What is this?

A multi-tenant AI chatbot platform for employee benefits support with:
- 🏢 **Multi-tenant architecture** - Complete data isolation per company
- 🤖 **AI-powered chat** - GPT-4o/Claude with RAG (vector search)
- 👥 **Employee management** - Insurance details, lifecycle tracking
- 📚 **Knowledge base** - Company-specific Q&A with embeddings
- 🔐 **RBAC system** - 47 granular permissions across 10 modules
- 📊 **Admin dashboard** - Full management interface
- 🔔 **Notifications** - Email, Telegram integration

---

## 📚 Documentation Index

All documentation is organized by category below. **Start with the Quick Setup Guide** then explore specific topics as needed.

---

## 🎯 Start Here

### Quick Setup (5 Minutes)

**Prerequisites:** Supabase account, Node.js 18+, Git

1. **Database Setup** (2 min)
   ```bash
   # Open Supabase SQL Editor
   # Copy & run: backend/migrations/COMPLETE_SUPABASE_SETUP.sql
   # Verify: SELECT COUNT(*) FROM information_schema.tables; (should be 36)
   ```

2. **Backend Setup** (1 min)
   ```bash
   cd backend && npm install
   cp .env.example .env  # Edit with your credentials
   npm run dev
   ```

3. **Admin Dashboard** (1 min)
   ```bash
   cd frontend/admin && npm install
   echo "VITE_API_URL=http://localhost:3000" > .env
   npm run dev  # Access: http://localhost:3001
   # Login: admin / Admin123! (CHANGE THIS!)
   ```

4. **Widget** (1 min)
   ```bash
   cd frontend/widget && npm install && npm run build
   cp dist/widget.iife.js dist/widget.css ../../backend/public/
   ```

**Deployment Guide:** See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## 📁 Documentation by Category

### 🗄️ Database & Schema

Everything about database setup, migrations, and schema management:

| Document | Description | Use When |
|----------|-------------|----------|
| **[COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md](COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md)** | **Complete schema reference & setup guide** | Setting up new database or understanding full schema |
| [QUICK_START_MIGRATION.md](QUICK_START_MIGRATION.md) | Migration guide for existing databases | Updating existing installation |
| [SCHEMA_AUTOMATION_FIX.md](SCHEMA_AUTOMATION_FIX.md) | "Tenant or user not found" error fix | Troubleshooting schema creation issues |

**Main File:** `backend/migrations/COMPLETE_SUPABASE_SETUP.sql` (2,023 lines)
**Stats:** 36 tables, 103 indexes, 47 RBAC permissions

---

### 🔐 Access Control & Security

Role-based access control (RBAC) and security features:

| Document | Description | Use When |
|----------|-------------|----------|
| **[RBAC_DEPLOYMENT_GUIDE.md](RBAC_DEPLOYMENT_GUIDE.md)** | **Complete RBAC setup & deployment** | Setting up roles and permissions |
| [RBAC_PERMISSION_MODEL.md](RBAC_PERMISSION_MODEL.md) | Permission reference (47 permissions) | Understanding permission structure |
| [EMPLOYEE-DATA-SECURITY.md](EMPLOYEE-DATA-SECURITY.md) | Security guidelines & privacy protection | Implementing security best practices |

**Features:** 47 granular permissions, custom roles, audit logging

---

### 🎨 Features & Usage

How to use and configure platform features:

| Document | Description | Use When |
|----------|-------------|----------|
| **[CALLBACK_REQUEST_FEATURE.md](CALLBACK_REQUEST_FEATURE.md)** | Callback request feature guide | Users can't login, need support callback |
| [EMPLOYEE_LIFECYCLE_SOLUTION.md](EMPLOYEE_LIFECYCLE_SOLUTION.md) | Employee activation/deactivation | Managing employee status (active/inactive) |
| [complete-ai-integration-and-model-recommendations.md](complete-ai-integration-and-model-recommendations.md) | AI model selection & configuration | Configuring GPT-4o, Claude, embeddings |
| [EXACT_OPENAI_PROMPT_BREAKDOWN.md](EXACT_OPENAI_PROMPT_BREAKDOWN.md) | System prompt engineering | Customizing chatbot behavior |
| [IMPROVED_CUSTOM_PROMPT.md](IMPROVED_CUSTOM_PROMPT.md) | Prompt optimization guide | Improving response quality |
| [POLICY-FILTERING-IMPLEMENTATION.md](POLICY-FILTERING-IMPLEMENTATION.md) | Policy-based filtering | Filtering responses by employee policy |

**Common Tasks:**
- Create custom roles → RBAC_DEPLOYMENT_GUIDE.md
- Upload employees → EMPLOYEE_LIFECYCLE_SOLUTION.md
- Configure AI → complete-ai-integration-and-model-recommendations.md
- Setup callbacks → CALLBACK_REQUEST_FEATURE.md

---

### 🏗️ Architecture & Technical

System architecture, design patterns, and technical deep-dives:

| Document | Description | Use When |
|----------|-------------|----------|
| **[MULTI-TENANT-SUMMARY.md](MULTI-TENANT-SUMMARY.md)** | **Multi-tenant architecture overview** | Understanding data isolation & routing |
| [KNOWLEDGE_BASE_ARCHITECTURE.md](KNOWLEDGE_BASE_ARCHITECTURE.md) | RAG system & vector search design | Understanding knowledge base & AI |
| [EMBEDDING_GENERATION_REFERENCE.md](EMBEDDING_GENERATION_REFERENCE.md) | Vector embedding generation | Working with vector search |

**Key Concepts:**
- Schema-per-company isolation → MULTI-TENANT-SUMMARY.md
- Vector search (pgvector) → KNOWLEDGE_BASE_ARCHITECTURE.md
- RAG implementation → EMBEDDING_GENERATION_REFERENCE.md

---

### 🚀 Deployment & Operations

Production deployment, configuration, and operations:

| Document | Description | Use When |
|----------|-------------|----------|
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | **Production deployment guide** | Deploying to Render, Vercel, or self-hosted |

**Covers:** Environment variables, CORS, Redis, email/Telegram, SSL setup

---

### 📜 Historical Reference

Implementation logs and bug fix documentation (archived):

| Document | Description |
|----------|-------------|
| [archive/context-awareness-hybrid-fix-2025-11-17.md](archive/context-awareness-hybrid-fix-2025-11-17.md) | Context awareness implementation |
| [archive/escalation-bug-fix-2025-11-17.md](archive/escalation-bug-fix-2025-11-17.md) | Escalation system bug fix |
| [archive/IMPLEMENTATION_SUMMARY.md](archive/IMPLEMENTATION_SUMMARY.md) | General implementation summary |
| [archive/LOG-button-optimization-implementation.md](archive/LOG-button-optimization-implementation.md) | LOG button UI optimization |
| [archive/PROMPT_ISSUE_SUMMARY_2025-11-18.md](archive/PROMPT_ISSUE_SUMMARY_2025-11-18.md) | Prompt engineering fixes |
| [archive/comprehensive-code-analysis-2025-11-10.md](archive/comprehensive-code-analysis-2025-11-10.md) | Initial code analysis |

---

## 🎯 Common Use Cases

### I want to...

**Set up a new database from scratch**
→ [COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md](COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md)

**Update an existing database**
→ [QUICK_START_MIGRATION.md](QUICK_START_MIGRATION.md)

**Deploy to production**
→ [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

**Create custom admin roles**
→ [RBAC_DEPLOYMENT_GUIDE.md](RBAC_DEPLOYMENT_GUIDE.md)

**Understand the permission system**
→ [RBAC_PERMISSION_MODEL.md](RBAC_PERMISSION_MODEL.md)

**Configure AI models**
→ [complete-ai-integration-and-model-recommendations.md](complete-ai-integration-and-model-recommendations.md)

**Enable callback requests**
→ [CALLBACK_REQUEST_FEATURE.md](CALLBACK_REQUEST_FEATURE.md)

**Manage employee lifecycle**
→ [EMPLOYEE_LIFECYCLE_SOLUTION.md](EMPLOYEE_LIFECYCLE_SOLUTION.md)

**Understand multi-tenant architecture**
→ [MULTI-TENANT-SUMMARY.md](MULTI-TENANT-SUMMARY.md)

**Understand vector search**
→ [KNOWLEDGE_BASE_ARCHITECTURE.md](KNOWLEDGE_BASE_ARCHITECTURE.md)

**Fix "Tenant or user not found" error**
→ [SCHEMA_AUTOMATION_FIX.md](SCHEMA_AUTOMATION_FIX.md)

**Improve chatbot responses**
→ [EXACT_OPENAI_PROMPT_BREAKDOWN.md](EXACT_OPENAI_PROMPT_BREAKDOWN.md)

---

## 📊 System Overview

### Database Architecture
- **36 tables** across 4 schemas (public + 3 companies)
- **103 indexes** for optimized performance
- **47 RBAC permissions** across 10 modules
- **Vector search** with pgvector (1536 dimensions)

### Tech Stack
**Backend:** Node.js + Express + Supabase + Redis + OpenAI/Claude
**Frontend:** React 18 + Vite + Zustand + TailwindCSS
**Infrastructure:** Render + Vercel + Supabase + Upstash Redis

### Key Features
✅ Multi-tenant with complete data isolation
✅ RBAC with 47 granular permissions
✅ Vector search for knowledge base (RAG)
✅ Employee lifecycle management
✅ Callback & LOG requests
✅ Email + Telegram notifications
✅ JWT authentication with refresh tokens
✅ Excel import/export
✅ Real-time analytics

---

## 🔐 Security

- **Row-Level Security (RLS)** on all tables
- **JWT tokens** with 24h expiry + refresh
- **Password requirements** (8+ chars, uppercase, lowercase, number, special)
- **RBAC system** with granular permissions
- **Data isolation** per company schema
- **Audit logging** for all admin actions

**Details:** [EMPLOYEE-DATA-SECURITY.md](EMPLOYEE-DATA-SECURITY.md)

---

## 📈 Production Checklist

Before deploying:

- [ ] Run `COMPLETE_SUPABASE_SETUP.sql` and verify 36 tables
- [ ] Change default admin password (`admin` / `Admin123!`)
- [ ] Configure environment variables ([DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md))
- [ ] Set up Redis caching
- [ ] Configure email (Azure) + Telegram
- [ ] Set up SSL/HTTPS
- [ ] Configure CORS for production domains
- [ ] Test RBAC permissions
- [ ] Test multi-tenant isolation
- [ ] Set up monitoring
- [ ] Create database backups

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database migration fails | [COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md](COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md) → Troubleshooting |
| "Tenant or user not found" | [SCHEMA_AUTOMATION_FIX.md](SCHEMA_AUTOMATION_FIX.md) |
| Widget not connecting | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) → CORS Configuration |
| Permissions not working | [RBAC_DEPLOYMENT_GUIDE.md](RBAC_DEPLOYMENT_GUIDE.md) → Troubleshooting |
| Vector search slow | [KNOWLEDGE_BASE_ARCHITECTURE.md](KNOWLEDGE_BASE_ARCHITECTURE.md) → Performance |
| Employee deactivation not working | [EMPLOYEE_LIFECYCLE_SOLUTION.md](EMPLOYEE_LIFECYCLE_SOLUTION.md) |

---

## 📝 Version History

### Version 3.0 (January 20, 2025) - CURRENT
- ✅ RBAC system (47 permissions, custom roles)
- ✅ Employee lifecycle management
- ✅ Consolidated database schema (2,023 lines)
- ✅ Organized documentation (18 active docs + 6 archived)

### Version 2.0 (November 17, 2025)
- ✅ Multi-tenant architecture
- ✅ Callback requests
- ✅ LOG requests
- ✅ AI settings per company

### Version 1.0 (November 13, 2025)
- ✅ Basic chatbot with knowledge base
- ✅ Vector search integration
- ✅ Admin dashboard

---

## 🏗️ Project Structure

```
aibot/
├── backend/
│   ├── api/                    # API routes and services
│   ├── config/                 # Configuration files
│   ├── migrations/
│   │   └── COMPLETE_SUPABASE_SETUP.sql  ⭐ Main schema (2,023 lines)
│   └── public/                 # Static files (widget)
├── frontend/
│   ├── admin/                  # Admin dashboard (React)
│   └── widget/                 # Chat widget (React)
└── claudedocs/                 # 📚 Documentation (you are here)
    ├── README.md               # ⭐ This file (navigation hub)
    │
    ├── 🗄️ Database & Schema/
    │   ├── COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md ⭐
    │   ├── QUICK_START_MIGRATION.md
    │   └── SCHEMA_AUTOMATION_FIX.md
    │
    ├── 🔐 Access Control/
    │   ├── RBAC_DEPLOYMENT_GUIDE.md ⭐
    │   ├── RBAC_PERMISSION_MODEL.md
    │   └── EMPLOYEE-DATA-SECURITY.md
    │
    ├── 🎨 Features/
    │   ├── CALLBACK_REQUEST_FEATURE.md
    │   ├── EMPLOYEE_LIFECYCLE_SOLUTION.md
    │   ├── complete-ai-integration-and-model-recommendations.md
    │   ├── EXACT_OPENAI_PROMPT_BREAKDOWN.md
    │   ├── IMPROVED_CUSTOM_PROMPT.md
    │   └── POLICY-FILTERING-IMPLEMENTATION.md
    │
    ├── 🏗️ Architecture/
    │   ├── MULTI-TENANT-SUMMARY.md ⭐
    │   ├── KNOWLEDGE_BASE_ARCHITECTURE.md
    │   └── EMBEDDING_GENERATION_REFERENCE.md
    │
    ├── 🚀 Deployment/
    │   └── DEPLOYMENT_GUIDE.md ⭐
    │
    └── 📜 archive/               # Historical implementation logs
        ├── context-awareness-hybrid-fix-2025-11-17.md
        ├── escalation-bug-fix-2025-11-17.md
        ├── IMPLEMENTATION_SUMMARY.md
        ├── LOG-button-optimization-implementation.md
        └── PROMPT_ISSUE_SUMMARY_2025-11-18.md
```

---

## 🤝 Contributing & Support

### Getting Help
1. Check this README for topic location
2. Read relevant documentation guide
3. Review troubleshooting sections
4. Check server logs for errors

### Documentation Guidelines
- **Core docs:** Keep updated with current system state
- **Feature guides:** Document specific features in detail
- **Implementation logs:** Archive after completion
- **Architecture docs:** Reflect actual implementation

---

## 📚 Additional Resources

**Main Database File:**
- `backend/migrations/COMPLETE_SUPABASE_SETUP.sql` (2,023 lines)

**Standalone Migrations:**
- `backend/migrations/20250119_add_rbac_system.sql`
- `backend/migrations/20250120_make_role_column_nullable.sql`

**Widget Documentation:**
- `frontend/widget/README.md`
- `frontend/widget/EMBED.md`

**Admin Dashboard:**
- `frontend/admin/README.md`

---

## ✨ Summary

**Total Documentation:** 18 active files + 6 archived
**Organization:** 5 categories (Database, Security, Features, Architecture, Deployment)
**Status:** ✅ Complete, organized, production-ready

**Start your journey:**
1. **New setup?** → [COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md](COMPLETE_SUPABASE_SETUP_UPDATE_2025-01-20.md)
2. **Deploy?** → [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. **Configure RBAC?** → [RBAC_DEPLOYMENT_GUIDE.md](RBAC_DEPLOYMENT_GUIDE.md)
4. **Understand architecture?** → [MULTI-TENANT-SUMMARY.md](MULTI-TENANT-SUMMARY.md)

---

**Maintained By:** Development Team
**License:** Proprietary
**Last Updated:** January 20, 2025
