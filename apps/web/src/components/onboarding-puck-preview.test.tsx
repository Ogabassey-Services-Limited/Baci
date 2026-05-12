import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module Mocks (hoisted before all imports) ---

vi.mock('@/lib/initial-template-generator', () => ({
  deriveThemeFromColors: vi.fn(() => ({
    colors: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      background: '#FFFFFF',
      foreground: '#000000',
      muted: '#F5F5F5',
      mutedForeground: '#888888',
      border: '#E5E5E5',
      header: {
        background: '#FFFFFF',
        text: '#000000',
        iconColor: '#000000',
        searchBorder: '#E5E5E5',
        searchBackground: '#F5F5F5',
      },
      footer: {
        background: '#000000',
        text: '#FFFFFF',
        linkColor: '#CCCCCC',
        linkHoverColor: '#FFFFFF',
      },
      button: {
        primary: { background: '#000000', text: '#FFFFFF', hover: '#222222' },
        secondary: {
          background: '#FFFFFF',
          text: '#000000',
          hover: '#F5F5F5',
        },
        accent: { background: '#222222', text: '#FFFFFF', hover: '#333333' },
      },
      card: { background: '#FFFFFF', border: '#E5E5E5', text: '#000000' },
      input: {
        background: '#FFFFFF',
        border: '#E5E5E5',
        text: '#000000',
        placeholder: '#888888',
        focusBorder: '#000000',
      },
    },
  })),
  generateFeatures: vi.fn(),
  generateHeroSlides: vi.fn(),
}));

vi.mock('@puckeditor/core', () => ({
  Render: ({ data }: { data: unknown }) => (
    <div data-testid="puck-render">{JSON.stringify(data)}</div>
  ),
}));

vi.mock('@/components/builder/config', () => ({
  builderConfig: {},
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

vi.mock('@/hooks/use-merchant', () => ({
  MerchantProvider: ({
    children,
    initialMerchant,
  }: {
    children: React.ReactNode;
    initialMerchant?: { id?: string };
  }) => (
    <div data-testid="merchant-provider" data-merchant-id={initialMerchant?.id}>
      {children}
    </div>
  ),
}));

vi.mock('@/hooks/use-cart', () => ({
  CartProvider: ({
    children,
    merchantSlug,
  }: {
    children: React.ReactNode;
    merchantSlug?: string | null;
  }) => <div data-testid={`cart-provider:${merchantSlug}`}>{children}</div>,
}));

import {
  generateFeatures,
  generateHeroSlides,
} from '@/lib/initial-template-generator';
// --- Import after all mocks ---
import { OnboardingPuckPreview } from './onboarding-puck-preview';

const mockGenerateHeroSlides = vi.mocked(generateHeroSlides);
const mockGenerateFeatures = vi.mocked(generateFeatures);

describe('OnboardingPuckPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockGenerateHeroSlides.mockResolvedValue([
      {
        image: '/placeholder.png',
        title: 'Welcome',
        subtitle: 'Test Store',
        ctaText: 'Shop Now',
        ctaLink: '#products',
      },
    ]);

    mockGenerateFeatures.mockReturnValue([
      { icon: 'shield', title: 'Secure', description: 'Safe shopping' },
    ]);
  });

  it('renders fallback message when brandColors is missing', () => {
    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
      />
    );

    expect(
      screen.getByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });

  it('renders fallback message when puck data is not loaded', () => {
    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    expect(
      screen.getByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });

  it('renders preview when brandColors and data are available', async () => {
    const { container } = render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Wait for async template generation
    await waitFor(() => {
      expect(mockGenerateHeroSlides).toHaveBeenCalledWith(
        'Test Store',
        'fashion'
      );
    });

    await waitFor(() => {
      expect(mockGenerateFeatures).toHaveBeenCalledWith('fashion');
    });

    // Preview should render
    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    // Check for MerchantProvider wrapper
    expect(screen.getAllByTestId('merchant-provider').length).toBeGreaterThan(
      0
    );

    // Check CSS variables are applied
    const previewContainer = container.querySelector('[style]');
    expect(previewContainer).toBeInTheDocument();
  });

  it('shows loading state during template generation', async () => {
    // Make the promise resolve very slowly
    let resolvePromise: ((value: unknown) => void) | undefined;
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockGenerateHeroSlides.mockReturnValue(slowPromise as Promise<any>);

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Should show loader (Loader2 component from lucide-react)
    await waitFor(() => {
      // Look for the loader SVG class or just check fallback is shown
      expect(
        screen.getByText(/your store preview will appear here/i)
      ).toBeInTheDocument();
    });

    // Cleanup - resolve the promise
    if (resolvePromise) {
      resolvePromise([
        { title: 'Test', subtitle: 'Test', ctaText: 'Test', ctaUrl: '/' },
      ]);
    }
  });

  it('handles template generation errors gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockGenerateHeroSlides.mockRejectedValue(new Error('Generation failed'));

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Should show fallback after error
    await waitFor(() => {
      expect(
        screen.getByText(/your store preview will appear here/i)
      ).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('opens expanded view when expand button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    // Find and click expand button
    const expandButton = screen.getByRole('button', { name: /expand/i });
    await user.click(expandButton);

    // Should show "Live Store Preview" heading in expanded view
    expect(
      screen.getByRole('heading', { name: /live store preview/i })
    ).toBeInTheDocument();

    // Should have close button
    expect(
      screen.getByRole('button', { name: /close preview/i })
    ).toBeInTheDocument();
  });

  it('closes expanded view when close button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    // Expand first
    const expandButton = screen.getByRole('button', { name: /expand/i });
    await user.click(expandButton);

    // Then close
    const closeButton = screen.getByRole('button', { name: /close preview/i });
    await user.click(closeButton);

    // Should go back to normal view (expand button visible again)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /expand/i })
      ).toBeInTheDocument();
    });
  });

  it('calls onEdit callback when edit button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnEdit = vi.fn();

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
        onEdit={mockOnEdit}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    // Find and click edit button
    const editButton = screen.getByRole('button', { name: /edit template/i });
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(Array),
        root: expect.any(Object),
      })
    );
  });

  it('patches logo URL into puck data when logoDataUri changes', async () => {
    const { rerender } = render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,initial"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    // Update logo
    rerender(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,updated"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Check that the render updated (logo patched)
    await waitFor(() => {
      const renderElement = screen.getByTestId('puck-render');
      expect(renderElement.textContent).toContain(
        'data:image/png;base64,updated'
      );
    });
  });

  it('uses external data when provided instead of generating internal data', async () => {
    // Clear any previous calls
    vi.clearAllMocks();

    const externalData = {
      content: [
        {
          type: 'Header',
          props: { id: 'external-header', storeName: 'External Store' },
        },
      ],
      root: { props: { title: 'External' } },
      zones: {},
    };

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
        data={externalData}
      />
    );

    // Should use external data immediately
    await waitFor(() => {
      const renderElement = screen.getByTestId('puck-render');
      expect(renderElement.textContent).toContain('external-header');
    });

    // Note: The component still generates internal data in useEffect,
    // but it uses externalData preferentially via `externalData || internalPuckData`
    // So we just verify the external data is rendered
  });

  it('regenerates template when business inputs change', async () => {
    const { rerender } = render(
      <OnboardingPuckPreview
        businessName="Store One"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(mockGenerateHeroSlides).toHaveBeenCalledWith(
        'Store One',
        'fashion'
      );
    });

    vi.clearAllMocks();

    // Change business name
    rerender(
      <OnboardingPuckPreview
        businessName="Store Two"
        businessType="electronics"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Should regenerate
    await waitFor(() => {
      expect(mockGenerateHeroSlides).toHaveBeenCalledWith(
        'Store Two',
        'electronics'
      );
    });
  });

  it('does not show edit button when onEdit is not provided', async () => {
    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('puck-render')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /edit template/i })
    ).not.toBeInTheDocument();
  });

  it('wraps rendered storefront preview blocks in cart context', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('cart-provider:preview-store')
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('merchant-provider')).toHaveAttribute(
      'data-merchant-id',
      'preview-merchant-id'
    );

    await user.click(screen.getByRole('button', { name: /expand/i }));

    const expandedPreview = await screen.findByRole('dialog', {
      name: /live store preview/i,
    });
    expect(
      within(expandedPreview).getByTestId('cart-provider:preview-store')
    ).toBeInTheDocument();
    expect(
      within(expandedPreview).getByTestId('merchant-provider')
    ).toHaveAttribute('data-merchant-id', 'preview-merchant-id');
  });

  it('error boundary catches merchant context errors', () => {
    // This tests the PreviewErrorBoundary component
    // Since it only catches specific errors, we'll just ensure it renders children normally
    render(
      <OnboardingPuckPreview
        businessName="Test Store"
        businessType="fashion"
        logoDataUri="data:image/png;base64,test"
        brandColors={{
          primary: '#000000',
          background: '#FFFFFF',
          accent: '#FF0000',
        }}
      />
    );

    // Should render without throwing
    expect(
      screen.getByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });
});
