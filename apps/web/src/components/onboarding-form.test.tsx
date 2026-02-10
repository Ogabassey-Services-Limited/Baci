import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module Mocks (hoisted before all imports) ---

const mockFormAction = vi.fn();
const mockToast = vi.fn();
const mockPush = vi.fn();

vi.mock('@/app/onboarding/actions', () => ({
  submitOnboarding: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => null;
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/analytics/platform-analytics-provider', () => ({
  trackMerchantSignupStarted: vi.fn(),
  trackMerchantSignupCompleted: vi.fn(),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/onboarding/steps/step1-business-details', () => ({
  default: () => <div data-testid="step1">Step 1 Content</div>,
}));

vi.mock('@/components/onboarding/steps/step2-branding', () => ({
  default: () => <div data-testid="step2">Step 2 Content</div>,
}));

vi.mock('@/components/onboarding/steps/step3-account', () => ({
  default: () => <div data-testid="step3">Step 3 Content</div>,
}));

vi.mock('@/components/ui/bag-loader', () => ({
  BagLoader: () => <div data-testid="bag-loader" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    children: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: (props: { value: number; 'aria-label'?: string }) => (
    <div
      role="progressbar"
      aria-valuenow={props.value}
      aria-label={props['aria-label']}
    />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <h5>{children}</h5>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
  }),
}));

vi.mock('@/store/onboarding-ui-store', () => ({
  useOnboardingUIStore: () => null,
}));

vi.mock('./onboarding-puck-preview', () => ({
  OnboardingPuckPreview: () => <div data-testid="puck-preview" />,
}));

// Mock useActionState and useTransition from React
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () =>
      [{ message: '', success: false }, mockFormAction, false] as const,
    useTransition: () => [false, (fn: () => void) => fn()] as const,
  };
});

// --- Import after all mocks ---
import OnboardingForm from './onboarding-form';

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the welcome heading', () => {
    render(<OnboardingForm />);
    expect(
      screen.getByRole('heading', { name: /welcome to baci/i })
    ).toBeInTheDocument();
  });

  it('renders step 1 content initially', () => {
    render(<OnboardingForm />);
    expect(screen.getByTestId('step1')).toBeInTheDocument();
    expect(screen.queryByTestId('step2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step3')).not.toBeInTheDocument();
  });

  it('shows step indicator with "Step 1 of 3"', () => {
    render(<OnboardingForm />);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('shows progress bar with aria-label', () => {
    render(<OnboardingForm />);
    expect(
      screen.getByRole('progressbar', { name: /onboarding progress/i })
    ).toBeInTheDocument();
  });

  it('shows Next button on step 1', () => {
    render(<OnboardingForm />);
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('does not show Previous button on step 1', () => {
    render(<OnboardingForm />);
    expect(
      screen.queryByRole('button', { name: /previous/i })
    ).not.toBeInTheDocument();
  });

  it('shows the logo', () => {
    render(<OnboardingForm />);
    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('shows "Already have an account?" link to login', () => {
    render(<OnboardingForm />);
    const link = screen.getByRole('link', { name: /log in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('renders the form with correct aria-label', () => {
    render(<OnboardingForm />);
    expect(
      screen.getByRole('form', { name: /store onboarding form/i })
    ).toBeInTheDocument();
  });
});
