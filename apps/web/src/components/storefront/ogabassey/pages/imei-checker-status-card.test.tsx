import { render, screen } from '@testing-library/react';
import { ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { ImeiCheckerStatusCard } from './imei-checker-status-card';

describe('ImeiCheckerStatusCard', () => {
  it('renders the label, value, and icon', () => {
    render(
      <ImeiCheckerStatusCard
        icon={ShieldCheck}
        label="Blacklist Status"
        toneKey="safe"
        value="Clean"
      />
    );

    expect(screen.getByText('Blacklist Status')).toBeTruthy();
    expect(screen.getByText('Clean')).toBeTruthy();
  });

  it('applies a different tone class for danger vs safe', () => {
    const { rerender } = render(
      <ImeiCheckerStatusCard
        icon={ShieldCheck}
        label="Blacklist Status"
        toneKey="safe"
        value="Clean"
      />
    );
    const safeText = screen.getByText('Clean').className;

    rerender(
      <ImeiCheckerStatusCard
        icon={ShieldCheck}
        label="Blacklist Status"
        toneKey="danger"
        value="Blacklisted"
      />
    );
    const dangerText = screen.getByText('Blacklisted').className;

    expect(safeText).not.toBe(dangerText);
  });
});
