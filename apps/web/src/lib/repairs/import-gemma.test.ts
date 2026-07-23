import { beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock, requestGemmaCompletion, generateTextWithChain } = vi.hoisted(
  () => ({
    envMock: {
      getLlmServerUrl: vi.fn(),
      getLlmServerBearer: vi.fn(),
      getLlmChatModel: vi.fn(),
      getOllamaBaseUrl: vi.fn(),
      getOllamaBasicAuth: vi.fn(),
      getAiChatModel: vi.fn(),
    },
    requestGemmaCompletion: vi.fn(),
    generateTextWithChain: vi.fn(),
  })
);

vi.mock('@/env', () => envMock);
vi.mock('@/lib/gemma/gemma-completion', () => ({ requestGemmaCompletion }));
vi.mock('@/ai/generate-text-with-chain', () => ({ generateTextWithChain }));

import {
  parseRepairPriceList,
  RepairsImportUnavailableError,
} from './import-gemma';

function gemmaRows(rows: unknown[]): string {
  return JSON.stringify({ rows });
}

function chainText(rows: unknown[]): { providerName: string; text: string } {
  return { providerName: 'cerebras:gemma-4-31b', text: gemmaRows(rows) };
}

beforeEach(() => {
  vi.clearAllMocks();
  envMock.getLlmServerUrl.mockReturnValue(undefined);
  envMock.getLlmServerBearer.mockReturnValue(undefined);
  envMock.getLlmChatModel.mockReturnValue('gemma4:e4b');
  envMock.getOllamaBaseUrl.mockReturnValue(undefined);
  envMock.getOllamaBasicAuth.mockReturnValue(undefined);
  envMock.getAiChatModel.mockReturnValue('gemma4:e4b');
  // Default: the cloud chain is exhausted, so every existing (legacy-focused)
  // test below exercises the fallback path unless it opts into a chain
  // success via mockResolvedValueOnce.
  generateTextWithChain.mockRejectedValue(new Error('all providers failed'));
});

describe('parseRepairPriceList', () => {
  it('throws RepairsImportUnavailableError when the chain fails and no legacy transport is configured', async () => {
    await expect(
      parseRepairPriceList('iPhone 12 screen 25000')
    ).rejects.toBeInstanceOf(RepairsImportUnavailableError);
    expect(requestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('parses rows via the preferred LLM server when configured', async () => {
    envMock.getLlmServerUrl.mockReturnValue('https://llm.internal');
    envMock.getLlmServerBearer.mockReturnValue('secret-token');
    requestGemmaCompletion.mockResolvedValue(
      gemmaRows([
        {
          brand: 'Apple',
          model: 'iPhone 12',
          repair_type: 'Screen',
          price: 25000,
        },
      ])
    );

    const rows = await parseRepairPriceList('iPhone 12 screen 25000');

    expect(requestGemmaCompletion).toHaveBeenCalledTimes(1);
    expect(requestGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        llmServerUrl: 'https://llm.internal',
        llmServerBearer: 'secret-token',
        model: 'gemma4:e4b',
      })
    );
    expect(rows).toEqual([
      {
        brand: 'Apple',
        model: 'iPhone 12',
        repairType: 'Screen',
        price: 25000,
        partQuality: null,
      },
    ]);
  });

  it('throws (without calling the model) when the LLM server bearer is missing', async () => {
    envMock.getLlmServerUrl.mockReturnValue('https://llm.internal');
    envMock.getLlmServerBearer.mockReturnValue(undefined);

    await expect(
      parseRepairPriceList('iPhone 12 screen 25000')
    ).rejects.toBeInstanceOf(RepairsImportUnavailableError);
    expect(requestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('parses rows via Ollama when configured', async () => {
    envMock.getOllamaBaseUrl.mockReturnValue('http://localhost:11434');
    requestGemmaCompletion.mockResolvedValue(
      gemmaRows([
        {
          brand: 'Apple',
          model: 'iPhone 12',
          repair_type: 'Screen',
          price: 25000,
        },
      ])
    );

    const rows = await parseRepairPriceList('iPhone 12 screen 25000');

    expect(requestGemmaCompletion).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        brand: 'Apple',
        model: 'iPhone 12',
        repairType: 'Screen',
        price: 25000,
        partQuality: null,
      },
    ]);
  });

  it('calls the model once per chunk and aggregates rows', async () => {
    envMock.getOllamaBaseUrl.mockReturnValue('http://localhost:11434');
    requestGemmaCompletion
      .mockResolvedValueOnce(
        gemmaRows([
          {
            brand: 'Apple',
            model: 'iPhone 12',
            repair_type: 'Screen',
            price: 25000,
          },
        ])
      )
      .mockResolvedValueOnce(
        gemmaRows([
          {
            brand: 'Samsung',
            model: 'S21',
            repair_type: 'Battery',
            price: 18000,
          },
        ])
      );

    const longText = `${'a'.repeat(1200)}\n${'b'.repeat(1200)}`;
    const rows = await parseRepairPriceList(longText);

    expect(requestGemmaCompletion).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
  });

  it('serves rows from the cloud provider chain without calling the legacy transport', async () => {
    // No legacy transport configured at all — the chain must be able to
    // serve the whole import on its own.
    generateTextWithChain.mockResolvedValueOnce(
      chainText([
        {
          brand: 'Apple',
          model: 'iPhone 12',
          repair_type: 'Screen',
          price: 25000,
        },
      ])
    );

    const rows = await parseRepairPriceList('iPhone 12 screen 25000');

    expect(rows).toEqual([
      {
        brand: 'Apple',
        model: 'iPhone 12',
        repairType: 'Screen',
        price: 25000,
        partQuality: null,
      },
    ]);
    expect(generateTextWithChain).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('repair price rows'),
        prompt: expect.stringContaining('iPhone 12 screen 25000'),
      })
    );
    expect(requestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('prefers the chain even when a legacy transport is also configured', async () => {
    envMock.getLlmServerUrl.mockReturnValue('https://llm.internal');
    envMock.getLlmServerBearer.mockReturnValue('secret-token');
    generateTextWithChain.mockResolvedValueOnce(
      chainText([
        {
          brand: 'Apple',
          model: 'iPhone 12',
          repair_type: 'Screen',
          price: 25000,
        },
      ])
    );

    await parseRepairPriceList('iPhone 12 screen 25000');

    expect(requestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('falls back to the legacy transport per chunk when the chain fails for that chunk', async () => {
    envMock.getOllamaBaseUrl.mockReturnValue('http://localhost:11434');
    generateTextWithChain
      .mockResolvedValueOnce(
        chainText([
          {
            brand: 'Apple',
            model: 'iPhone 12',
            repair_type: 'Screen',
            price: 25000,
          },
        ])
      )
      .mockRejectedValueOnce(new Error('cerebras rate limited'));
    requestGemmaCompletion.mockResolvedValueOnce(
      gemmaRows([
        {
          brand: 'Samsung',
          model: 'S21',
          repair_type: 'Battery',
          price: 18000,
        },
      ])
    );

    const longText = `${'a'.repeat(1200)}\n${'b'.repeat(1200)}`;
    const rows = await parseRepairPriceList(longText);

    expect(generateTextWithChain).toHaveBeenCalledTimes(2);
    // Only the second (chain-failed) chunk falls back to the legacy transport.
    expect(requestGemmaCompletion).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        brand: 'Apple',
        model: 'iPhone 12',
        repairType: 'Screen',
        price: 25000,
        partQuality: null,
      },
      {
        brand: 'Samsung',
        model: 'S21',
        repairType: 'Battery',
        price: 18000,
        partQuality: null,
      },
    ]);
  });

  it('propagates the legacy transport error as-is when both the chain and the configured legacy transport fail', async () => {
    envMock.getOllamaBaseUrl.mockReturnValue('http://localhost:11434');
    requestGemmaCompletion.mockRejectedValueOnce(
      new Error('Gemma completion failed with 500')
    );

    await expect(
      parseRepairPriceList('iPhone 12 screen 25000')
    ).rejects.toThrow('Gemma completion failed with 500');
  });
});
