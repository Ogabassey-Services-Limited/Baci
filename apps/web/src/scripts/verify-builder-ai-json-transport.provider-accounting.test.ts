import { describe, expect, it, vi } from 'vitest';
import { createDependencies, loadSmokeModule } from './verify-builder-ai-json-transport.test-support';

describe('verifyBuilderAiJsonTransport provider accounting', () => {
  it('smokes a configured Groq link without requiring Cerebras or an account attestation', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.materializeProviders).mockResolvedValue([
      { model: {}, name: 'groq:openai/gpt-oss-120b' },
    ]);
    const { verifyBuilderAiJsonTransport } = await loadSmokeModule();

    await expect(verifyBuilderAiJsonTransport(dependencies)).resolves.toBe(0);
    expect(dependencies.runProvider).toHaveBeenCalledOnce();
  });

  it('refuses a direct Google or unpinned OpenRouter adapter before probing', async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.materializeProviders).mockResolvedValue([
      { model: {}, name: 'google:gemini-2.5-flash' },
    ]);
    const { verifyBuilderAiJsonTransport } = await loadSmokeModule();

    await expect(verifyBuilderAiJsonTransport(dependencies)).resolves.toBe(1);
    expect(dependencies.runProvider).not.toHaveBeenCalled();
  });
});
