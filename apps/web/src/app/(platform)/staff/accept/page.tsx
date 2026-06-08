import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StaffAcceptFallback } from '@/app/(platform)/staff/accept/staff-accept-fallback';
import { StaffAcceptPageContent } from '@/app/(platform)/staff/accept/staff-accept-page-content';

export const metadata: Metadata = {
  title: 'Accept Staff Invitation',
  description: 'Accept your secure Baci staff invitation.',
  robots: { index: false, follow: false },
};

interface AcceptPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default function StaffAcceptPage(props: AcceptPageProps) {
  return (
    <Suspense fallback={<StaffAcceptFallback />}>
      <StaffAcceptPageContent {...props} />
    </Suspense>
  );
}
