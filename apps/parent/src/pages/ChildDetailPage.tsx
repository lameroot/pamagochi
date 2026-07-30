import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ChildOverviewDto, ChildProfileDto } from '@pamagochi/contracts';
import { Button, ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch, gameLaunchUrl } from '../api/client.js';

export function ChildDetailPage(): React.JSX.Element {
  const { childId } = useParams<{ childId: string }>();
  const [child, setChild] = useState<ChildProfileDto | null>(null);
  const [overview, setOverview] = useState<ChildOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!childId) return;
    void (async () => {
      try {
        const [childData, overviewData] = await Promise.all([
          apiFetch<ChildProfileDto>(`/api/children/${childId}`),
          apiFetch<ChildOverviewDto>(`/api/children/${childId}/overview`),
        ]);
        setChild(childData);
        setOverview(overviewData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  async function launchGame(): Promise<void> {
    if (!childId) return;
    setLaunching(true);
    setError(null);
    try {
      const session = await apiFetch<{
        limitedGameToken: string;
        gameLaunchPath: string;
      }>(`/api/children/${childId}/game-sessions`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.open(gameLaunchUrl(session.gameLaunchPath), '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запустить игру');
    } finally {
      setLaunching(false);
    }
  }

  if (loading) return <LoadingState label="Загрузка…" />;
  if (error && !child) return <ErrorState message={error} />;
  if (!child || !overview) return <ErrorState message="Профиль не найден" />;

  return (
    <div>
      <h1>{child.displayName}</h1>
      <p className="meta">
        Возрастная группа: <span className="badge">{overview.ageBand}</span>
        {child.birthYear ? ` · ${child.birthYear} г.р.` : ''}
      </p>
      {overview.lastSession ? (
        <div className="card">
          <h2>Последняя сессия</h2>
          <p className="meta">
            {new Date(overview.lastSession.startedAt).toLocaleString('ru-RU')} ·{' '}
            {overview.lastSession.status}
          </p>
          {overview.lastSession.sessionSummary ? (
            <p>{overview.lastSession.sessionSummary}</p>
          ) : (
            <p className="meta">Без краткого описания</p>
          )}
        </div>
      ) : (
        <p className="meta">Сессий пока не было.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <div className="actions">
        <Button disabled={launching} onClick={() => void launchGame()}>
          {launching ? 'Запуск…' : 'Запустить игру'}
        </Button>
        <Link to={`/children/${childId}/history`}>
          <Button variant="secondary">История</Button>
        </Link>
        <Link to={`/children/${childId}/memory`}>
          <Button variant="secondary">Память</Button>
        </Link>
        <Link to={`/children/${childId}/privacy`}>
          <Button variant="secondary">Приватность</Button>
        </Link>
        <Link to={`/children/${childId}/safety`}>
          <Button variant="secondary">Безопасность</Button>
        </Link>
      </div>
      <p className="link-row">
        <Link to="/children">← К списку детей</Link>
      </p>
    </div>
  );
}
