import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChildAvatarKey } from '@pamagochi/contracts';
import { Button } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

const AVATARS: ChildAvatarKey[] = ['fox', 'owl', 'panda', 'dragon'];

export function ChildNewPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>('fox');
  const [birthYear, setBirthYear] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('ru');
  const [readingLevel, setReadingLevel] = useState('');
  const [mathLevel, setMathLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const child = await apiFetch<{ id: string }>('/api/children', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          avatarKey,
          birthYear: birthYear ? Number(birthYear) : undefined,
          primaryLanguage,
          readingLevel: readingLevel || undefined,
          mathLevel: mathLevel || undefined,
        }),
      });
      navigate(`/children/${child.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Новый профиль ребёнка</h1>
      <form className="form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Имя
          <input
            required
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          Аватар
          <select
            value={avatarKey}
            onChange={(e) => setAvatarKey(e.target.value as ChildAvatarKey)}
          >
            {AVATARS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          Год рождения
          <input
            type="number"
            min={2000}
            max={2100}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </label>
        <label>
          Язык
          <input value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} />
        </label>
        <label>
          Уровень чтения
          <input value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} />
        </label>
        <label>
          Уровень математики
          <input value={mathLevel} onChange={(e) => setMathLevel(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение…' : 'Создать'}
        </Button>
      </form>
    </div>
  );
}
