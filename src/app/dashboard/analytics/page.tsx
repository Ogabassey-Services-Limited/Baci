'use client';

import { useState, useEffect } from 'react';
import { DraggableAnalyticsGrid } from '@/components/analytics/draggable-analytics-grid';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { AIInsightsPanel } from '@/components/analytics/ai-insights-panel';

export default function AnalyticsPage() {
  const [timeFrame, setTimeFrame] = useState<'weekly' | 'monthly'>('weekly');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?timeFrame=${timeFrame}`);
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        } else {
          console.error('Failed to fetch analytics:', response.status);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeFrame]);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <AnalyticsFilters
          timeFrame={timeFrame}
          onTimeFrameChange={setTimeFrame}
        />
      </div>

      <DraggableAnalyticsGrid data={analytics} loading={loading} />

      <AIInsightsPanel />
    </div>
  );
}
