import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { getStaffMembers } from './actions';
import { TeamClient } from './team-client';

export default async function TeamSettingsPage() {
  const staff = await getStaffMembers();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <BagLoader size={32} />
        </div>
      }
    >
      <TeamClient initialStaff={staff} />
    </Suspense>
  );
}
