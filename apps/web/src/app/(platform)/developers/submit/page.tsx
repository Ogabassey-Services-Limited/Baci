import type { Metadata } from 'next';
import SubmitTemplateClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Submit a Storefront Template - Baci Developers',
  description:
    'Submit a storefront template for review and help African merchants launch better Baci commerce experiences.',
};

export default function SubmitTemplatePage() {
  return <SubmitTemplateClientPage />;
}
