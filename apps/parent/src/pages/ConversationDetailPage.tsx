import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ConversationDetailDto } from '@pamagochi/contracts';
import { ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function ConversationDetailPage(): React.JSX.Element {
  const { childId, conversationId } = useParams<{ childId: string; conversationId: string }>();
  const [detail, setDetail] = useState<ConversationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId || !conversationId) return;
    void (async () => {
      try {
        const data = await apiFetch<ConversationDetailDto>(
          `/api/children/${childId}/conversations/${conversationId}`,
        );
        setDetail(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, conversationId]);

  if (loading) return <LoadingState label="Загрузка транскрипта…" />;
  if (error) return <ErrorState message={error} />;
  if (!detail) return <ErrorState message="Разговор не найден" />;

  return (
    <div>
      <h1>Разговор</h1>
      <p className="meta">
        {new Date(detail.startedAt).toLocaleString('ru-RU')}
        {detail.durationSeconds != null ? ` · ${detail.durationSeconds} сек` : ''} ·{' '}
        {detail.turnCount} реплик
      </p>
      <p className="meta">
        SOUL {detail.soulVersion ?? '—'} · Safety {detail.safetyPolicyVersion ?? '—'}
        {detail.llmModel ? ` · ${detail.llmProvider}/${detail.llmModel}` : ''}
      </p>
      {detail.sessionSummary ? (
        <div className="card">
          <h2>Краткое содержание</h2>
          <p>{detail.sessionSummary}</p>
        </div>
      ) : null}
      {detail.safetyEvents.length > 0 ? (
        <div className="card">
          <h2>События безопасности ({detail.safetyEvents.length})</h2>
          {detail.safetyEvents.map((e) => (
            <p key={e.id} className="meta">
              [{e.severity}] {e.category}: {e.actionTaken}
              {e.inputExcerpt ? ` — «${e.inputExcerpt}»` : ''}
            </p>
          ))}
        </div>
      ) : null}
      {detail.toolActions.length > 0 ? (
        <div className="card">
          <h2>Действия агента</h2>
          {detail.toolActions.map((t) => (
            <p key={t.id} className="meta">
              {t.toolName} ({t.validationResult})
            </p>
          ))}
        </div>
      ) : null}
      {detail.proposedMemory.length > 0 ? (
        <div className="card">
          <h2>Предложенная память</h2>
          {detail.proposedMemory.map((m) => (
            <p key={m.id}>
              [{m.category}] {m.fact}
            </p>
          ))}
        </div>
      ) : null}
      <h2>Транскрипт</h2>
      {detail.turns.map((turn) => (
        <div
          key={turn.id}
          className={`turn turn-${turn.speaker === 'system_event' ? 'system' : turn.speaker}`}
        >
          <strong>{turn.speaker}</strong>
          {turn.wasInterrupted ? <span className="badge"> прервано</span> : null}
          <p>{turn.text}</p>
          {turn.safetyFlags.length > 0 ? (
            <p className="meta">Флаги: {turn.safetyFlags.join(', ')}</p>
          ) : null}
        </div>
      ))}
      <p className="link-row">
        <Link to={`/children/${childId}/history`}>← К истории</Link>
      </p>
    </div>
  );
}
