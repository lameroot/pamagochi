import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileBadge } from './ProfileBadge.js';

describe('ProfileBadge', () => {
  it('renders LOCAL for the local profile', () => {
    render(<ProfileBadge profile="local" />);
    expect(screen.getByTestId('profile-badge')).toHaveTextContent('LOCAL');
  });

  it('renders CLOUD for the cloud profile', () => {
    render(<ProfileBadge profile="cloud" />);
    expect(screen.getByTestId('profile-badge')).toHaveTextContent('CLOUD');
  });
});
