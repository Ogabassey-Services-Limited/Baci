import { beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock, requestGemmaCompletion } = vi.hoisted(() => ({
  envMock: {
    getLlmServerUrl: vi.fn(),
    getLlmServerBearer: vi.fn(),
    getLlmChatModel: vi.fn(),
    getOllamaBaseUrl: vi.fn(),
    getOllamaBasicAuth: vi.fn(),
    getAiChatModel: vi.fn(),
  },
  requestGemmaCompletion: vi.fn(),
}));

vi.mock('@/env', () => envMock);
vi.mock('@/lib/gemma/gemma-completion', () => ({ requestGemmaCompletion }));

import {
  parseRepairPriceList,
  RepairsImportUnavailableError,
} from './import-gemma';

function gemmaRows(rows: unknown[]): string {
  return JSON.stringify({ rows });
}

beforeEach(() => {
  vi.clearAllMocks();
  envMock.getLlmServerUrl.mockReturnValue(undefined);
  envMock.getLlmServerBearer.mockReturnValue(undefined);
  envMock.getLlmChatModel.mockReturnValue('gemma4:e4b');
  envMock.getOllamaBaseUrl.mockReturnValue(undefined);
  envMock.getOllamaBasicAuth.mockReturnValue(undefined);
  envMock.getAiChatModel.mockReturnValue('gemma4:e4b');
});

describe('parseRepairPriceList', () => {
  it('throws RepairsImportUnavailableError when no transport is configured', async () => {
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
});
