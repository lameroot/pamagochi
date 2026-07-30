import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ChildPrivacySettingsDto } from '@pamagochi/contracts';
import { Button, ErrorState, LoadingState } from '@pamagochi/ui';
import { apiFetch } from '../api/client.js';

export function PrivacyPage(): React.JSX.Element {
  const { childId } = useParams<{ childId: string }>();
  const [settings, setSettings] = useState<ChildPrivacySettingsDto | null>(null);
  const [retentionDays, setRetentionDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSettings(): Promise<void> {
    if (!childId) return;
    const data = await apiFetch<ChildPrivacySettingsDto>(
      `/api/children/${childId}/privacy/settings`,
    );
    setSettings(data);
    setRetentionDays(data.transcriptRetentionDays?.toString() ?? '');
  }

  useEffect(() => {
    if (!childId) return;
    void (async () => {
      try {
        await loadSettings();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  async function saveSettings(): Promise<void> {
    if (!childId) return;
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<ChildPrivacySettingsDto>(
        `/api/children/${childId}/privacy/settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            transcriptRetentionDays: retentionDays ? Number(retentionDays) : null,
            audioRecordingConsent: settings?.audioRecordingConsent,
          }),
        },
      );
      setSettings(data);
      setMessage('Настройки сохранены');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  }

  async function runAction(path: string, confirmMsg: string): Promise<void> {
    if (!childId || !confirm(confirmMsg)) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/children/${childId}/privacy/${path}`, { method: 'POST' });
      setMessage('Готово');
      await loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка операции');
    }
  }

  async function exportData(): Promise<void> {
    if (!childId) return;
    try {
      const data = await apiFetch<Record<string, unknown>>(
        `/api/children/${childId}/privacy/export`,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `child-${childId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка экспорта');
    }
  }

  if (loading) return <LoadingState label="Загрузка настроек…" />;
  if (error && !settings) return <ErrorState message={error} />;

  return (
    <div>
      <h1>Приватность и данные</h1>
      <p className="link-row">
        <Link to={`/children/${childId}`}>← Назад к профилю</Link>
      </p>
      {message ? <p className="meta">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="card">
        <h2>Хранение транскриптов</h2>
        <label>
          Срок хранения (дней, пусто = без ограничения в UI)
          <input
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
          />
        </label>
        <div className="actions">
          <Button onClick={() => void saveSettings()}>Сохранить</Button>
        </div>
      </div>
      <div className="card">
        <h2>Аудиозапись</h2>
        <p className="meta">
          Разрешено сервером: {settings?.audioRecordingPermitted ? 'да' : 'нет'} · Согласие:{' '}
          {settings?.audioRecordingConsent ? 'дано' : 'нет'}
        </p>
        {settings?.audioRecordingPermitted ? (
          <Button
            variant="secondary"
            onClick={() => {
              if (!settings) return;
              setSettings({ ...settings, audioRecordingConsent: !settings.audioRecordingConsent });
              void (async () => {
                try {
                  const data = await apiFetch<ChildPrivacySettingsDto>(
                    `/api/children/${childId}/privacy/settings`,
                    {
                      method: 'PATCH',
                      body: JSON.stringify({
                        audioRecordingConsent: !settings.audioRecordingConsent,
                      }),
                    },
                  );
                  setSettings(data);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Ошибка');
                }
              })();
            }}
          >
            {settings.audioRecordingConsent ? 'Отозвать согласие' : 'Дать согласие'}
          </Button>
        ) : (
          <p className="meta">AUDIO_RECORDING_ENABLED=false на сервере.</p>
        )}
      </div>
      <div className="card">
        <h2>Управление данными</h2>
        <div className="actions">
          <Button variant="secondary" onClick={() => void exportData()}>
            Экспорт данных
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void runAction('revoke-sessions', 'Отозвать все активные игровые сессии?')
            }
          >
            Отозвать сессии устройства
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runAction('delete-all-history', 'Удалить всю историю разговоров?')}
          >
            Удалить всю историю
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runAction('delete-all-memory', 'Удалить всю память?')}
          >
            Удалить всю память
          </Button>
        </div>
      </div>
    </div>
  );
}
