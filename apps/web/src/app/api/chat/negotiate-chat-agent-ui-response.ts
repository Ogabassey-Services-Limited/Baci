import {
  type StorefrontAgentUiEvent,
  storefrontAgentUiContract,
} from '@/schemas/storefront-agent-ui-contract';

function acceptsAgentUi(request: Request): boolean {
  const accept = request.headers.get('accept');
  if (!accept) return false;

  return accept.split(',').some((value) => {
    const [mediaType, ...parameters] = value.trim().split(';');
    if (
      mediaType?.trim().toLowerCase() !==
      storefrontAgentUiContract.mediaType.toLowerCase()
    ) {
      return false;
    }

    const qualityParameter = parameters.find(
      (parameter) => parameter.split('=', 1)[0]?.trim().toLowerCase() === 'q'
    );
    if (!qualityParameter) return true;

    const quality = Number(qualityParameter.split('=', 2)[1]?.trim());
    return Number.isFinite(quality) && quality > 0 && quality <= 1;
  });
}

/**
 * Preserves the legacy text response unless the widget explicitly opts into
 * the versioned agent-UI transport.
 */
export async function negotiateChatAgentUiResponse(
  request: Request,
  response: Response,
  events: StorefrontAgentUiEvent[] = []
): Promise<Response> {
  if (!acceptsAgentUi(request)) return response;

  const text = await response.text();
  const payload = storefrontAgentUiContract.responseSchema.parse({
    events,
    text,
    version: 1,
  });
  const headers = new Headers(response.headers);
  headers.set(
    'Content-Type',
    `${storefrontAgentUiContract.mediaType}; charset=utf-8`
  );
  headers.set('Cache-Control', 'no-store');
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');

  return new Response(JSON.stringify(payload), {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
