import {
  getImportJobWorkerTriggerSecret,
  getImportJobWorkerTriggerTimeoutMs,
  getImportJobWorkerTriggerUrl,
} from '@/env';

const MAX_ERROR_BODY_PREVIEW_CHARS = 500;

interface TriggerImportJobWorkerArgs {
  fetchFn?: typeof fetch;
  jobId: string;
  source: 'api';
}

type TriggerImportJobWorkerResult =
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

export async function triggerImportJobWorker({
  fetchFn = fetch,
  jobId,
  source,
}: TriggerImportJobWorkerArgs): Promise<TriggerImportJobWorkerResult> {
  const triggerUrl = getImportJobWorkerTriggerUrl();
  const triggerSecret = getImportJobWorkerTriggerSecret();
  if (!triggerUrl || !triggerSecret) {
    return { triggered: false, reason: 'not_configured' };
  }

  const response = await fetchFn(triggerUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${triggerSecret}`,
      'content-type': 'application/json',
      'user-agent': 'baci-web-import-job-trigger/1.0',
    },
    body: JSON.stringify({ jobId, source }),
    signal: AbortSignal.timeout(getImportJobWorkerTriggerTimeoutMs()),
  });

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    const bodyPreview = await readResponsePreview(response);
    const bodyText = bodyPreview ? `: ${bodyPreview}` : '';
    throw new Error(
      `Import job worker trigger failed with HTTP ${response.status}${statusText}${bodyText}`
    );
  }

  return { triggered: true, status: response.status };
}
