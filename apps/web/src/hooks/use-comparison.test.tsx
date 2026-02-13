import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ComparisonProvider, useComparison } from './use-comparison';

function TestConsumer() {
  const { comparisonIds, isInComparison, toggleComparison, clearComparison } =
    useComparison();
  return (
    <div>
      <span data-testid="count">{comparisonIds.size}</span>
      <span data-testid="has-a">{isInComparison('a') ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => toggleComparison('a')}>
        Toggle A
      </button>
      <button type="button" onClick={() => toggleComparison('b')}>
        Toggle B
      </button>
      <button type="button" onClick={() => clearComparison()}>
        Clear
      </button>
    </div>
  );
}

describe('useComparison', () => {
  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow(
      'useComparison must be used within a ComparisonProvider'
    );
  });

  it('starts with empty comparison set', () => {
    render(
      <ComparisonProvider>
        <TestConsumer />
      </ComparisonProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('toggleComparison adds and removes items', async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <TestConsumer />
      </ComparisonProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Toggle A' }));
    expect(screen.getByTestId('has-a').textContent).toBe('yes');
    expect(screen.getByTestId('count').textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Toggle A' }));
    expect(screen.getByTestId('has-a').textContent).toBe('no');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('clearComparison removes all items', async () => {
    const user = userEvent.setup();
    render(
      <ComparisonProvider>
        <TestConsumer />
      </ComparisonProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Toggle A' }));
    await user.click(screen.getByRole('button', { name: 'Toggle B' }));
    expect(screen.getByTestId('count').textContent).toBe('2');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
