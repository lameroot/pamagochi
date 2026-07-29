export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Загрузка...' }: LoadingStateProps): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" style={{ padding: 16, color: '#555' }}>
      {label}
    </div>
  );
}
