import type { Metadata } from 'next';
import AgenticDashboardClientPage from './client-page';
import { loadAgenticCentersData } from './data';

export const metadata: Metadata = {
  title: 'Agentic Commerce | Baci Dashboard',
};

export default async function AgenticDashboardPage() {
  const data = await loadAgenticCentersData();

  return <AgenticDashboardClientPage {...data} />;
}
