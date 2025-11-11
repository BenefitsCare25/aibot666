# AI Settings Feature - Implementation Guide

**Date**: 2025-11-11
**Feature**: Per-Company AI Configuration (Option B)
**Status**: 🔨 IN PROGRESS (Backend Complete, Frontend Pending)

---

## Overview

This feature allows each company to customize their AI configuration including:
- AI Model selection (GPT-4o, GPT-4o-mini, Claude, etc.)
- System prompt customization
- Temperature, max tokens, and other parameters
- Similarity thresholds and context retrieval settings

---

## ✅ Completed Components

### 1. Database Migration
**File**: `backend/migrations/add-ai-settings-to-companies.sql`

**What it does**:
- Adds `ai_settings` JSONB column to `companies` table
- Creates validation trigger for AI settings
- Sets default settings for existing companies
- Validates model names, temperature ranges, token limits

**Schema**:
```json
{
  "model": "gpt-4o",
  "temperature": 0,
  "max_tokens": 1000,
  "embedding_model": "text-embedding-3-small",
  "similarity_threshold": 0.7,
  "top_k_results": 5,
  "system_prompt": null,
  "escalation_threshold": 0.5,
  "use_global_defaults": true
}
```

**To Run**:
```bash
psql -h your-host -U your-user -d your-db -f backend/migrations/add-ai-settings-to-companies.sql
```

---

### 2. Backend API Endpoints
**File**: `backend/api/routes/aiSettings.js`
**Registered in**: `backend/server.js`

**Endpoints**:

#### GET `/api/ai-settings/models`
Returns list of available AI models with pricing and metadata.

**Response**:
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "description": "Latest and most capable OpenAI model",
        "cost_per_1m_input": 2.50,
        "cost_per_1m_output": 10.00,
        "speed": "fast",
        "quality": "excellent",
        "recommended": true
      },
      // ... more models
    ],
    "default": "gpt-4o"
  }
}
```

#### GET `/api/ai-settings/companies/:companyId`
Get AI settings for a specific company.

**Response**:
```json
{
  "success": true,
  "data": {
    "company_id": "uuid",
    "company_name": "Inspro",
    "settings": {
      "model": "gpt-4o",
      "temperature": 0,
      // ... all settings
    },
    "defaults": { /* global defaults */ }
  }
}
```

#### PUT `/api/ai-settings/companies/:companyId`
Update AI settings for a company.

**Request Body**:
```json
{
  "settings": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1500,
    "system_prompt": "Custom prompt..."
  }
}
```

**Validation**:
- Model must be in allowed list
- Temperature: 0-1
- Max tokens: 1-16000
- Similarity threshold: 0-1
- Top K results: 1-20

#### POST `/api/ai-settings/test`
Test AI configuration with a sample query before saving.

**Request Body**:
```json
{
  "companyId": "uuid",
  "testQuery": "What is my dental coverage?",
  "settings": { /* test settings */ }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "query": "What is my dental coverage?",
    "answer": "Your dental coverage...",
    "confidence": 0.85,
    "sources": [...],
    "model_used": "gpt-4o",
    "tokens_used": 543,
    "contexts_found": 3
  }
}
```

#### POST `/api/ai-settings/reset/:companyId`
Reset company AI settings to global defaults.

#### GET `/api/ai-settings/defaults`
Get global default AI settings from environment variables.

---

## 🔨 In Progress

### 3. Update OpenAI Service to Use Company Settings
**File**: `backend/api/services/openai.js`

**Changes Needed**:

**Current**:
```javascript
const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0;
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;

export async function generateRAGResponse(query, contexts, employeeData, conversationHistory = []) {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    // ...
  });
}
```

**Update To**:
```javascript
export async function generateRAGResponse(
  query,
  contexts,
  employeeData,
  conversationHistory = [],
  customSettings = null  // NEW: Accept custom settings
) {
  // Use custom settings if provided, otherwise use env defaults
  const model = customSettings?.model || process.env.OPENAI_MODEL || 'gpt-4o';
  const temperature = customSettings?.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE) || 0;
  const maxTokens = customSettings?.max_tokens ?? parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
  const customPrompt = customSettings?.system_prompt || null;

  // If custom prompt provided, use it instead of createRAGPrompt
  const systemPrompt = customPrompt || createRAGPrompt(query, contexts, employeeData);

  const response = await openai.chat.completions.create({
    model: model,
    temperature: temperature,
    max_tokens: maxTokens,
    // ...
  });
}
```

**Also Update chat.js to pass company AI settings**:
```javascript
// backend/api/routes/chat.js

router.post('/message', async (req, res) => {
  // ... existing code ...

  // NEW: Get company AI settings
  const companyAISettings = req.company?.ai_settings || null;

  // Pass settings to generateRAGResponse
  const response = await generateRAGResponse(
    message,
    contexts,
    employee,
    formattedHistory,
    companyAISettings  // NEW parameter
  );
});
```

---

## 📋 Remaining Tasks

### 4. Frontend - AI Settings Page
**File**: `frontend/admin/src/pages/AISettings.jsx`

**Components Needed**:

1. **Model Selector Dropdown**
   - Display available models with pricing
   - Show recommended badge
   - Cost comparison calculator

2. **System Prompt Editor**
   - Large textarea with monospace font
   - Character counter (max 50,000)
   - Preview toggle
   - Reset to default button
   - Variable helper (show available variables like `{employee_name}`, `{policy_type}`)

3. **Advanced Settings Panel**
   - Temperature slider (0-1) with live preview
   - Max Tokens input field
   - Similarity Threshold slider (0-1)
   - Top K Results selector (1-20)
   - Escalation Threshold slider (0-1)

4. **Test Interface**
   - Sample query input
   - "Test Configuration" button
   - Response preview with confidence score
   - Sources/context display

5. **Cost Estimator**
   - Input: queries per month
   - Shows cost with current settings vs defaults
   - Savings calculator

### 5. Frontend API Client
**File**: `frontend/admin/src/api/aiSettings.js`

```javascript
import apiClient from './client';

export const aiSettingsApi = {
  // Get available models
  getModels: () => apiClient.get('/ai-settings/models'),

  // Get company AI settings
  getCompanySettings: (companyId) =>
    apiClient.get(`/ai-settings/companies/${companyId}`),

  // Update company AI settings
  updateCompanySettings: (companyId, settings) =>
    apiClient.put(`/ai-settings/companies/${companyId}`, { settings }),

  // Test AI configuration
  testConfiguration: (companyId, testQuery, settings) =>
    apiClient.post('/ai-settings/test', { companyId, testQuery, settings }),

  // Reset to defaults
  resetSettings: (companyId) =>
    apiClient.post(`/ai-settings/reset/${companyId}`),

  // Get global defaults
  getDefaults: () => apiClient.get('/ai-settings/defaults')
};
```

### 6. Navigation Update
**File**: `frontend/admin/src/App.jsx` or navigation component

Add link to AI Settings page in the admin sidebar:
```jsx
<NavLink to="/ai-settings">
  <svg>...</svg>
  AI Settings
</NavLink>
```

---

## UI Mockup

```
┌────────────────────────────────────────────────────────────┐
│ AI Configuration - Inspro                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌────────── Model Selection ──────────┐                   │
│ │ ○ GPT-4o (Recommended)      ⭐      │                   │
│ │   Cost: $2.50 input | $10 output   │                   │
│ │   Speed: Fast | Quality: Excellent  │                   │
│ │                                      │                   │
│ │ ○ GPT-4o Mini                        │                   │
│ │   Cost: $0.15 input | $0.60 output  │                   │
│ │   Speed: Very Fast | Quality: Good  │                   │
│ │                                      │                   │
│ │ ○ Claude 3.5 Sonnet                  │                   │
│ │   Cost: $3 input | $15 output       │                   │
│ │   Requires Anthropic API Key        │                   │
│ └──────────────────────────────────────┘                   │
│                                                            │
│ ┌────────── System Prompt ─────────────────────────────┐  │
│ │ You are an AI assistant for employee insurance...   │  │
│ │ [Full editable prompt - 5000 chars]                  │  │
│ │                                                       │  │
│ │ Available Variables:                                 │  │
│ │ {employee_name} {policy_type} {coverage_limit}      │  │
│ │                                                       │  │
│ │ [Reset to Default] [Preview]         Character: 2340│  │
│ └───────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌────────── Advanced Settings ─────────┐                  │
│ │ Temperature:    [====|-----] 0.0    │                  │
│ │ Max Tokens:     1000                │                  │
│ │ Similarity:     [=======|--] 0.7    │                  │
│ │ Top K Results:  5                    │                  │
│ │ Escalation:     [=====|----] 0.5    │                  │
│ └──────────────────────────────────────┘                  │
│                                                            │
│ ┌────────── Test Configuration ────────────────────────┐  │
│ │ Sample Query:                                        │  │
│ │ ┌────────────────────────────────────────────────┐  │  │
│ │ │ What is my dental coverage?                    │  │  │
│ │ └────────────────────────────────────────────────┘  │  │
│ │                                                      │  │
│ │ [Test Now]                                           │  │
│ │                                                      │  │
│ │ Response:                                            │  │
│ │ ┌────────────────────────────────────────────────┐  │  │
│ │ │ Your dental limit is $1,000...                 │  │  │
│ │ │ Confidence: 85% | Sources: 3 | Tokens: 543    │  │  │
│ │ └────────────────────────────────────────────────┘  │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌────────── Cost Estimator ─────────────────────────┐     │
│ │ Queries/month: [100,000]                          │     │
│ │                                                    │     │
│ │ Current (GPT-4o):      $325/month                │     │
│ │ Global Default:        $1,100/month               │     │
│ │ Savings:               $775/month (70%)    ✅    │     │
│ └────────────────────────────────────────────────────┘     │
│                                                            │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ [Save Configuration] [Reset to Defaults] [Cancel]   │   │
│ └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## Deployment Checklist

### Backend Deployment

1. **Run Database Migration**:
   ```bash
   psql -h your-host -U your-user -d your-db -f backend/migrations/add-ai-settings-to-companies.sql
   ```

2. **Verify Migration**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'companies' AND column_name = 'ai_settings';
   ```

3. **Update Environment Variables** (optional - keep defaults):
   ```bash
   # .env
   OPENAI_MODEL=gpt-4o  # Default model
   OPENAI_TEMPERATURE=0
   OPENAI_MAX_TOKENS=1000
   ```

4. **Deploy Backend Code**:
   ```bash
   cd backend
   npm install
   npm run build  # if applicable
   pm2 restart aibot-backend
   ```

5. **Test API Endpoints**:
   ```bash
   # Get models
   curl http://localhost:3000/api/ai-settings/models

   # Get company settings
   curl http://localhost:3000/api/ai-settings/companies/YOUR_COMPANY_ID
   ```

### Frontend Deployment

1. **Create AI Settings Components** (see remaining tasks)

2. **Build Frontend**:
   ```bash
   cd frontend/admin
   npm install
   npm run build
   ```

3. **Deploy**:
   - Copy build files to hosting
   - Update routing configuration
   - Test in production

---

## Testing Guide

### Backend API Testing

**Test 1: Get Available Models**
```bash
curl http://localhost:3000/api/ai-settings/models
```
Expected: List of 6 models with pricing

**Test 2: Get Company Settings**
```bash
curl http://localhost:3000/api/ai-settings/companies/COMPANY_ID
```
Expected: Company settings with defaults

**Test 3: Update Settings**
```bash
curl -X PUT http://localhost:3000/api/ai-settings/companies/COMPANY_ID \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "model": "gpt-4o",
      "temperature": 0.2,
      "max_tokens": 1500
    }
  }'
```
Expected: Updated settings returned

**Test 4: Test Configuration**
```bash
curl -X POST http://localhost:3000/api/ai-settings/test \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "COMPANY_ID",
    "testQuery": "What is my dental coverage?",
    "settings": {"model": "gpt-4o"}
  }'
```
Expected: AI response with test query

**Test 5: Validation Errors**
```bash
curl -X PUT http://localhost:3000/api/ai-settings/companies/COMPANY_ID \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "temperature": 2.0
    }
  }'
```
Expected: 400 error "Temperature must be between 0 and 1"

---

## Cost Impact Analysis

### Scenario: 100,000 queries/month

**Current (Global Default - GPT-4 Turbo)**:
- Input: 100K × 500 tokens = 50M tokens = $500
- Output: 100K × 200 tokens = 20M tokens = $600
- **Total: $1,100/month**

**After Switching to GPT-4o** (via AI Settings):
- Input: 100K × 500 tokens = 50M tokens = $125
- Output: 100K × 200 tokens = 20M tokens = $200
- **Total: $325/month**
- **Savings: $775/month (70%)**

**Per-Company Optimization Example**:
- Company A (high volume): GPT-4o-mini → $19.50/month
- Company B (quality-focused): GPT-4o → $325/month
- Company C (privacy-focused): Claude 3.5 → $450/month

---

## Security Considerations

1. **API Access Control**:
   - AI Settings endpoints should require admin authentication
   - Company-specific endpoints should validate company access
   - Rate limit AI test endpoint (expensive)

2. **Prompt Injection Protection**:
   - Sanitize custom system prompts
   - Character limits on prompts (50,000 max)
   - Validate prompt doesn't contain malicious instructions

3. **Model Access**:
   - Claude models require separate API key (Anthropic)
   - Validate API keys before allowing model selection
   - Show warning if model requires different provider

4. **Audit Logging**:
   - Log all AI settings changes
   - Track who changed what and when
   - Maintain change history

---

## Next Steps

**Immediate** (Complete Backend):
1. ✅ Database migration
2. ✅ Backend API endpoints
3. ⏳ Update openai.js to use company settings
4. ⏳ Update chat.js to pass company settings

**Short-term** (Build Frontend):
5. ⏳ Create AISettings.jsx page
6. ⏳ Build model selector component
7. ⏳ Add system prompt editor
8. ⏳ Implement test interface
9. ⏳ Add navigation link

**Testing & Deployment**:
10. ⏳ End-to-end testing
11. ⏳ Deploy to staging
12. ⏳ User acceptance testing
13. ⏳ Deploy to production

---

**Last Updated**: 2025-11-11
**Status**: Backend Complete, Frontend Pending
**ETA**: 2-3 hours remaining for frontend implementation
