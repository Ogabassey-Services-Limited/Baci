import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiCheckerTierSelector } from './imei-checker-tier-selector';

describe('ImeiCheckerTierSelector', () => {
  it('renders a card for every displayed tier key', () => {
    render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full', 'activation', 'blacklist', 'carrier']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );

    expect(
      screen.getByRole('radio', {
        name: /full report, .*, ₦1,500/i,
      })
    ).toBeTruthy();
  });

  it('exposes the tier grid as a radiogroup with one radio per key', () => {
    render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full', 'activation', 'blacklist', 'carrier']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /service tier/i })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks the selected tier as aria-checked', () => {
    render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full', 'blacklist']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="blacklist"
        showAllServices={false}
      />
    );

    const radios = screen.getAllByRole('radio');
    const blacklistRadio = radios.find((radio) =>
      radio.getAttribute('aria-label')?.startsWith('Stolen Check')
    );
    expect(blacklistRadio?.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onSelectTier with the tapped tier key', () => {
    const onSelectTier = vi.fn();
    render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full', 'activation']}
        onSelectTier={onSelectTier}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );

    fireEvent.click(
      screen.getByRole('radio', { name: /non-active status pro/i })
    );

    expect(onSelectTier).toHaveBeenCalledWith('activation');
  });

  it('shows the "Show all services" toggle only when canToggleServices is true', () => {
    const { rerender } = render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );
    expect(screen.queryByText('Show all services')).toBeNull();

    rerender(
      <ImeiCheckerTierSelector
        canToggleServices={true}
        displayedTierKeys={['full']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );
    expect(screen.getByText('Show all services')).toBeTruthy();
  });

  it('relabels the toggle to "Show key checks" once expanded', () => {
    render(
      <ImeiCheckerTierSelector
        canToggleServices={true}
        displayedTierKeys={['full']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={true}
      />
    );

    expect(screen.getByText('Show key checks')).toBeTruthy();
  });

  it('calls onToggleServices when the toggle is pressed', () => {
    const onToggleServices = vi.fn();
    render(
      <ImeiCheckerTierSelector
        canToggleServices={true}
        displayedTierKeys={['full']}
        onSelectTier={vi.fn()}
        onToggleServices={onToggleServices}
        selectedTier="full"
        showAllServices={false}
      />
    );

    fireEvent.click(screen.getByText('Show all services'));

    expect(onToggleServices).toHaveBeenCalled();
  });

  it('reveals the selected tier\'s features when "what\'s included" is toggled', () => {
    render(
      <ImeiCheckerTierSelector
        canToggleServices={false}
        displayedTierKeys={['full']}
        onSelectTier={vi.fn()}
        onToggleServices={vi.fn()}
        selectedTier="full"
        showAllServices={false}
      />
    );

    expect(screen.queryByText(/serial number/i)).toBeNull();
    fireEvent.click(screen.getByText(/what's included in full report/i));
    expect(screen.getByText(/serial number/i)).toBeTruthy();
  });
});
