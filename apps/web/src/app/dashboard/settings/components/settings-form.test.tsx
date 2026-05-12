import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { SettingsForm } from './settings-form';

// Mock child components to avoid deep rendering
vi.mock('./branding-card', () => ({
  BrandingCard: () => <div data-testid="branding-card" />,
}));

vi.mock('./hero-carousel-card', () => ({
  HeroCarouselCard: () => <div data-testid="hero-carousel-card" />,
}));

vi.mock('./social-media-card', () => ({
  SocialMediaCard: ({
    onSocialMediaChange,
  }: {
    onSocialMediaChange: (sm: Record<string, string>) => void;
  }) => {
    // Simulate social media change on render
    onSocialMediaChange({ twitter: '@test' });
    return <div data-testid="social-media-card" />;
  },
}));

vi.mock('./store-features-card', () => ({
  StoreFeaturesCard: () => <div data-testid="store-features-card" />,
}));

vi.mock('@/app/dashboard/settings/favicon-upload', () => ({
  FaviconUpload: () => <div data-testid="favicon-upload" />,
}));

vi.mock('@/components/dashboard/dashboard-ad-unit', () => ({
  DashboardAdUnit: () => <div data-testid="ad-unit" />,
}));

vi.mock('colord/plugins/a11y', () => ({
  default: () => {
    // Mock a11y plugin
  },
}));
vi.mock('colord', () => ({ extend: vi.fn() }));

vi.mock('./settings-utils', () => {
  // Fully mock to avoid transitive sharp/native dependency in CI
  const z = require('zod');
  return {
    settingsSchema: z.object({
      business_name: z.string().min(2),
      country: z.string().min(2),
    }),
    extractColorsFromImage: vi.fn(),
    sanitizeSocialMedia: (sm: Record<string, string>) => sm,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock useMerchant
const mockUpdateMerchant = vi.fn();
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ updateMerchant: mockUpdateMerchant }),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockMerchant: CachedMerchant = {
  id: 'merchant-1',
  business_name: 'Test Store',
  site_title: 'Test',
  site_tagline: '',
  site_description: '',
  business_type: 'FASHION',
  logo_url: '',
  phone: '',
  email: '',
  slug: 'test-store',
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'free',
  premium_features: null,
  brand_colors: { primary: '#000', background: '#FFF', accent: '#F00' },
  country: 'NG',
  hero_slides: [],
  mobile_hero_slides: [],
  social_media: {
    twitter: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    pinterest: '',
    linkedin: '',
    snapchat: '',
  },
};

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all child components', () => {
    // Arrange & Act
    render(
      <SettingsForm initialMerchant={mockMerchant} initialBlogEnabled={false} />
    );

    // Assert
    expect(screen.getByTestId('branding-card')).toBeInTheDocument();
    expect(screen.getByTestId('store-features-card')).toBeInTheDocument();
    expect(screen.getByTestId('favicon-upload')).toBeInTheDocument();
    expect(screen.getByTestId('ad-unit')).toBeInTheDocument();
    expect(screen.getByTestId('hero-carousel-card')).toBeInTheDocument();
    expect(screen.getByTestId('social-media-card')).toBeInTheDocument();
  });

  it('renders Save Changes button', () => {
    // Arrange & Act
    render(
      <SettingsForm initialMerchant={mockMerchant} initialBlogEnabled={false} />
    );

    // Assert
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it('submit calls updateMerchant on valid data', async () => {
    // Arrange
    mockUpdateMerchant.mockResolvedValueOnce(undefined);
    render(
      <SettingsForm initialMerchant={mockMerchant} initialBlogEnabled={false} />
    );
    const form = screen
      .getByRole('button', { name: /save changes/i })
      .closest('form');

    if (!form) throw new Error('Form not found');

    // Act
    fireEvent.submit(form);

    // Assert
    await waitFor(() => {
      expect(mockUpdateMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          business_name: 'Test Store',
          country: 'NG',
          hero_slides: [],
          social_media: { twitter: '@test' },
        })
      );
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Settings Saved!',
      description: 'Your store settings have been updated.',
    });
  });

  it('shows error toast when updateMerchant rejects', async () => {
    // Arrange
    const error = new Error('Update failed');
    mockUpdateMerchant.mockRejectedValueOnce(error);
    render(
      <SettingsForm initialMerchant={mockMerchant} initialBlogEnabled={false} />
    );
    const form = screen
      .getByRole('button', { name: /save changes/i })
      .closest('form');

    if (!form) throw new Error('Form not found');

    // Act
    fireEvent.submit(form);

    // Assert
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error Saving Settings',
        description: 'Update failed',
        variant: 'destructive',
      });
    });
  });

  it('save button shows loading state during submission', async () => {
    // Arrange
    mockUpdateMerchant.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(
      <SettingsForm initialMerchant={mockMerchant} initialBlogEnabled={false} />
    );
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    const form = saveButton.closest('form');

    if (!form) throw new Error('Form not found');

    // Act
    fireEvent.submit(form);

    // Assert - button disabled during submission
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });

    // Assert - button enabled after submission
    await waitFor(
      () => {
        expect(saveButton).not.toBeDisabled();
      },
      { timeout: 200 }
    );
  });
});
