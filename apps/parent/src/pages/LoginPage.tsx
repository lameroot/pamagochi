import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@pamagochi/ui';
import { appProfile } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';

export function LoginPage(): React.JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const profile = appProfile();

  async function handleLogin(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      if (profile === 'local') {
        await login();
        navigate('/children');
      } else {
        setError('В cloud-профиле используйте Supabase Auth (скоро).');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Вход</h1>
      <p>Родительский кабинет Памагочи</p>
      {profile === 'local' ? (
        <div className="form">
          <Button disabled={loading} onClick={() => void handleLogin()}>
            {loading ? 'Вход…' : 'Войти (локальный профиль)'}
          </Button>
        </div>
      ) : (
        <p className="meta">Supabase Auth: подключите провайдер в cloud-профиле.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <p className="link-row">
        Нет аккаунта? <Link to="/register">Регистрация</Link>
      </p>
    </div>
  );
}
