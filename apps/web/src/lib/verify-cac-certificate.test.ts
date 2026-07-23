import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextProvider } from '@/ai/text-provider-chain';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

const mocks = vi.hoisted(() => ({
  getVisionProviderChain: vi.fn(),
  getOllamaBaseUrl: vi.fn(),
  getOllamaBasicAuth: vi.fn(),
  getOllamaCacModel: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: vi.fn() }));

vi.mock('@/ai/vision-provider-chain', () => ({
  getVisionProviderChain: mocks.getVisionProviderChain,
}));

vi.mock('@/env', () => ({
  getOllamaBaseUrl: mocks.getOllamaBaseUrl,
  getOllamaBasicAuth: mocks.getOllamaBasicAuth,
  getOllamaCacModel: mocks.getOllamaCacModel,
}));

import {
  compareCACData,
  extractCACCertificateData,
} from '@/lib/verify-cac-certificate';

function provider(name: string): TextProvider {
  return { name, model: { id: name } as unknown as TextProvider['model'] };
}

const CEREBRAS_PROVIDER = provider('cerebras:gemma-4-31b');
const GOOGLE_FLASH_PROVIDER = provider('google:gemini-2.5-flash');
const GOOGLE_FLASH_LITE_PROVIDER = provider('google:gemini-2.5-flash-lite');
const VISION_CHAIN = [
  CEREBRAS_PROVIDER,
  GOOGLE_FLASH_PROVIDER,
  GOOGLE_FLASH_LITE_PROVIDER,
];

const completeJson = JSON.stringify({
  documentType: 'Certificate of Incorporation',
  rcNumber: 'RC123456',
  businessName: 'BACI TECHNOLOGIES LTD',
});

const incompleteJson = JSON.stringify({
  documentType: 'Certificate of Incorporation',
  rcNumber: null,
  businessName: null,
});

type Behavior = string | Error;

/** Routes the mocked `generateText` response by the calling provider's model id. */
function respondByModelId(map: Record<string, Behavior>) {
  vi.mocked(generateText).mockImplementation(((opts: {
    model: { id: string };
  }) => {
    const behavior = map[opts.model.id];
    if (behavior === undefined) {
      return Promise.reject(
        new Error(`unexpected model invoked: ${opts.model.id}`)
      );
    }
    if (behavior instanceof Error) {
      return Promise.reject(behavior);
    }
    return Promise.resolve({ text: behavior } as Awaited<
      ReturnType<typeof generateText>
    >);
  }) as unknown as typeof generateText);
}

function getExpectedAuthorizationHeader(basicAuth: string): string {
  const authorization = buildOllamaBasicAuthHeader(basicAuth);
  if (!authorization) {
    throw new Error('Expected test Basic Auth value to produce a header');
  }
  return authorization;
}

describe('extractCACCertificateData', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    mocks.getVisionProviderChain.mockReset().mockReturnValue(VISION_CHAIN);
    mocks.getOllamaBaseUrl.mockReset().mockReturnValue(undefined);
    mocks.getOllamaBasicAuth.mockReset().mockReturnValue(undefined);
    mocks.getOllamaCacModel.mockReset().mockReturnValue('gemma4:e4b');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the first vision-chain provider result when it is complete', async () => {
    respondByModelId({ 'cerebras:gemma-4-31b': completeJson });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(generateText).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: CEREBRAS_PROVIDER.model })
    );
    expect(result).toEqual({
      documentType: 'Certificate of Incorporation',
      rcNumber: 'RC123456',
      businessName: 'BACI TECHNOLOGIES LTD',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends raw image bytes as an image part instead of a remote URL', async () => {
    respondByModelId({ 'cerebras:gemma-4-31b': completeJson });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    await extractCACCertificateData(buffer, 'image/jpeg');

    const call = vi.mocked(generateText).mock.calls[0][0] as {
      messages: Array<{ content: Record<string, unknown>[] }>;
    };
    expect(call.messages[0].content[0]).toEqual(
      expect.objectContaining({
        type: 'image',
        image: buffer,
        mediaType: 'image/jpeg',
      })
    );
  });

  it('falls through to the next vision-chain provider when a result is incomplete', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': completeJson,
    });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.rcNumber).toBe('RC123456');
    expect(result.businessName).toBe('BACI TECHNOLOGIES LTD');
  });

  it('falls through to the next vision-chain provider when a provider throws', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': new Error('429 rate limited'),
      'google:gemini-2.5-flash': completeJson,
    });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(result.rcNumber).toBe('RC123456');
  });

  it('falls back to Ollama once the vision chain is exhausted', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': incompleteJson,
    });
    mocks.getOllamaBaseUrl.mockReturnValue('https://ollama.example.com');
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: completeJson }),
    } as Response);

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(generateText).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(result.rcNumber).toBe('RC123456');
    expect(result.businessName).toBe('BACI TECHNOLOGIES LTD');
  });

  it('returns the Ollama fallback result even when incomplete (final-answer semantic)', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': incompleteJson,
    });
    mocks.getOllamaBaseUrl.mockReturnValue('https://ollama.example.com');
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: incompleteJson }),
    } as Response);

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(result).toEqual({
      documentType: 'Certificate of Incorporation',
      rcNumber: null,
      businessName: null,
    });
  });

  it('encodes raw Ollama Basic Auth credentials for the fallback request', async () => {
    const rawCredentials = ['test-user', 'test-password'].join(':');
    const expectedAuthorization =
      getExpectedAuthorizationHeader(rawCredentials);
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': incompleteJson,
    });
    mocks.getOllamaBaseUrl.mockReturnValue('https://ollama.example.com');
    mocks.getOllamaBasicAuth.mockReturnValue(rawCredentials);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: completeJson }),
    } as Response);

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    await extractCACCertificateData(buffer, 'image/jpeg');

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(options?.headers).toEqual(
      expect.objectContaining({ Authorization: expectedAuthorization })
    );
  });

  it('returns null fields when the vision chain is exhausted and Ollama is not configured', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': incompleteJson,
    });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      documentType: null,
      rcNumber: null,
      businessName: null,
    });
  });

  it('returns null fields when both the vision chain and the Ollama fallback fail', async () => {
    respondByModelId({
      'cerebras:gemma-4-31b': new Error('down'),
      'google:gemini-2.5-flash': new Error('down'),
      'google:gemini-2.5-flash-lite': new Error('down'),
    });
    mocks.getOllamaBaseUrl.mockReturnValue('https://ollama.example.com');
    vi.mocked(global.fetch).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(result).toEqual({
      documentType: null,
      rcNumber: null,
      businessName: null,
    });
  });

  it('returns null fields when the Ollama fallback exceeds its bounded timeout', async () => {
    vi.useFakeTimers();
    respondByModelId({
      'cerebras:gemma-4-31b': incompleteJson,
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': incompleteJson,
    });
    mocks.getOllamaBaseUrl.mockReturnValue('https://ollama.example.com');
    vi.mocked(global.fetch).mockImplementationOnce((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('Expected an abort signal'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          },
          { once: true }
        );
      });
    });

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const resultPromise = extractCACCertificateData(buffer, 'image/jpeg');

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(resultPromise).resolves.toEqual({
      documentType: null,
      rcNumber: null,
      businessName: null,
    });
  });

  it('uses only the Gemini-only chain for PDFs, never sending Cerebras a PDF', async () => {
    respondByModelId({ 'google:gemini-2.5-flash': completeJson });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const result = await extractCACCertificateData(buffer, 'application/pdf');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: GOOGLE_FLASH_PROVIDER.model })
    );
    for (const [call] of vi.mocked(generateText).mock.calls) {
      expect((call as { model: unknown }).model).not.toBe(
        CEREBRAS_PROVIDER.model
      );
    }
    expect(result.rcNumber).toBe('RC123456');
  });

  it('sends PDF bytes as a file part with the declared media type', async () => {
    respondByModelId({ 'google:gemini-2.5-flash': completeJson });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await extractCACCertificateData(buffer, 'application/pdf');

    const call = vi.mocked(generateText).mock.calls[0][0] as {
      messages: Array<{ content: Record<string, unknown>[] }>;
    };
    expect(call.messages[0].content[0]).toEqual(
      expect.objectContaining({
        type: 'file',
        data: buffer,
        mediaType: 'application/pdf',
      })
    );
  });

  it('falls through from Gemini Flash to Flash-Lite for PDFs without ever trying Cerebras', async () => {
    respondByModelId({
      'google:gemini-2.5-flash': new Error('quota exhausted'),
      'google:gemini-2.5-flash-lite': completeJson,
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const result = await extractCACCertificateData(buffer, 'application/pdf');

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.rcNumber).toBe('RC123456');
  });

  it('falls through from Flash to Flash-Lite for PDFs when Flash returns an incomplete result', async () => {
    // Regression: a non-empty but incomplete Flash response (missing required
    // fields) must be rejected by acceptResult so Flash-Lite is still tried,
    // matching the image branch — not accepted and converted to null fields.
    respondByModelId({
      'google:gemini-2.5-flash': incompleteJson,
      'google:gemini-2.5-flash-lite': completeJson,
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const result = await extractCACCertificateData(buffer, 'application/pdf');

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.rcNumber).toBe('RC123456');
    expect(result.businessName).toBeTruthy();
  });

  it('rejects when the Gemini-only chain is exhausted for a PDF (no Ollama tier exists)', async () => {
    respondByModelId({
      'google:gemini-2.5-flash': new Error('down'),
      'google:gemini-2.5-flash-lite': new Error('down'),
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await expect(
      extractCACCertificateData(buffer, 'application/pdf')
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('treats a non-JSON PDF response as a failed attempt and falls through, then throws when the chain is exhausted', async () => {
    // A non-JSON response is incomplete, so acceptResult rejects it and the walk
    // moves on rather than accepting null fields. With no Ollama tier for PDFs,
    // an all-malformed chain exhausts and throws — the verify-cac route wraps
    // this in try/catch and treats it as a verification failure.
    respondByModelId({
      'google:gemini-2.5-flash': 'This is not JSON',
      'google:gemini-2.5-flash-lite': 'still not JSON',
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await expect(
      extractCACCertificateData(buffer, 'application/pdf')
    ).rejects.toThrow();
    // Both Gemini tiers attempted; Cerebras never receives a PDF.
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});

describe('compareCACData', () => {
  it('returns match: true when RC number and business name match', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Incorporation',
        rcNumber: 'RC123456',
        businessName: 'BACI TECHNOLOGIES LTD',
      },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(true);
  });

  it('returns match: false with reason when RC number does not match', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Incorporation',
        rcNumber: 'RC999999',
        businessName: 'BACI TECHNOLOGIES LTD',
      },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(false);
    expect(result.reason).toBe('RC number mismatch');
  });

  it('returns match: false with reason when business name does not match', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Incorporation',
        rcNumber: 'RC123456',
        businessName: 'COMPLETELY DIFFERENT NAME',
      },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(false);
    expect(result.reason).toBe('Business name mismatch');
  });

  it('returns match: false when extracted data is null', () => {
    const result = compareCACData(
      { documentType: null, rcNumber: null, businessName: null },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(false);
    expect(result.reason).toBe('Could not extract document data');
  });

  it('returns match: false with specific reason when only RC number is null', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Incorporation',
        rcNumber: null,
        businessName: 'BACI TECHNOLOGIES LTD',
      },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(false);
    expect(result.reason).toBe('RC number could not be extracted');
  });

  it('returns match: false with specific reason when only business name is null', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Incorporation',
        rcNumber: 'RC123456',
        businessName: null,
      },
      'RC123456',
      'Baci Technologies Ltd'
    );
    expect(result.match).toBe(false);
    expect(result.reason).toBe('Business name could not be extracted');
  });

  it('matches when extracted name contains the full expected name', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Registration',
        rcNumber: 'BN123456',
        businessName: 'BACI TECHNOLOGIES LIMITED NIGERIA',
      },
      'BN123456',
      'Baci Technologies Limited Nigeria'
    );
    // 'BACI TECHNOLOGIES LIMITED NIGERIA'.includes('BACI TECHNOLOGIES LIMITED NIGERIA') === true
    expect(result.match).toBe(true);
  });

  it('returns match: false when extracted name is a short subset of expected name', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Registration',
        rcNumber: 'BN123456',
        businessName: 'BACI TECH',
      },
      'BN123456',
      'Baci Technologies Ltd'
    );
    // 'BACI TECH'.includes('BACI TECHNOLOGIES LTD') === false — one-direction check
    expect(result.match).toBe(false);
    expect(result.reason).toBe('Business name mismatch');
  });
});
