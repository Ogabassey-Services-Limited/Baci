import { NextResponse } from 'next/server';

const SICKW_API_URL = 'https://sickw.com/api.php';
const SICKW_REQUEST_TIMEOUT_MS = 15_000;

type SickwCheckResponse =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; response: NextResponse };

async function requestCheck({
  apiKey,
  imei,
  serviceId,
}: {
  apiKey: string;
  imei: string;
  serviceId: string;
}): Promise<SickwCheckResponse> {
  const params = new URLSearchParams({
    format: 'json',
    key: apiKey,
    imei,
    service: serviceId,
  });
  let response: Response;
  try {
    response = await fetch(`${SICKW_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Baci-IMEI-Checker/1.0' },
      signal: AbortSignal.timeout(SICKW_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError');
    console.error(
      '[IMEI Check] SICKW request failed:',
      isAbort ? 'timeout' : err
    );
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'IMEI check service unavailable' },
        { status: 503 }
      ),
    };
  }

  if (!response.ok) {
    console.error(
      '[IMEI Check] SICKW API error:',
      response.status,
      response.statusText
    );
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'IMEI check service unavailable' },
        { status: 503 }
      ),
    };
  }

  const rawText = await response.text();
  const payload = parseProviderPayload(rawText);
  const providerError = getProviderError(payload);
  if (providerError) {
    return {
      ok: false,
      response: providerErrorToResponse(providerError),
    };
  }

  return { ok: true, payload };
}

function getApiKey(): string | undefined {
  const apiKey = process.env.SICKW_API_KEY?.trim();
  return apiKey || undefined;
}

function parseProviderPayload(rawText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    console.warn('[IMEI Check] Response is not JSON, treating as text');
  }

  return { result: rawText };
}

function normalizeResult(result: unknown): string | Record<string, unknown> {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    return result as Record<string, unknown>;
  }

  return '';
}

function getProviderError(payload: Record<string, unknown>): string | null {
  const result = payload.result;
  const isErrorObject = payload.status === 'error' || Boolean(payload.error);
  const isErrorString =
    typeof result === 'string' && result.toLowerCase().startsWith('error');

  if (!isErrorObject && !isErrorString) {
    return null;
  }

  const errorValue = payload.message ?? payload.error ?? result;
  return typeof errorValue === 'string' ? errorValue : 'Check failed';
}

function providerErrorToResponse(errorMessage: string): NextResponse {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('balance')) {
    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }

  if (normalized.includes('invalid')) {
    return NextResponse.json(
      { success: false, error: 'Invalid IMEI number' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: `Unable to verify: ${errorMessage.replace(/^error:\s*/i, '')}`,
    },
    { status: 400 }
  );
}

export const sickwClient = {
  getApiKey,
  normalizeResult,
  requestCheck,
};
