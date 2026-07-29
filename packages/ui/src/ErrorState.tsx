export interface ErrorStateProps {
  message: string;
  requestId?: string;
}

export function ErrorState({ message, requestId }: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      style={{
        padding: 16,
        borderRadius: 8,
        background: '#fff5f5',
        border: '1px solid #ffa8a8',
        color: '#c92a2a',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>{message}</p>
      {requestId ? (
        <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }}>Request ID: {requestId}</p>
      ) : null}
    </div>
  );
}
