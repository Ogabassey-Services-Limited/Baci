'use client';

import type { Data } from '@puckeditor/core';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OnboardingPreviewCanvas } from '@/components/onboarding-preview/onboarding-preview-canvas';
import { OnboardingPreviewControls } from '@/components/onboarding-preview/onboarding-preview-controls';
import { generatePreviewTemplate } from '@/components/onboarding-preview/onboarding-preview-data';
import { OnboardingPreviewExpandedDialog } from '@/components/onboarding-preview/onboarding-preview-expanded-dialog';
import { getOnboardingPreviewThemeStyles } from '@/components/onboarding-preview/onboarding-preview-theme-styles';
import { Dialog } from '@/components/ui/dialog';
import type { BrandColors } from '@/types';

interface OnboardingPuckPreviewProps {
  businessName: string;
  businessType: string;
  logoDataUri?: string;
  brandColors?: BrandColors;
  onEdit?: (data: Data) => void;
  data?: Data | null;
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
  const themeStyles = getOnboardingPreviewThemeStyles(
    brandColors,
    businessType
  );
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
          {!isExpanded && (
            <div
              data-testid="preview-inline-surface"
              className="origin-top-left scale-[0.65] sm:scale-[0.75] md:scale-[0.8] lg:scale-[0.85] w-[153.9%] sm:w-[133.4%] md:w-[125%] lg:w-[117.7%] min-h-[153.9%] sm:min-h-[133.4%] md:min-h-[125%] lg:min-h-[117.7%] rounded-md bg-background shadow-lg"
              style={themeStyles}
            >
              {canvas}
            </div>
          )}
        </div>
      </div>
      <OnboardingPreviewExpandedDialog themeStyles={themeStyles}>
        {isExpanded ? canvas : null}
      </OnboardingPreviewExpandedDialog>
    </Dialog>
  );
}
