import { Suspense } from 'react';
import { StaffAcceptFallback } from '@/app/(platform)/staff/accept/staff-accept-fallback';
import { StaffAcceptPageContent } from '@/app/(platform)/staff/accept/staff-accept-page-content';

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
