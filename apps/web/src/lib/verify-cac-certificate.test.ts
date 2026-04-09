import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/provider', () => ({
  activeTextModel: {},
}));

vi.mock('@/env', () => ({
  getOllamaBaseUrl: vi.fn(),
  getOllamaCacModel: vi.fn(() => 'gemma4:e4b'),
  getOllamaBasicAuth: vi.fn(() => undefined),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

import { generateText } from 'ai';
import { getOllamaBaseUrl } from '@/env';
import {
  compareCACData,
  extractCACCertificateData,
} from './verify-cac-certificate';

const CAC_PROMPT_EXCERPT = 'Extract from this CAC document';

const validJsonResponse = JSON.stringify({
  documentType: 'Certificate of Incorporation',
  rcNumber: 'RC123456',
  businessName: 'BACI TECHNOLOGIES LTD',
});

describe('extractCACCertificateData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOllamaBaseUrl).mockReturnValue(undefined);
  });

  it('uses Gemini for PDF files', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: validJsonResponse,
    } as Awaited<ReturnType<typeof generateText>>);

    const buffer = new Uint8Array([1, 2, 3]);
    const result = await extractCACCertificateData(buffer, 'application/pdf');

    expect(generateText).toHaveBeenCalledOnce();
    const call = vi.mocked(generateText).mock.calls[0][0];
    const messages = call.messages ?? [];
    const userMessage = messages.find((m) => m.role === 'user');
    const textPart = Array.isArray(userMessage?.content)
      ? userMessage.content.find((p) => p.type === 'text')
      : null;
    expect(textPart && 'text' in textPart ? textPart.text : '').toContain(
      CAC_PROMPT_EXCERPT
    );
    expect(result.rcNumber).toBe('RC123456');
    expect(result.businessName).toBe('BACI TECHNOLOGIES LTD');
    expect(result.documentType).toBe('Certificate of Incorporation');
  });

  it('uses Ollama for image files when OLLAMA_BASE_URL is configured', async () => {
    vi.mocked(getOllamaBaseUrl).mockReturnValue('https://ollama.example.com');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: validJsonResponse }),
    } as Response);

    const buffer = new Uint8Array([0xff, 0xd8, 0xff]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain(
      'https://ollama.example.com'
    );
    expect(result.rcNumber).toBe('RC123456');
  });

  it('falls back to Gemini when Ollama fetch throws', async () => {
    vi.mocked(getOllamaBaseUrl).mockReturnValue('https://ollama.example.com');
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('Connection refused')
    );
    vi.mocked(generateText).mockResolvedValueOnce({
      text: validJsonResponse,
    } as Awaited<ReturnType<typeof generateText>>);

    const buffer = new Uint8Array([1, 2, 3]);
    const result = await extractCACCertificateData(buffer, 'image/png');

    expect(generateText).toHaveBeenCalledOnce();
    expect(result.rcNumber).toBe('RC123456');
  });

  it('falls back to Gemini when Ollama returns non-ok response', async () => {
    vi.mocked(getOllamaBaseUrl).mockReturnValue('https://ollama.example.com');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: validJsonResponse,
    } as Awaited<ReturnType<typeof generateText>>);

    const buffer = new Uint8Array([1, 2, 3]);
    const result = await extractCACCertificateData(buffer, 'image/webp');

    expect(generateText).toHaveBeenCalledOnce();
    expect(result.rcNumber).toBe('RC123456');
  });

  it('uses Gemini directly for images when OLLAMA_BASE_URL is not set', async () => {
    vi.mocked(getOllamaBaseUrl).mockReturnValue(undefined);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: validJsonResponse,
    } as Awaited<ReturnType<typeof generateText>>);

    const buffer = new Uint8Array([1, 2, 3]);
    const result = await extractCACCertificateData(buffer, 'image/jpeg');

    expect(generateText).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.rcNumber).toBe('RC123456');
  });

  it('returns null fields when model response is not valid JSON', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'This is not JSON',
    } as Awaited<ReturnType<typeof generateText>>);

    const buffer = new Uint8Array([1, 2, 3]);
    const result = await extractCACCertificateData(buffer, 'application/pdf');

    expect(result).toEqual({
      documentType: null,
      rcNumber: null,
      businessName: null,
    });
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

  it('matches when extracted name is a substring of expected name', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Registration',
        rcNumber: 'BN123456',
        businessName: 'BACI TECH',
      },
      'BN123456',
      'Baci Technologies Ltd'
    );
    // 'BACI TECHNOLOGIES LTD'.includes('BACI TECH') === true — substring match
    expect(result.match).toBe(true);
  });

  it('matches when expected name is a substring of extracted name', () => {
    const result = compareCACData(
      {
        documentType: 'Certificate of Registration',
        rcNumber: 'BN123456',
        businessName: 'BACI TECHNOLOGIES LIMITED NIGERIA',
      },
      'BN123456',
      'Baci Technologies Limited Nigeria'
    );
    expect(result.match).toBe(true);
  });
});
