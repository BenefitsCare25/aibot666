import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import KnowledgeBase from './pages/KnowledgeBase';
import ChatHistory from './pages/ChatHistory';
import Escalations from './pages/Escalations';
import Companies from './pages/Companies';
import QuickQuestions from './pages/QuickQuestions';
import AISettings from './pages/AISettings';
import AdminUsers from './pages/AdminUsers';
import Roles from './pages/Roles';

export default function App() {
  return (
    <AuthProvider>
      <SessionTimeoutModal />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="quick-questions" element={<QuickQuestions />} />
          <Route path="chat-history" element={<ChatHistory />} />
          <Route path="escalations" element={<Escalations />} />
          <Route path="companies" element={<Companies />} />

          {/* Super Admin Only Routes */}
          <Route path="ai-settings" element={
            <ProtectedRoute requireSuperAdmin>
              <AISettings />
            </ProtectedRoute>
          } />
          <Route path="admin-users" element={
            <ProtectedRoute requireSuperAdmin>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="roles" element={
            <ProtectedRoute requireSuperAdmin>
              <Roles />
            </ProtectedRoute>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
