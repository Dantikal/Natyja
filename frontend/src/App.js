import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import HelpButton from './components/HelpButton';
import TaskDeadlineReminders from './components/TaskDeadlineReminders';
import {AppearanceProvider} from './context/AppearanceContext';
import {TaskNotifications} from './context/TaskNotifications';
import './App.css';
import './office.css';
import './brand.css';
import './product.css';
import './admin.css';
import './experience.css';
import './appearance.css';
const MyTasks = lazy(() => import('./pages/MyTasks'));
const TasksAdmin = lazy(() => import('./pages/TasksAdmin'));
const ReportsArchive = lazy(() => import('./pages/ReportsArchive'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const SoldierCard = lazy(() => import('./pages/SoldierCard'));
const UnitSummary = lazy(() => import('./pages/UnitSummary'));
const Profile = lazy(() => import('./pages/Profile'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Ideas = lazy(() => import('./pages/Ideas'));

function AppLayout({ children, requireAdmin = false, requireTaskManager = false }) {
  return (
    <ProtectedRoute requireAdmin={requireAdmin} requireTaskManager={requireTaskManager}>
      <Navbar />
      {children}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AppearanceProvider><LanguageProvider>
      <AuthProvider><TaskNotifications>
        <BrowserRouter>
          <Suspense fallback={<main className="container" role="status">…</main>}><Routes>
            
            <Route path="/login" element={<Login />} />
            <Route path="/help" element={<Help />} />
            <Route path="/assistant" element={<AppLayout><Assistant /></AppLayout>} />
            <Route path="/ideas" element={<AppLayout><Ideas /></AppLayout>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/my-tasks" element={<AppLayout><MyTasks /></AppLayout>} />
            <Route path="/tasks" element={<AppLayout requireTaskManager><TasksAdmin /></AppLayout>} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
            <Route path="/" element={<Navigate to="/profile" replace />} />
            <Route path="/rating" element={<AppLayout requireTaskManager><Dashboard /></AppLayout>} />
            <Route path="/soldier/:id" element={<AppLayout><SoldierCard /></AppLayout>} />
            <Route path="/unit/:id" element={<AppLayout requireTaskManager><UnitSummary /></AppLayout>} />
            <Route path="/admin" element={<AppLayout requireAdmin><AdminPanel /></AppLayout>} />
            <Route path="/reports" element={<AppLayout><ReportsArchive /></AppLayout>} />
            <Route path="/task-management" element={<Navigate to="/tasks" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes></Suspense>
          <HelpButton />
          <TaskDeadlineReminders />
        </BrowserRouter>
      </TaskNotifications></AuthProvider>
    </LanguageProvider></AppearanceProvider>
  );
}
