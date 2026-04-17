import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type z from 'zod';
import {
  type OnboardingFormValues,
  onboardingSchema,
} from '@/schemas/onboarding';
import Step3_Account from './step3-account';

vi.mock('@/app/onboarding/actions', () => ({
  sendMagicLink: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm<
    z.input<typeof onboardingSchema>,
    unknown,
    OnboardingFormValues
  >({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      businessName: '',
      businessType: '',
      logoUrl: '',
      brandColors: '',
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('Step3_Account', () => {
  it('shows confirm password for medium-strength passwords that are acceptable to the schema', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Step3_Account
          onKeyDown={vi.fn()}
          onMagicLinkSent={vi.fn()}
          user={null}
        />
      </TestWrapper>
    );

    await user.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    );
    await user.type(
      screen.getByPlaceholderText('Create a strong password'),
      'Longpass10'
    );

    expect(
      await screen.findByPlaceholderText('Re-enter your password')
    ).toBeInTheDocument();
  });
});
