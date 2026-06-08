import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Template Preview',
  description: 'Preview Baci storefront templates from the dashboard.',
};

export default function TemplatePreviewIndex() {
  redirect('/dashboard/templates');
}
