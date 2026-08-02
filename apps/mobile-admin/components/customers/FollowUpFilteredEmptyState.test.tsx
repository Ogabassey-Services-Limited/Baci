import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FollowUpFilteredEmptyState } from './FollowUpFilteredEmptyState';

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', null) };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#ffffff',
      textMuted: '#666666',
      textSecondary: '#aeaeb2',
    },
  }),
}));

describe('FollowUpFilteredEmptyState', () => {
  it('explains that the active search found no follow-ups', () => {
    render(<FollowUpFilteredEmptyState />);

    expect(screen.getByText('No matching follow-ups')).toBeTruthy();
    expect(
      screen.getByText(
        'Try a different search to find recent unsuccessful transactions.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('No issues')).toBeNull();
  });
});
