import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAiChatModel = vi.fn();
const mockGetAiChatProvider = vi.fn();
const mockGetLlmChatModel = vi.fn();
const mockGetLlmServerBearer = vi.fn();
const mockGetLlmServerUrl = vi.fn();
const mockGetOllamaBaseUrl = vi.fn();
const mockGetOllamaBasicAuth = vi.fn();

vi.mock('@/env', () => ({
  getAiChatModel: () => mockGetAiChatModel(),
  getAiChatProvider: () => mockGetAiChatProvider(),
  getLlmChatModel: () => mockGetLlmChatModel(),
  getLlmServerBearer: () => mockGetLlmServerBearer(),
  getLlmServerUrl: () => mockGetLlmServerUrl(),
  getOllamaBaseUrl: () => mockGetOllamaBaseUrl(),
  getOllamaBasicAuth: () => mockGetOllamaBasicAuth(),
}));

import { resolveWebsitePerformanceGemmaConfig } from './gemma-config';

describe('resolveWebsitePerformanceGemmaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAiChatModel.mockReturnValue('gemma4:e4b');
    mockGetAiChatProvider.mockReturnValue('auto');
    mockGetLlmChatModel.mockReturnValue('relay-gemma');
    mockGetLlmServerBearer.mockReturnValue('relay-token');
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com');
    mockGetOllamaBaseUrl.mockReturnValue('http://127.0.0.1:11434');
    mockGetOllamaBasicAuth.mockReturnValue('user:pass');
  });

  it('prefers VPS Ollama over relay configuration in auto mode', () => {
    expect(resolveWebsitePerformanceGemmaConfig()).toEqual({
      model: 'gemma4:e4b',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      ollamaBasicAuth: 'user:pass',
      provider: 'ollama',
    });
  });

  it('uses the relay in auto mode only when Ollama is unavailable', () => {
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);

    expect(resolveWebsitePerformanceGemmaConfig()).toEqual({
      llmServerBearer: 'relay-token',
      llmServerUrl: 'https://llm.example.com',
      model: 'relay-gemma',
      provider: 'llm',
    });
  });

  it('fails closed when explicit Ollama is missing its base URL', () => {
    mockGetAiChatProvider.mockReturnValueOnce('ollama');
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);

    expect(() => resolveWebsitePerformanceGemmaConfig()).toThrow(
      'Ollama provider explicitly configured but OLLAMA_BASE_URL is missing'
    );
  });

  it('fails closed when explicit LLM is missing relay credentials', () => {
    mockGetAiChatProvider.mockReturnValueOnce('llm');
    mockGetLlmServerBearer.mockReturnValueOnce(undefined);

    expect(() => resolveWebsitePerformanceGemmaConfig()).toThrow(
      'LLM provider explicitly configured but LLM_SERVER_URL or LLM_SERVER_BEARER is missing'
    );
  });

  it('does not silently route unsupported Gemini configuration to another provider', () => {
    mockGetAiChatProvider.mockReturnValueOnce('gemini');

    expect(() => resolveWebsitePerformanceGemmaConfig()).toThrow(
      'Gemini provider is not supported for website performance Gemma insights'
    );
  });
});
