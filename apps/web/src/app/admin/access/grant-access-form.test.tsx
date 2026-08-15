import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));

import { GrantAccessForm } from './grant-access-form';

describe('GrantAccessForm', () => {
  it('requires confirmation before saving platform access', () => {
    render(<GrantAccessForm onUpdated={async () => {}} />);

    expect(
      screen.getByRole('button', { name: 'Save platform access' })
    ).toBeDisabled();
  });
});
