# Deployment Guide

## Architecture Overview

This project has 3 main components:

1. **Backend API** (`backend/`) - Node.js/Express API server
2. **Admin Dashboard** (`frontend/admin/`) - React admin interface
3. **Chat Widget** (`frontend/widget/`) - Embeddable chat widget

### Important: Widget Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│  Widget Source Code                                     │
│  Location: frontend/widget/src/                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ npm run build
                   ↓
┌─────────────────────────────────────────────────────────┐
│  Widget Build Output                                    │
│  Location: frontend/widget/dist/                        │
│  Files: widget.iife.js, widget.css                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ MUST COPY TO →
                   ↓
┌─────────────────────────────────────────────────────────┐
│  Backend Public Folder (PRODUCTION SOURCE)              │
│  Location: backend/public/                              │
│  Files: widget.iife.js, widget.css                      │
│  Served at: https://aibot666.onrender.com/widget.*.js   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ loaded by
                   ↓
┌─────────────────────────────────────────────────────────┐
│  Admin Dashboard                                        │
│  Location: frontend/admin/index.html                    │
│  Loads: https://aibot666.onrender.com/widget.iife.js   │
└─────────────────────────────────────────────────────────┘
```

## Widget Development Workflow

### When Making Widget Changes:

**⚠️ CRITICAL: Widget changes require 2 steps!**

1. **Edit source files in:** `frontend/widget/src/`
2. **Build and copy to backend:**

```bash
# Step 1: Build the widget
cd frontend/widget
npm run build

# Step 2: Copy build files to backend/public
npm run deploy

# Step 3: Commit BOTH locations
git add frontend/widget/src/ backend/public/
git commit -m "Update widget with [feature name]"
git push
```

### Files to Edit/Commit:

✅ **DO edit these:**
- `frontend/widget/src/**/*.jsx` - Widget source code
- `backend/public/widget.iife.js` - Production widget (after build)
- `backend/public/widget.css` - Production styles (after build)

❌ **DON'T commit these:**
- `frontend/widget/dist/` - Temporary build output (gitignored)

## Deployment Scripts

### Widget Deployment Script

Location: `frontend/widget/package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "npm run build && npm run copy-to-backend",
    "copy-to-backend": "cp dist/widget.iife.js ../../backend/public/ && cp dist/widget.css ../../backend/public/"
  }
}
```

**Usage:**
```bash
cd frontend/widget
npm run deploy
```

This will:
1. Build the widget
2. Copy files to `backend/public/`
3. Ready for commit and push

## Production Deployment

### Render.com Auto-Deploy

When you push to GitHub `main` branch, Render automatically deploys:

1. **Backend Service** - Deploys from `backend/` folder
   - Serves widget files from `backend/public/`
   - API endpoints at `https://aibot666.onrender.com/api/`

2. **Admin Dashboard** - Deploys from `frontend/admin/` folder
   - Loads widget from backend URL
   - Runs at admin dashboard URL

### Manual Deploy (if needed)

1. Go to https://dashboard.render.com
2. Select the service (backend or admin)
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait 2-3 minutes for build completion

## Testing Widget Changes

### Local Development

```bash
# Terminal 1: Run backend
cd backend
npm run dev

# Terminal 2: Run widget dev server
cd frontend/widget
npm run dev
# Opens at http://localhost:5173

# Terminal 3: Run admin dashboard
cd frontend/admin
npm run dev
# Opens at http://localhost:3001
```

**Note:** Local dev uses development widget, not the production build.

### Production Testing

After deploying:
1. Wait 2-3 minutes for Render deployment
2. Hard refresh browser: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
3. Open browser DevTools → Network tab → Check that `widget.iife.js` has new timestamp
4. Test the new feature

## Common Issues

### Widget Changes Not Showing

**Problem:** Widget updated but production shows old version

**Cause:** Forgot to copy build to `backend/public/`

**Solution:**
```bash
cd frontend/widget
npm run deploy
git add backend/public/
git commit -m "Update widget build"
git push
```

### Browser Cache Issues

**Problem:** Deployed but still seeing old widget

**Solution:**
1. Hard refresh: `Ctrl + Shift + R`
2. Clear browser cache
3. Check Network tab for 304 (cached) responses
4. Verify widget file timestamp on server

## Directory Structure

```
aibot/
├── backend/
│   ├── public/                    ← PRODUCTION WIDGET FILES
│   │   ├── widget.iife.js        ← Copy from frontend/widget/dist
│   │   └── widget.css            ← Copy from frontend/widget/dist
│   ├── api/
│   └── server.js
│
├── frontend/
│   ├── widget/
│   │   ├── src/                   ← EDIT HERE
│   │   │   ├── components/
│   │   │   ├── store/
│   │   │   └── main.jsx
│   │   ├── dist/                  ← Build output (gitignored)
│   │   └── package.json
│   │
│   └── admin/
│       ├── src/
│       ├── index.html             ← Loads widget from backend URL
│       └── package.json
│
└── DEPLOYMENT.md                  ← This file
```

## Quick Reference

| Task | Command | Files to Commit |
|------|---------|-----------------|
| Update widget UI | Edit `frontend/widget/src/` | Source files + `backend/public/` |
| Build widget | `cd frontend/widget && npm run build` | - |
| Deploy widget | `cd frontend/widget && npm run deploy` | `backend/public/widget.*` |
| Update admin | Edit `frontend/admin/src/` | Admin source files only |
| Update API | Edit `backend/` | Backend files only |

## Checklist: Widget Update

- [ ] Edit widget source in `frontend/widget/src/`
- [ ] Build widget: `npm run build`
- [ ] Copy to backend: `npm run deploy` or manual copy
- [ ] Commit both source and build files
- [ ] Push to GitHub
- [ ] Wait for Render deployment (2-3 min)
- [ ] Hard refresh browser
- [ ] Test new feature

## Notes

- **Widget source** lives in `frontend/widget/src/`
- **Widget production build** lives in `backend/public/`
- **Both must be updated** when making widget changes
- The admin dashboard loads the widget from the backend URL, not from the widget folder
- Always use `npm run deploy` to ensure build is copied correctly
