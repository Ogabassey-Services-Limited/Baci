import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { ensurePermission } from '@/lib/merchant-server';
import { getStaffMembers } from './actions';
import { TeamClient } from './team-client';

async function TeamContent() {
  await ensurePermission('staff', 'view');
  const staff = await getStaffMembers();
  return <TeamClient initialStaff={staff} />;
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <BagLoader size={32} />
        </div>
      }
    >
      <TeamContent />
    </Suspense>
  );
}
