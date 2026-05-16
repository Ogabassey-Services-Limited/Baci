import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingFormValues } from '@/schemas/onboarding';

// --- Module Mocks (hoisted before all imports) ---

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/storage', () => ({
  uploadImage: vi.fn(),
}));

vi.mock('@/ai/flows/guide-business-onboarding', () => ({
  guideBusinessOnboarding: vi.fn(),
}));

vi.mock('@/store/onboarding-ui-store', () => {
  const store = {
    setLogoUploaded: vi.fn(),
    setLogoDataUri: vi.fn(),
    setShowMobilePreview: vi.fn(),
    setShowTemplateSelector: vi.fn(),
  };
  return {
    useOnboardingUIStore: (selector?: (state: typeof store) => unknown) =>
      selector ? selector(store) : store,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    children: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/form', () => ({
  FormLabel: ({ children }: { children: React.ReactNode }) => (
    <label htmlFor="test">{children}</label>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    onChange,
    accept,
    disabled,
    type,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type={type}
      onChange={onChange}
      accept={accept}
      disabled={disabled}
      data-testid="file-input"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress-bar" data-value={value} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/color-picker', () => ({
  ColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (color: string) => void;
  }) => (
    <div data-testid="color-picker">
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        data-testid="color-input"
      />
    </div>
  ),
}));

vi.mock('@/components/logo-generator-modal', () => ({
  LogoGeneratorModal: ({
    isOpen,
    onGenerate,
    children,
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerate: (color: string) => void;
    isGenerating: boolean;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="logo-generator-modal">
        <button type="button" onClick={() => onGenerate('#FF0000')}>
          Generate Logo
        </button>
        {children}
      </div>
    ) : (
      children
    ),
}));

vi.mock('next/dynamic', () => ({
  default: (
    fn: () => Promise<{ ColorPicker?: unknown; LogoGeneratorModal?: unknown }>
  ) => {
    const moduleName = fn.toString();
    if (moduleName.includes('color-picker')) {
      return ({
        color,
        onChange,
      }: {
        color: string;
        onChange: (color: string) => void;
      }) => (
        <div data-testid="color-picker">
          <input
            type="color"
            value={color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
            data-testid="color-input"
          />
        </div>
      );
    }
    if (moduleName.includes('logo-generator-modal')) {
      return ({
        isOpen,
        onGenerate,
        children,
      }: {
        isOpen: boolean;
        onGenerate: (color: string) => void;
        children?: React.ReactNode;
      }) =>
        isOpen ? (
          <div data-testid="logo-generator-modal">
            <button type="button" onClick={() => onGenerate('#FF0000')}>
              Generate Logo
            </button>
            {children}
          </div>
        ) : (
          children
        );
    }
    return () => null;
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: Mock of next/image for testing
    <img src={src} alt={alt} data-testid="logo-image" />
  ),
}));

vi.mock('@/lib/extract-brand-colors', () => ({
  extractBrandColorsFromImage: vi.fn(),
}));

import { extractBrandColorsFromImage } from '@/lib/extract-brand-colors';
import { uploadImage } from '@/lib/storage';
// --- Import after all mocks ---
import Step2_Branding from './step2-branding';

const mockUploadImage = vi.mocked(uploadImage);
const mockExtractBrandColorsFromImage = vi.mocked(extractBrandColorsFromImage);

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm<OnboardingFormValues>({
    defaultValues: {
      businessName: 'Test Store',
      businessType: 'fashion',
      logoUrl: '',
      brandColors: '',
      brandPreferences: '',
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('Step2_Branding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadImage.mockResolvedValue('https://example.com/logo.png');
    mockExtractBrandColorsFromImage.mockResolvedValue({
      primary: '#FF0000',
      background: '#FFFFFF',
      accent: '#00FF00',
    });

    // Mock FileReader
    global.FileReader = class FileReader {
      onloadend:
        | ((this: FileReader, ev: ProgressEvent<FileReader>) => void)
        | null = null;
      onerror:
        | ((this: FileReader, ev: ProgressEvent<FileReader>) => void)
        | null = null;
      result: string | ArrayBuffer | null = 'data:image/png;base64,test';

      readAsDataURL() {
        if (this.onloadend) {
          this.onloadend.call(
            this as unknown as FileReader,
            {} as ProgressEvent<FileReader>
          );
        }
      }

      addEventListener() {
        // Mock implementation
      }

      removeEventListener() {
        // Mock implementation
      }

      dispatchEvent() {
        return true;
      }
    } as unknown as typeof FileReader;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders logo upload section', () => {
    render(
      <TestWrapper>
        <Step2_Branding />
      </TestWrapper>
    );

    expect(screen.getByText(/logo & brand/i)).toBeInTheDocument();
    expect(screen.getByText(/click to upload image/i)).toBeInTheDocument();
  });

  it('renders AI logo generator button when no logo is uploaded', () => {
    render(
      <TestWrapper>
        <Step2_Branding />
      </TestWrapper>
    );

    expect(
      screen.getByRole('button', { name: /generate with ai/i })
    ).toBeInTheDocument();
  });

  it('uploads logo when file is selected', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Step2_Branding />
      </TestWrapper>
    );

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const input = screen.getAllByTestId('file-input')[0];

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalledWith(
        'data:image/png;base64,test'
      );
    });
  });

  it('shows color customization UI when logo is uploaded', () => {
    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          logoUrl: 'data:image/png;base64,test',
          brandColors: JSON.stringify({
            primary: '#FF0000',
            background: '#FFFFFF',
            accent: '#0000FF',
          }),
        },
      });

      return (
        <FormProvider {...methods}>
          <Step2_Branding />
        </FormProvider>
      );
    };

    render(<TestForm />);

    expect(screen.getByText(/customise colours/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('color-picker').length).toBeGreaterThan(0);
  });

  it('shows remove background button when logo is uploaded', () => {
    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          logoUrl: 'data:image/png;base64,test',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step2_Branding />
        </FormProvider>
      );
    };

    render(<TestForm />);

    expect(
      screen.getByRole('button', { name: /remove background/i })
    ).toBeInTheDocument();
  });

  it('shuffles colors when shuffle button is clicked', async () => {
    const user = userEvent.setup();

    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          logoUrl: 'data:image/png;base64,test',
          brandColors: JSON.stringify({
            primary: '#FF0000',
            background: '#FFFFFF',
            accent: '#0000FF',
          }),
        },
      });

      return (
        <FormProvider {...methods}>
          <Step2_Branding />
          <div data-testid="brand-colors">{methods.watch('brandColors')}</div>
        </FormProvider>
      );
    };

    render(<TestForm />);

    const shuffleButton = screen.getByRole('button', {
      name: /shuffle colors/i,
    });
    await user.click(shuffleButton);

    await waitFor(() => {
      const colors = JSON.parse(
        screen.getByTestId('brand-colors').textContent || '{}'
      );
      // Colors should be remapped (primary -> accent, background -> primary, accent -> background)
      expect(colors.primary).toBe('#0000FF'); // Was accent
      expect(colors.background).toBe('#FF0000'); // Was primary
      expect(colors.accent).toBe('#FFFFFF'); // Was background
    });
  });

  it('shows mobile action buttons on mobile viewport', () => {
    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          logoUrl: 'data:image/png;base64,test',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step2_Branding />
        </FormProvider>
      );
    };

    render(<TestForm />);

    // These buttons are visible on lg:hidden (mobile)
    expect(
      screen.getByRole('button', { name: /preview store/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose template/i })
    ).toBeInTheDocument();
  });

  it('disables buttons during loading state', async () => {
    const user = userEvent.setup();

    mockUploadImage.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve('https://example.com/logo.png'), 1000)
        )
    );

    render(
      <TestWrapper>
        <Step2_Branding />
      </TestWrapper>
    );

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const input = screen.getAllByTestId('file-input')[0];

    await user.upload(input, file);

    // File inputs should be disabled
    await waitFor(() => {
      const inputs = screen.getAllByTestId('file-input');
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });
});
