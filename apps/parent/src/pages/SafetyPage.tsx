import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SafetyEventDto } from '@pamagochi/contracts';
import { ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function SafetyPage(): React.JSX.Element {
  const { childId } = useParams<{ childId: string }>();
  const [items, setItems] = useState<SafetyEventDto[]>([]);
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (severity) params.set('severity', severity);
        const data = await apiFetch<{ items: SafetyEventDto[] }>(
          `/api/children/${childId}/safety?${params.toString()}`,
        );
        setItems(data.items);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, severity]);

  return (
    <div>
      <h1>События безопасности</h1>
      <p className="link-row">
        <Link to={`/children/${childId}`}>← Назад к профилю</Link>
      </p>
      <label>
        Фильтр по серьёзности
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Все</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </label>
      {loading ? <LoadingState label="Загрузка…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="list-empty">Событий не найдено.</div>
      ) : null}
      {items.map((event) => (
        <div key={event.id} className="card">
          <p>
            <span className="badge">{event.severity}</span> {event.category}
          </p>
          <p className="meta">
            {new Date(event.createdAt).toLocaleString('ru-RU')} · {event.actionTaken}
          </p>
          {event.inputExcerpt ? <p>«{event.inputExcerpt}»</p> : null}
        </div>
      ))}
    </div>
  );
}
