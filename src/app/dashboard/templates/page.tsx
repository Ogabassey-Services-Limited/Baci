import type { Metadata } from 'next';
import TemplatesClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Template Gallery | Baci',
  description: 'Browse and preview all available storefront templates',
};

export default function TemplatesPage() {
  return <TemplatesClientPage />;
}
