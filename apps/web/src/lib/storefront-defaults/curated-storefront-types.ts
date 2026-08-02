import type { Data } from '@puckeditor/core';
import type { ThemeConfiguration } from '@/lib/theme-config';
import type { BrandColors } from '@/types';

export interface GenerateInitialTemplateParams {
  businessName: string;
  businessType: string;
  brandColors: BrandColors;
  merchant: Record<string, unknown>;
}

export interface CuratedStorefrontInput {
  businessName: string;
  businessType: string;
  country: string;
  brandColors: BrandColors;
  logoUrl?: string;
}

export interface CuratedStorefrontData extends Data {
  theme: ThemeConfiguration;
}
