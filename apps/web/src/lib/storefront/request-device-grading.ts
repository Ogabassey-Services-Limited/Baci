import { fetchWithCsrf } from '@/lib/api-client';

export interface DeviceGradingResult {
  model: string;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  observations: string[];
  basePrice: number;
  estimatedValue: number;
  deductionPercent: number;
  matchedProduct: string;
}

export async function requestDeviceGrading(
  videoFile: File
): Promise<DeviceGradingResult> {
  const formData = new FormData();
  formData.append('video', videoFile);

  const res = await fetchWithCsrf('/api/ai/grade-device', {
    method: 'POST',
    body: formData,
  });

  const data = (await res.json()) as {
    error?: string;
    data: DeviceGradingResult;
  };

  if (!res.ok) throw new Error(data.error || 'Failed to analyze');

  return data.data;
}
