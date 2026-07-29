export type ApiStatus = 'checking' | 'online' | 'offline';

const LABEL: Record<ApiStatus, string> = {
  checking: 'API: проверка…',
  online: 'API: online',
  offline: 'API: offline',
};

const COLOR: Record<ApiStatus, string> = {
  checking: '#adb5bd',
  online: '#2f9e44',
  offline: '#e03131',
};

export function ApiStatusBadge({ status }: { status: ApiStatus }): React.JSX.Element {
  return (
    <span data-testid="api-status" style={{ color: COLOR[status], fontWeight: 600, fontSize: 14 }}>
      {LABEL[status]}
    </span>
  );
}
