import type { Metadata } from 'next';
import { BuilderPreviewCanvas } from './builder-preview-canvas';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function BuilderPreviewPage() {
  return <BuilderPreviewCanvas />;
}
