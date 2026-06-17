interface WebVitalMetricLike {
  name: string;
  value: number;
  id: string;
  rating: string;
  navigationType: string;
}

interface WebVitalEndpointPayload {
  name: string;
  value: number;
  rating: string;
  id: string;
  navigationType: string;
  timestamp: number;
}

export function buildWebVitalEndpointPayload(
  metric: WebVitalMetricLike
): WebVitalEndpointPayload {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  };
}
