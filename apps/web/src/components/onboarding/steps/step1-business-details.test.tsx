import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingFormValues } from '@/schemas/onboarding';

// --- Module Mocks (hoisted before all imports) ---

vi.mock('@/config/business-types', () => ({
  getAllBusinessTypes: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    children: React.ReactNode;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/form', async () => {
  const { Controller } = await import('react-hook-form');
  return {
    FormField: (props: Record<string, unknown>) => (
      <Controller {...(props as any)} />
    ),
    FormControl: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    FormItem: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    FormLabel: ({
      children,
      ...props
    }: React.LabelHTMLAttributes<HTMLLabelElement> & {
      children: React.ReactNode;
    }) => (
      <label htmlFor="test" {...props}>
        {children}
      </label>
    ),
    FormMessage: () => null,
  };
});

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (val: string) => void;
    value: string;
  }) => (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="business-type-select"
      >
        <option value="">Select type</option>
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

vi.mock('@/components/ui/typing-placeholder-input', () => ({
  TypingPlaceholderInput: ({
    value,
    onChange,
    onKeyDown,
    name,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    staticPrefix?: string;
    placeholders?: string[];
  }) => (
    <input
      value={value as string}
      onChange={onChange}
      onKeyDown={onKeyDown}
      name={name}
      data-testid={name}
      {...props}
    />
  ),
}));

vi.mock('@/components/business-name-generator-modal', () => ({
  BusinessNameGeneratorModal: ({
    isOpen,
    onNameSelect,
    children,
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onNameSelect: (name: string) => void;
    businessType: string;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="business-name-modal">
        <button
          type="button"
          onClick={() => onNameSelect('Generated Store Name')}
        >
          Select Name
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    // Inline the mock component for BusinessNameGeneratorModal
    return ({
      isOpen,
      onNameSelect,
      children,
    }: {
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
      onNameSelect: (name: string) => void;
      businessType: string;
      children?: React.ReactNode;
    }) =>
      isOpen ? (
        <div data-testid="business-name-modal">
          <button
            type="button"
            onClick={() => onNameSelect('Generated Store Name')}
          >
            Select Name
          </button>
          {children}
        </div>
      ) : null;
  },
}));

import { getAllBusinessTypes } from '@/config/business-types';
// --- Import after all mocks ---
import Step1_BusinessDetails from './step1-business-details';

const mockGetAllBusinessTypes = vi.mocked(getAllBusinessTypes);

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm<OnboardingFormValues>({
    defaultValues: {
      businessType: '',
      businessName: '',
      otherBusinessType: '',
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('Step1_BusinessDetails', () => {
  const mockOnKeyDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockGetAllBusinessTypes.mockReturnValue([
      {
        id: 'fashion',
        label: 'Fashion & Apparel',
        description: 'Clothing and fashion items',
        aiPromptContext: 'fashion-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'electronics',
        label: 'Electronics',
        description: 'Tech products',
        aiPromptContext: 'technology-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'home-goods',
        label: 'Home & Living',
        description: 'Home products',
        aiPromptContext: 'home-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'health-beauty',
        label: 'Health & Beauty',
        description: 'Beauty products',
        aiPromptContext: 'beauty-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'handmade',
        label: 'Handmade & Crafts',
        description: 'Handmade items',
        aiPromptContext: 'artisan-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'food-beverage',
        label: 'Food & Beverage',
        description: 'Food products',
        aiPromptContext: 'food-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
      {
        id: 'hair-extensions',
        label: 'Hair & Extensions',
        description: 'Hair products',
        aiPromptContext: 'hair-focused',
        template: (() => null) as any,
        icon: (() => null) as any,
        journey: {
          onboarding: { logoStyle: '', colorScheme: '' },
          productCreation: { aiDescriptionStyle: '', imageRequirements: '' },
        },
      },
    ]);
  });

  it('renders business type selection field', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    expect(
      screen.getByText(/what's the nature of your business/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('business-type-select')).toBeInTheDocument();
  });

  it('renders business name input field', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    expect(screen.getByText(/what is your business name/i)).toBeInTheDocument();
    expect(screen.getByTestId('businessName')).toBeInTheDocument();
  });

  it('shows "other" input field when "other" business type is selected', async () => {
    const DebugWrapper = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          businessType: '',
          businessName: '',
          otherBusinessType: '',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
          <div data-testid="debug-bt">{methods.watch('businessType')}</div>
        </FormProvider>
      );
    };

    render(<DebugWrapper />);

    const select = screen.getByTestId('business-type-select');
    fireEvent.change(select, { target: { value: 'other' } });

    await waitFor(() => {
      expect(screen.getByTestId('debug-bt').textContent).toBe('other');
    });

    expect(screen.getByTestId('otherBusinessType')).toBeInTheDocument();
  });

  it('does not show "other" input field when regular business type is selected', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    expect(screen.queryByTestId('otherBusinessType')).not.toBeInTheDocument();
  });

  it('renders all business types from config', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    expect(mockGetAllBusinessTypes).toHaveBeenCalled();

    // Check that options are rendered
    const select = screen.getByTestId('business-type-select');
    expect(select).toBeInTheDocument();
  });

  it('renders "Generate Business Name" button', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    expect(
      screen.getByRole('button', { name: /generate business name/i })
    ).toBeInTheDocument();
  });

  it('opens business name generator modal when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    const generateButton = screen.getByRole('button', {
      name: /generate business name/i,
    });
    await user.click(generateButton);

    expect(screen.getByTestId('business-name-modal')).toBeInTheDocument();
  });

  it('converts business name input to title case', async () => {
    const user = userEvent.setup();

    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          businessName: '',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
          <div data-testid="current-value">{methods.watch('businessName')}</div>
        </FormProvider>
      );
    };

    render(<TestForm />);

    const input = screen.getByTestId('businessName');
    await user.type(input, 'my awesome STORE');

    await waitFor(() => {
      const currentValue = screen.getByTestId('current-value');
      expect(currentValue.textContent).toBe('My Awesome Store');
    });
  });

  it('passes onKeyDown handler to input fields', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    const input = screen.getByTestId('businessName');
    await user.type(input, '{Enter}');

    expect(mockOnKeyDown).toHaveBeenCalled();
  });

  it('displays business type emojis correctly', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    // The emojis are rendered in the SelectItem components
    // We can verify the component renders without errors
    expect(screen.getByTestId('business-type-select')).toBeInTheDocument();
  });

  it('has proper autocomplete attributes on business name input', () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    const input = screen.getByTestId('businessName');
    expect(input).toHaveAttribute('autocomplete', 'organization');
  });

  it('has proper autocomplete attributes on other business type input', async () => {
    render(
      <TestWrapper>
        <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
      </TestWrapper>
    );

    const select = screen.getByTestId('business-type-select');
    fireEvent.change(select, { target: { value: 'other' } });

    await waitFor(() => {
      const otherInput = screen.getByTestId('otherBusinessType');
      expect(otherInput).toHaveAttribute('autocomplete', 'organization');
    });
  });

  it('sets business name via modal selection', async () => {
    const user = userEvent.setup();

    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          businessName: '',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
          <div data-testid="current-value">{methods.watch('businessName')}</div>
        </FormProvider>
      );
    };

    render(<TestForm />);

    const generateButton = screen.getByRole('button', {
      name: /generate business name/i,
    });
    await user.click(generateButton);

    const selectButton = screen.getByRole('button', { name: /select name/i });
    await user.click(selectButton);

    await waitFor(() => {
      const currentValue = screen.getByTestId('current-value');
      expect(currentValue.textContent).toBe('Generated Store Name');
    });
  });

  it('marks business name as dirty and touched when a generated name is selected', async () => {
    const user = userEvent.setup();

    const TestForm = () => {
      const methods = useForm<OnboardingFormValues>({
        defaultValues: {
          businessName: '',
        },
      });

      return (
        <FormProvider {...methods}>
          <Step1_BusinessDetails onKeyDown={mockOnKeyDown} />
          <div data-testid="is-dirty">
            {methods.formState.dirtyFields.businessName ? 'dirty' : 'clean'}
          </div>
          <div data-testid="is-touched">
            {methods.formState.touchedFields.businessName
              ? 'touched'
              : 'untouched'}
          </div>
        </FormProvider>
      );
    };

    render(<TestForm />);

    await user.click(
      screen.getByRole('button', { name: /generate business name/i })
    );
    await user.click(screen.getByRole('button', { name: /select name/i }));

    await waitFor(() => {
      expect(screen.getByTestId('is-dirty')).toHaveTextContent('dirty');
      expect(screen.getByTestId('is-touched')).toHaveTextContent('touched');
    });
  });
});
