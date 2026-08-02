import type { Layout } from 'react-grid-layout/legacy';
import { fetchWithCsrf } from '@/lib/api-client';

export async function saveDashboardLayoutPreference(
  layout: Layout
): Promise<void> {
  const response = await fetchWithCsrf('/api/dashboard/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout_config: layout }),
  });

  if (!response.ok) {
    throw new Error('Failed to save dashboard layout preference');
  }
}
