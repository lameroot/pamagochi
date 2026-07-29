export interface ProfileBadgeProps {
  profile: 'local' | 'cloud';
}

const LABELS: Record<ProfileBadgeProps['profile'], string> = {
  local: 'LOCAL',
  cloud: 'CLOUD',
};

const COLORS: Record<ProfileBadgeProps['profile'], string> = {
  local: '#2f9e44',
  cloud: '#1971c2',
};

/** Small environment indicator badge. Should be hidden in production builds. */
export function ProfileBadge({ profile }: ProfileBadgeProps): React.JSX.Element {
  return (
    <span
      data-testid="profile-badge"
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1,
        color: 'white',
        backgroundColor: COLORS[profile],
      }}
    >
      {LABELS[profile]}
    </span>
  );
}
