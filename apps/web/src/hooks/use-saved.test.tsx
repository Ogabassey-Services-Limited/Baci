import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SavedProvider, useSaved } from './use-saved';

function TestConsumer() {
  const { savedIds, isSaved, toggleSaved, removeSaved } = useSaved();
  return (
    <div>
      <span data-testid="count">{savedIds.size}</span>
      <span data-testid="is-saved-1">{isSaved('1') ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => toggleSaved('1')}>
        Toggle 1
      </button>
      <button type="button" onClick={() => toggleSaved('2')}>
        Toggle 2
      </button>
      <button type="button" onClick={() => removeSaved('1')}>
        Remove 1
      </button>
    </div>
  );
}

describe('useSaved', () => {
  it('throws when used outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow(
      'useSaved must be used within a SavedProvider'
    );
  });

  it('starts with empty saved set', () => {
    render(
      <SavedProvider>
        <TestConsumer />
      </SavedProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('toggleSaved adds and removes items', async () => {
    const user = userEvent.setup();
    render(
      <SavedProvider>
        <TestConsumer />
      </SavedProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Toggle 1' }));
    expect(screen.getByTestId('is-saved-1').textContent).toBe('yes');

    await user.click(screen.getByRole('button', { name: 'Toggle 1' }));
    expect(screen.getByTestId('is-saved-1').textContent).toBe('no');
  });

  it('removeSaved removes a specific item', async () => {
    const user = userEvent.setup();
    render(
      <SavedProvider>
        <TestConsumer />
      </SavedProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Toggle 1' }));
    await user.click(screen.getByRole('button', { name: 'Toggle 2' }));
    expect(screen.getByTestId('count').textContent).toBe('2');

    await user.click(screen.getByRole('button', { name: 'Remove 1' }));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('is-saved-1').textContent).toBe('no');
  });
});
