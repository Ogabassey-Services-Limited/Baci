import type { Data } from '@puckeditor/core';
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

export type PuckBlock = Data['content'][number];

export interface AiContent {
  hero: Array<{ title: string; subtitle: string }>;
  features: Array<{ title: string; description: string; icon: string }>;
}
