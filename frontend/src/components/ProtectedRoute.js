import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false, requireTaskManager = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (requireTaskManager && !['admin', 'commander'].includes(user.role)) return <Navigate to="/my-tasks" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/my-tasks" replace />;
  return children;
}
