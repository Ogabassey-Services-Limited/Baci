import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FollowUpEmptyState } from './FollowUpEmptyState';

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', null),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      error: '#ff3b30',
      primary: '#0a84ff',
      primaryLight: '#e6f2ff',
      success: '#34c759',
      text: '#ffffff',
      textSecondary: '#aeaeb2',
    },
  }),
}));

describe('FollowUpEmptyState', () => {
  it('reports success when there are genuinely no follow-ups', () => {
    render(<FollowUpEmptyState isError={false} onRetry={vi.fn()} />);

    expect(screen.getByText('No issues')).toBeTruthy();
    expect(
      screen.getByText('All recent transactions are successful!')
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports a load failure instead of success when the query errored', () => {
    render(<FollowUpEmptyState isError={true} onRetry={vi.fn()} />);

    expect(screen.getByText("Couldn't load follow-ups")).toBeTruthy();
    expect(screen.getByText(/does not mean\s+there are none/)).toBeTruthy();
    expect(
      screen.queryByText('All recent transactions are successful!')
    ).toBeNull();
  });

  it('calls onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn();
    render(<FollowUpEmptyState isError={true} onRetry={onRetry} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading follow-ups' })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
