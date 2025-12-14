import type { Metadata } from 'next';
import PagesClient from './pages-client';

export const metadata: Metadata = {
  title: 'Pages | Baci',
  description: "Manage your store's informational pages",
};

export default function PagesPage() {
  return <PagesClient />;
}
