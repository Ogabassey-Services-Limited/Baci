import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

// Intentional page-level metadata for this redirect-only legacy route: keep it noindex so crawlers do not treat the transitional URL as canonical.
export const metadata: Metadata = {
  title: 'Template Preview',
  description: 'Preview Baci storefront templates from the dashboard.',
  robots: { index: false, follow: true },
};

export default function TemplatePreviewIndex() {
  redirect('/dashboard/templates');
}
