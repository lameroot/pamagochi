import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@pamagochi/ui';
import { useAuth } from '../auth/AuthContext.js';

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #dee2e6',
  background: '#f8f9fa',
};

export function Layout(): React.JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={navStyle}>
        <Link to="/children" style={{ fontWeight: 700, textDecoration: 'none', color: '#212529' }}>
          Памагочи
        </Link>
        <Link to="/children">Дети</Link>
        <div style={{ flex: 1 }} />
        <Button
          variant="secondary"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Выйти
        </Button>
      </nav>
      <main style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
