'use client';

import type { Data } from '@puckeditor/core';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OnboardingPreviewCanvas } from '@/components/onboarding-preview/onboarding-preview-canvas';
import { OnboardingPreviewControls } from '@/components/onboarding-preview/onboarding-preview-controls';
import { generatePreviewTemplate } from '@/components/onboarding-preview/onboarding-preview-data';
import { OnboardingPreviewExpandedDialog } from '@/components/onboarding-preview/onboarding-preview-expanded-dialog';
import { Dialog } from '@/components/ui/dialog';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import type { BrandColors } from '@/types';

interface OnboardingPuckPreviewProps {
  businessName: string;
  businessType: string;
  logoDataUri?: string;
  brandColors?: BrandColors;
  onEdit?: (data: Data) => void;
  data?: Data | null;
}

function getThemeStyles(
  brandColors: BrandColors,
  businessType: string
): React.CSSProperties {
  const theme = deriveCuratedTheme(brandColors, businessType);
  return {
    '--theme-primary': theme.colors.primary,
    '--theme-secondary': theme.colors.secondary,
    '--theme-accent': theme.colors.accent,
    '--theme-background': theme.colors.background,
    '--theme-foreground': theme.colors.foreground,
    '--theme-muted': theme.colors.muted,
    '--theme-muted-foreground': theme.colors.mutedForeground,
    '--theme-border': theme.colors.border,
    '--theme-header-bg': theme.colors.header.background,
    '--theme-header-text': theme.colors.header.text,
    '--theme-header-icon': theme.colors.header.iconColor,
    '--theme-header-search-border': theme.colors.header.searchBorder,
    '--theme-header-search-bg': theme.colors.header.searchBackground,
    '--theme-footer-bg': theme.colors.footer.background,
    '--theme-footer-text': theme.colors.footer.text,
    '--theme-footer-link': theme.colors.footer.linkColor,
    '--theme-footer-link-hover': theme.colors.footer.linkHoverColor,
    '--theme-button-primary-bg': theme.colors.button.primary.background,
    '--theme-button-primary-text': theme.colors.button.primary.text,
    '--theme-button-primary-hover': theme.colors.button.primary.hover,
    '--theme-button-secondary-bg': theme.colors.button.secondary.background,
    '--theme-button-secondary-text': theme.colors.button.secondary.text,
    '--theme-button-secondary-hover': theme.colors.button.secondary.hover,
    '--theme-button-accent-bg': theme.colors.button.accent.background,
    '--theme-button-accent-text': theme.colors.button.accent.text,
    '--theme-button-accent-hover': theme.colors.button.accent.hover,
    '--theme-card-bg': theme.colors.card.background,
    '--theme-card-border': theme.colors.card.border,
    '--theme-card-text': theme.colors.card.text,
    '--theme-input-bg': theme.colors.input.background,
    '--theme-input-border': theme.colors.input.border,
    '--theme-input-text': theme.colors.input.text,
    '--theme-input-placeholder': theme.colors.input.placeholder,
    '--theme-input-focus-border': theme.colors.input.focusBorder,
    '--store-primary': brandColors.primary,
    '--store-accent': brandColors.accent,
    '--store-background': brandColors.background,
    '--store-primary-text': theme.colors.button.primary.text,
    '--store-accent-text': theme.colors.button.accent.text,
    '--store-background-text': theme.colors.button.secondary.text,
  } as React.CSSProperties;
}

function patchLogo(data: Data, logoDataUri?: string): Data {
  if (!logoDataUri) return data;
  const patched = JSON.parse(JSON.stringify(data)) as Data;
  const header = patched.content.find((block) => block.type === 'Header');
  if (header?.props) header.props.logoUrl = logoDataUri;
  return patched;
}

export function OnboardingPuckPreview({
  businessName,
  businessType,
  logoDataUri,
  brandColors,
  onEdit,
  data: externalData,
}: OnboardingPuckPreviewProps) {
  const [internalPuckData, setInternalPuckData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(() => !externalData);
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    if (externalData) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    generatePreviewTemplate({
      businessName: businessName || 'Your Store',
      businessType: businessType || 'other',
      logoDataUri: logoDataUri ?? null,
    })
      .then((data) => {
        if (mounted) setInternalPuckData(data);
      })
      .catch((error: unknown) => {
        console.error('Failed to generate preview template:', error);
        if (mounted) setInternalPuckData(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [businessName, businessType, externalData, logoDataUri]);
  const puckData = externalData || internalPuckData;
  const patchedData = puckData ? patchLogo(puckData, logoDataUri) : null;
  if (isLoading && !puckData)
    return (
      <div
        className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground bg-muted/20"
        role="status"
        aria-label="Loading store preview"
        aria-live="polite"
      >
        <Loader2
          className="size-8 animate-spin text-primary"
          aria-hidden="true"
        />
      </div>
    );
  if (!brandColors || !puckData || !patchedData)
    return (
      <div className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground bg-muted/20">
        Your store preview will appear here once your logo is uploaded.
      </div>
    );
  const themeStyles = getThemeStyles(brandColors, businessType);
  const resetKey = JSON.stringify({
    businessName,
    businessType,
    logoDataUri,
    brandColors,
    content: patchedData.content.map(
      (block) => `${block.type}:${String(block.props?.id ?? '')}`
    ),
  });
  const canvas = (
    <OnboardingPreviewCanvas
      businessName={businessName}
      businessType={businessType}
      brandColors={brandColors}
      data={patchedData}
      resetKey={resetKey}
    />
  );
  return (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="relative w-full h-full rounded-xl border border-white/10 bg-muted/20 overflow-hidden flex flex-col group">
        {isLoading && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center bg-background/50 backdrop-blur-xs transition-opacity duration-200"
            role="status"
            aria-label="Loading store preview"
            aria-live="polite"
          >
            <Loader2
              className="size-8 animate-spin text-primary"
              aria-hidden="true"
            />
          </div>
        )}
        <OnboardingPreviewControls
          brandColors={brandColors}
          data={patchedData}
          onEdit={onEdit}
        />
        <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4">
          <div
            className="origin-top-left scale-[0.65] sm:scale-[0.75] md:scale-[0.8] lg:scale-[0.85] w-[153.9%] sm:w-[133.4%] md:w-[125%] lg:w-[117.7%] min-h-[153.9%] sm:min-h-[133.4%] md:min-h-[125%] lg:min-h-[117.7%] rounded-md bg-background shadow-lg"
            style={{
              backgroundColor: 'var(--theme-background)',
              ...themeStyles,
            }}
          >
            {canvas}
          </div>
        </div>
      </div>
      <OnboardingPreviewExpandedDialog>
        {canvas}
      </OnboardingPreviewExpandedDialog>
    </Dialog>
  );
}
