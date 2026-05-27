import {
  getAiStorefrontWorkerTriggerSecret,
  getAiStorefrontWorkerTriggerTimeoutMs,
  getAiStorefrontWorkerTriggerUrl,
} from '@/env';

export type AiStorefrontWorkerTriggerSource = 'api' | 'onboarding';

const MAX_ERROR_BODY_PREVIEW_CHARS = 500;

interface TriggerAiStorefrontWorkerArgs {
  fetchFn?: typeof fetch;
  jobId?: string;
  merchantId: string;
  source: AiStorefrontWorkerTriggerSource;
}

type TriggerAiStorefrontWorkerResult =
  | { reason: 'not_configured'; triggered: false }
  | { status: number; triggered: true };

async function readResponsePreview(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return text.length > MAX_ERROR_BODY_PREVIEW_CHARS
      ? `${text.slice(0, MAX_ERROR_BODY_PREVIEW_CHARS)}...`
      : text;
  } catch {
    return null;
  }
}

export async function triggerAiStorefrontWorker({
  fetchFn = fetch,
  jobId,
  merchantId,
  source,
}: TriggerAiStorefrontWorkerArgs): Promise<TriggerAiStorefrontWorkerResult> {
  const triggerUrl = getAiStorefrontWorkerTriggerUrl();
  const triggerSecret = getAiStorefrontWorkerTriggerSecret();
  if (!triggerUrl || !triggerSecret) {
    return { triggered: false, reason: 'not_configured' };
  }

  const response = await fetchFn(triggerUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${triggerSecret}`,
      'content-type': 'application/json',
      'user-agent': 'baci-web-ai-storefront-trigger/1.0',
    },
    body: JSON.stringify({ jobId, merchantId, source }),
    signal: AbortSignal.timeout(getAiStorefrontWorkerTriggerTimeoutMs()),
  });

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    const bodyPreview = await readResponsePreview(response);
    const bodyText = bodyPreview ? `: ${bodyPreview}` : '';
    throw new Error(
      `AI storefront worker trigger failed with HTTP ${response.status}${statusText}${bodyText}`
    );
  }

  return { triggered: true, status: response.status };
}
