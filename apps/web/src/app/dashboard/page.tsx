import { Suspense } from 'react';
import { DashboardData } from './dashboard-data';
import DashboardLoading from './loading';

export const metadata = {
  title: 'Dashboard - Baci',
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardData />
    </Suspense>
  );
}
