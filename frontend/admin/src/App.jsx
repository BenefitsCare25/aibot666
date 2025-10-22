import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import KnowledgeBase from './pages/KnowledgeBase';
import ChatHistory from './pages/ChatHistory';
import Escalations from './pages/Escalations';
import Analytics from './pages/Analytics';
import Companies from './pages/Companies';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="chat-history" element={<ChatHistory />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="companies" element={<Companies />} />
      </Route>
    </Routes>
  );
}
