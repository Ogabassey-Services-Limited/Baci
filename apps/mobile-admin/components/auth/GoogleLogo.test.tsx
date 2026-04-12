import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoogleLogo } from '@/components/auth/GoogleLogo';

vi.mock('react-native-svg', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('svg', { 'aria-label': 'google-logo' }, children),
    Path: () => React.createElement('path'),
  };
});

describe('GoogleLogo', () => {
  it('renders the google svg mark', () => {
    const { container } = render(<GoogleLogo />);

    expect(container.querySelector('svg')).toBeTruthy();
  });
});
