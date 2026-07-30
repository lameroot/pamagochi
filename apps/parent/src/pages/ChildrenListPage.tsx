import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChildProfileDto } from '@pamagochi/contracts';
import { Button, ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function ChildrenListPage(): React.JSX.Element {
  const [children, setChildren] = useState<ChildProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ children: ChildProfileDto[] }>('/api/children');
        setChildren(data.children);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить список');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState label="Загрузка профилей…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Дети</h1>
        <Link to="/children/new">
          <Button>Добавить ребёнка</Button>
        </Link>
      </div>
      {children.length === 0 ? (
        <div className="list-empty">
          <p>Пока нет профилей детей.</p>
          <Link to="/children/new">Создать первый профиль</Link>
        </div>
      ) : (
        children.map((child) => (
          <div key={child.id} className="card">
            <h2>
              <Link to={`/children/${child.id}`}>{child.displayName}</Link>
            </h2>
            <p className="meta">
              Аватар: {child.avatarKey}
              {child.birthYear ? ` · ${child.birthYear} г.р.` : ''}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
