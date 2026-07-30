import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MemoryItemDto } from '@pamagochi/contracts';
import { Button, ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function MemoryPage(): React.JSX.Element {
  const { childId } = useParams<{ childId: string }>();
  const [items, setItems] = useState<MemoryItemDto[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(): Promise<void> {
    if (!childId) return;
    const data = await apiFetch<{ items: MemoryItemDto[] }>(`/api/children/${childId}/memory`);
    setItems(data.items);
  }

  useEffect(() => {
    if (!childId) return;
    void (async () => {
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  async function addNote(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!childId || !newNote.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/children/${childId}/memory`, {
        method: 'POST',
        body: JSON.stringify({ category: 'parent_note', fact: newNote.trim() }),
      });
      setNewNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(item: MemoryItemDto): Promise<void> {
    if (!childId) return;
    await apiFetch(`/api/children/${childId}/memory/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned: !item.pinned }),
    });
    await load();
  }

  async function toggleDisabled(item: MemoryItemDto): Promise<void> {
    if (!childId) return;
    await apiFetch(`/api/children/${childId}/memory/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: item.status === 'active' ? 'disabled' : 'active' }),
    });
    await load();
  }

  async function removeItem(item: MemoryItemDto): Promise<void> {
    if (!childId || !confirm('Удалить запись памяти?')) return;
    await apiFetch(`/api/children/${childId}/memory/${item.id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <LoadingState label="Загрузка памяти…" />;
  if (error && items.length === 0) return <ErrorState message={error} />;

  return (
    <div>
      <h1>Память</h1>
      <p className="link-row">
        <Link to={`/children/${childId}`}>← Назад к профилю</Link>
      </p>
      <form className="form card" onSubmit={(e) => void addNote(e)}>
        <h2>Добавить заметку</h2>
        <textarea
          maxLength={280}
          rows={3}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Безопасная заметка для агента…"
        />
        <Button type="submit" disabled={saving || !newNote.trim()}>
          Добавить
        </Button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {items.length === 0 ? (
        <div className="list-empty">Записей памяти нет.</div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            <p>
              {item.pinned ? <span className="badge">закреплено</span> : null}{' '}
              <strong>[{item.category}]</strong> {item.fact}
            </p>
            <p className="meta">
              {item.source} · {item.status} · обновлено{' '}
              {new Date(item.updatedAt).toLocaleString('ru-RU')}
            </p>
            <div className="actions">
              <Button variant="secondary" onClick={() => void togglePin(item)}>
                {item.pinned ? 'Открепить' : 'Закрепить'}
              </Button>
              <Button variant="secondary" onClick={() => void toggleDisabled(item)}>
                {item.status === 'active' ? 'Отключить' : 'Включить'}
              </Button>
              <Button variant="secondary" onClick={() => void removeItem(item)}>
                Удалить
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
