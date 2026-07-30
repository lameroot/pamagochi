import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@pamagochi/ui';
import { appProfile } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';

export function RegisterPage(): React.JSX.Element {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const profile = appProfile();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (profile === 'local') {
        await register(email);
        navigate('/children');
      } else {
        setError('В cloud-профиле используйте Supabase Auth (скоро).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Регистрация</h1>
      <p>Создайте родительский аккаунт</p>
      {profile === 'local' ? (
        <form className="form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
            />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? 'Создание…' : 'Зарегистрироваться'}
          </Button>
        </form>
      ) : (
        <p className="meta">Supabase Auth: подключите провайдер в cloud-профиле.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <p className="link-row">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
}
