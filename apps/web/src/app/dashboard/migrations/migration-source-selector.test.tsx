import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MigrationSourceSelector, {
  type MigrationSourcePlatform,
  SOURCE_COPY,
} from '@/app/dashboard/migrations/migration-source-selector';

function StatefulSelector({
  initialValue = 'bumpa',
  onValueChange,
}: {
  initialValue?: MigrationSourcePlatform;
  onValueChange: (value: MigrationSourcePlatform) => void;
}) {
  const [value, setValue] = useState<MigrationSourcePlatform>(initialValue);

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
  it('renders copy for each source platform', () => {
    render(<MigrationSourceSelector onValueChange={vi.fn()} value="bumpa" />);

    for (const source of Object.values(SOURCE_COPY)) {
      expect(screen.getByText(source.title)).toBeInTheDocument();
      expect(screen.getByText(source.eyebrow)).toBeInTheDocument();
      expect(screen.getByText(source.description)).toBeInTheDocument();
    }
  });

  it('switches tabs and reports the selected source platform', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<StatefulSelector onValueChange={onValueChange} />);

    expect(
      screen.getByRole('tab', { name: /bumpa/i, selected: true })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /shopify/i }));

    expect(onValueChange).toHaveBeenCalledWith('shopify');
    expect(
      screen.getByRole('tab', { name: /shopify/i, selected: true })
    ).toBeInTheDocument();
  });
});
