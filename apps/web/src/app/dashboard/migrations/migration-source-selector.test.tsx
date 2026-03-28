import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MigrationSourceSelector, {
  type MigrationSourcePlatform,
  SOURCE_COPY,
} from '@/app/dashboard/migrations/migration-source-selector';

function StatefulSelector({
  initialValue = null,
  onValueChange,
}: {
  initialValue?: MigrationSourcePlatform | null;
  onValueChange: (value: MigrationSourcePlatform) => void;
}) {
  const [value, setValue] = useState<MigrationSourcePlatform | null>(
    initialValue
  );

  return (
    <MigrationSourceSelector
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onValueChange(nextValue);
      }}
      value={value}
    />
  );
}

describe('MigrationSourceSelector', () => {
  it('renders the merchant-facing copy for each source card', () => {
    render(<MigrationSourceSelector onValueChange={vi.fn()} value={null} />);

    expect(
      screen.getByRole('heading', { name: /choose your migration source/i })
    ).toBeInTheDocument();

    for (const source of Object.values(SOURCE_COPY)) {
      expect(screen.getByText(source.title)).toBeInTheDocument();
      expect(screen.getByText(source.eyebrow)).toBeInTheDocument();
      expect(screen.getByText(source.description)).toBeInTheDocument();
      expect(screen.getByText(source.availability)).toBeInTheDocument();
    }
  });

  it('selects a source card and reports the chosen platform', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<StatefulSelector onValueChange={onValueChange} />);

    const bumpaButton = screen.getByRole('button', { name: /bumpa/i });
    const shopifyButton = screen.getByRole('button', { name: /shopify/i });

    expect(bumpaButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(shopifyButton);

    expect(onValueChange).toHaveBeenCalledWith('shopify');
    expect(shopifyButton).toHaveAttribute('aria-pressed', 'true');
    expect(bumpaButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports keyboard selection via Tab and Enter/Space', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<StatefulSelector onValueChange={onValueChange} />);

    const bumpaButton = screen.getByRole('button', { name: /bumpa/i });
    const shopifyButton = screen.getByRole('button', { name: /shopify/i });

    await user.tab();
    expect(bumpaButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('bumpa');
    expect(bumpaButton).toHaveAttribute('aria-pressed', 'true');

    await user.tab();
    expect(shopifyButton).toHaveFocus();

    await user.keyboard(' ');
    expect(onValueChange).toHaveBeenCalledWith('shopify');
    expect(shopifyButton).toHaveAttribute('aria-pressed', 'true');
    expect(bumpaButton).toHaveAttribute('aria-pressed', 'false');
  });
});
