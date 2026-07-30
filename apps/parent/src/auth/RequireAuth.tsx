import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
