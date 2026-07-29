import { useEffect, useMemo, useState } from 'react';
import { ProfileBadge } from '@pamagochi/ui';
import { getAuthClient } from '../auth/create-auth-client.js';
import { ChildrenPanel } from '../components/ChildrenPanel.js';
import { ApiStatusBadge } from '../components/ApiStatusBadge.js';
import { GameCanvas } from '../components/GameCanvas.js';
import { createGameBridge } from '../game/bridge/game-bridge.js';
import { createApiClient } from '../lib/api-client.js';
import { webEnv } from '../lib/env.js';
import { useAppStore } from '../lib/store.js';
import { useApiHealth } from './useApiHealth.js';

export function App(): React.JSX.Element {
  const authClient = useMemo(() => getAuthClient(), []);
  const apiClient = useMemo(() => createApiClient(() => authClient.getAccessToken()), [authClient]);
  const bridge = useMemo(() => createGameBridge(), []);

  const apiStatus = useApiHealth(apiClient);
  const activeChildName = useAppStore((s) => s.activeChildName);
  const sceneReady = useAppStore((s) => s.sceneReady);
  const setActiveChildName = useAppStore((s) => s.setActiveChildName);
  const setSceneReady = useAppStore((s) => s.setSceneReady);

  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    authClient.getAccessToken().catch((error: unknown) => {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    });
  }, [authClient]);

  useEffect(
    () =>
      bridge.onGameToReactEvent((event) => {
        if (event.type === 'scene-ready') setSceneReady(true);
      }),
    [bridge, setSceneReady],
  );

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Памагочи</h1>
        <ProfileBadge profile={webEnv.appProfile} />
        <ApiStatusBadge status={apiStatus} />
        {authClient.isDevMode() ? (
          <span style={{ fontSize: 12, color: '#868e96' }}>режим разработчика</span>
        ) : null}
      </header>

      {authError ? <p style={{ color: '#c92a2a' }}>{authError}</p> : null}

      <section style={{ marginBottom: 24 }}>
        <p data-testid="scene-status">Игровая сцена: {sceneReady ? 'готова' : 'загружается…'}</p>
        <GameCanvas bridge={bridge} activeChildName={activeChildName ?? 'друг'} />
      </section>

      <section>
        <ChildrenPanel apiClient={apiClient} onSelectActiveChild={setActiveChildName} />
      </section>
    </main>
  );
}
