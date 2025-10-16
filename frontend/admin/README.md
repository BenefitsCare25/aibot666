# Insurance Chatbot - Admin Dashboard

React-based admin dashboard for managing employees, knowledge base, chat history, and analytics.

## Features

- 📊 **Dashboard**: Overview of key metrics and statistics
- 👥 **Employee Management**: Add, edit, delete employees with Excel upload
- 📚 **Knowledge Base**: Create and manage insurance knowledge entries
- 💬 **Chat History**: View all conversations and search
- 🚨 **Escalations**: Manage low-confidence queries escalated to support
- 📈 **Analytics**: Visual charts and metrics for insights

## Quick Start

### Prerequisites

- Node.js 18+
- Backend API running (see `backend/README.md`)

### Installation

```bash
cd frontend/admin
npm install
```

### Configuration

Create `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

For production:

```env
VITE_API_URL=https://insurance-chatbot-api.onrender.com
```

### Development

```bash
npm run dev
```

Visit http://localhost:3001

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

## Deployment to Render

### Step 1: Create Static Site

1. Go to https://dashboard.render.com
2. Click **New +** → **Static Site**
3. Connect GitHub repository

### Step 2: Configure

| Setting | Value |
|---------|-------|
| Name | `insurance-admin-dashboard` |
| Branch | `main` |
| Root Directory | `frontend/admin` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### Step 3: Environment Variables

Add in Render dashboard:

```env
VITE_API_URL=https://insurance-chatbot-api.onrender.com
```

### Step 4: Deploy

Click **Create Static Site**

Your dashboard will be at:
```
https://insurance-admin-dashboard.onrender.com
```

## Project Structure

```
frontend/admin/
├── src/
│   ├── api/                    # API client functions
│   │   ├── client.js          # Axios instance
│   │   ├── employees.js       # Employee API
│   │   ├── knowledge.js       # Knowledge base API
│   │   └── analytics.js       # Analytics API
│   ├── components/            # Reusable components
│   │   └── Layout.jsx         # Main layout with sidebar
│   ├── pages/                 # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Employees.jsx
│   │   ├── KnowledgeBase.jsx
│   │   ├── ChatHistory.jsx
│   │   ├── Escalations.jsx
│   │   └── Analytics.jsx
│   ├── App.jsx                # Root component with routes
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
└── README.md
```

## Pages Overview

### Dashboard
- Total employees count
- Total queries count
- Escalation rate
- Recent activity
- Quick actions

### Employees
- Paginated employee list
- Search by name, email, or ID
- Add new employee form
- Excel bulk upload (drag-and-drop)
- Download template
- Edit/delete employees

### Knowledge Base
- List all knowledge entries
- Filter by category
- Search content
- Create/edit entries with rich text
- Batch import from JSON
- Delete entries

### Chat History
- All conversations timeline
- Filter by employee, date, escalation status
- Search messages
- View full conversation threads
- Export to CSV

### Escalations
- Pending escalations list
- Resolved escalations
- Filter by status
- View original query and employee info
- Track resolution time

### Analytics
- Query volume trends (Chart.js)
- Confidence score distribution
- Escalation rate over time
- Popular questions
- Response time metrics
- Category breakdown

## API Integration

All API calls use the centralized `api/client.js`:

```javascript
import { employeeApi } from './api/employees';

// Get employees
const { data } = await employeeApi.getAll({ page: 1, limit: 50 });

// Upload Excel
await employeeApi.uploadExcel(file, (progress) => {
  console.log(`Upload: ${progress}%`);
});
```

## Components to Create (Next Steps)

The following page components need to be fully implemented:

### 1. Employees.jsx

```jsx
// Key features:
- Employee table with pagination
- Search bar
- Add employee modal
- Excel upload with react-dropzone
- Download template button
- Edit/delete actions
```

### 2. KnowledgeBase.jsx

```jsx
// Key features:
- Knowledge entries table
- Category filter
- Create/edit modal with rich text editor
- Search functionality
- Batch import from JSON
- Delete confirmation
```

### 3. ChatHistory.jsx

```jsx
// Key features:
- Conversation list
- Date range picker
- Filter by employee/escalation
- Message search
- View full conversation modal
- Export to CSV
```

### 4. Dashboard.jsx

```jsx
// Key features:
- Stat cards (employees, queries, escalations)
- Recent activity feed
- Quick action buttons
- Charts (Chart.js)
```

### 5. Analytics.jsx

```jsx
// Key features:
- Line chart for query trends
- Bar chart for category breakdown
- Pie chart for escalation rate
- Date range selector
- Export report button
```

## Styling

Uses Tailwind CSS with custom configuration:

```javascript
// Primary colors
primary-500: '#3b82f6'  // Blue
primary-600: '#2563eb'

// Sidebar
sidebar-dark: '#1e293b'
```

## State Management

Currently using component-level state with React hooks.

For complex state, consider adding Zustand:

```javascript
import { create } from 'zustand';

const useAdminStore = create((set) => ({
  employees: [],
  setEmployees: (employees) => set({ employees })
}));
```

## Testing

### Manual Testing Checklist

- [ ] Load employee list
- [ ] Search employees
- [ ] Upload Excel file
- [ ] Download template
- [ ] Create knowledge entry
- [ ] View chat history
- [ ] Filter escalations
- [ ] View analytics charts

### Test Data

Use backend scripts to generate test data:

```bash
cd backend
npm run generate-test-data
```

## Customization

### Change Theme Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#10b981' // Change to green
      }
    }
  }
}
```

### Add New Page

1. Create `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`:

```jsx
<Route path="new-page" element={<NewPage />} />
```

3. Add navigation link in `src/components/Layout.jsx`

## Performance

- Code splitting with React lazy loading
- Pagination for large datasets
- Debounced search inputs
- Optimized re-renders with React.memo

## Security

- HTTPS only in production
- API authentication tokens
- CORS validation
- Input sanitization
- XSS protection

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Build Errors

**Issue**: `Module not found`

**Solution**:
```bash
rm -rf node_modules dist
npm install
```

### API Connection Errors

**Issue**: `Network Error` or `CORS`

**Solution**:
1. Verify `VITE_API_URL` is correct
2. Check backend CORS settings include admin dashboard domain
3. Ensure backend is running

### Tailwind Not Working

**Issue**: Styles not applying

**Solution**:
1. Check `tailwind.config.js` content paths
2. Verify `index.css` imports Tailwind directives
3. Restart dev server: `npm run dev`

## Next Steps

1. **Implement Page Components**: Complete all 6 page components
2. **Add Authentication**: Login system for admin users
3. **Real-time Updates**: WebSocket for live data
4. **Export Features**: CSV/PDF export for reports
5. **Dark Mode**: Add dark theme toggle
6. **Notifications**: Toast notifications for actions

## Contributing

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes
3. Test locally: `npm run dev`
4. Build: `npm run build`
5. Commit: `git commit -m "Add new feature"`
6. Push: `git push origin feature/new-feature`

## Support

For issues:
- Check browser console for errors
- Review API responses in Network tab
- Check backend logs on Render

## License

ISC
