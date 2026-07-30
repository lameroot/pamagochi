import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ConversationListItemDto } from '@pamagochi/contracts';
import { ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function ConversationHistoryPage(): React.JSX.Element {
  const { childId } = useParams<{ childId: string }>();
  const [items, setItems] = useState<ConversationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    void (async () => {
      try {
        const data = await apiFetch<{ items: ConversationListItemDto[] }>(
          `/api/children/${childId}/conversations`,
        );
        setItems(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  if (loading) return <LoadingState label="Загрузка истории…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h1>История разговоров</h1>
      <p className="link-row">
        <Link to={`/children/${childId}`}>← Назад к профилю</Link>
      </p>
      {items.length === 0 ? (
        <div className="list-empty">Разговоров пока нет.</div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            <h2>
              <Link to={`/children/${childId}/history/${item.id}`}>
                {new Date(item.startedAt).toLocaleString('ru-RU')}
              </Link>
            </h2>
            <p className="meta">
              {item.turnCount} реплик
              {item.durationSeconds != null ? ` · ${item.durationSeconds} сек` : ''}
              {item.safetyFlagCount > 0 ? ` · ⚠ ${item.safetyFlagCount}` : ''}
            </p>
            {item.sessionSummary ? <p>{item.sessionSummary}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}
