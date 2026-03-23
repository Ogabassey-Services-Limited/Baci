import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MigrationOrderSourceChip from '@/app/dashboard/migrations/migration-order-source-chip';

describe('MigrationOrderSourceChip', () => {
  it('renders a mapped social source label with its icon', () => {
    render(
      <MigrationOrderSourceChip
        sourceChannel="MOBILE"
        sourceOrigin="instagram"
      />
    );

    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Instagram' })).toBeInTheDocument();
  });

  it('falls back to website when origin is missing', () => {
    render(<MigrationOrderSourceChip sourceChannel="MOBILE" />);

    expect(screen.getByText('Website')).toBeInTheDocument();
  });
});
