import { beforeEach, describe, expect, it, vi } from 'vitest';

const seams = vi.hoisted(() => ({
  attestation: vi.fn(),
  bootstrap: vi.fn(),
  client: vi.fn(),
  materialize: vi.fn(),
  smoke: vi.fn(),
}));

vi.mock('@/lib/builder-ai/create-builder-ai-bootstrap-attestation', () => ({
  createBuilderAiBootstrapAttestation: seams.attestation,
}));
vi.mock('@/lib/builder-ai/get-builder-ai-bootstrap-request', () => ({
  getBuilderAiBootstrapRequest: seams.bootstrap,
}));
vi.mock('@/lib/builder-ai/materialize-builder-ai-provider-chain', () => ({
  materializeBuilderAiProviderChain: seams.materialize,
}));
vi.mock('@/lib/builder-ai/smoke-builder-ai-bootstrap-providers', () => ({
  smokeBuilderAiBootstrapProviders: seams.smoke,
}));
vi.mock('@/lib/builder-ai/vercel-builder-ai-bootstrap', () => ({
  createBuilderAiVercelBootstrapClient: seams.client,
}));

import { BUILDER_AI_ATTESTATION_MAX_WORK_MS, maxDuration, POST } from './route';

const runId = '11111111-1111-4111-8111-111111111111';

describe('POST /api/internal/builder-ai-attestation-smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seams.client.mockReturnValue({
      claimToken: vi.fn().mockResolvedValue(true),
      disableBootstrap: vi.fn().mockResolvedValue(true),
      upsertAttestation: vi.fn().mockResolvedValue(true),
    });
    seams.attestation.mockReturnValue({
      environment: { CEREBRAS_API_KEY: 'secret' },
      values: { BUILDER_AI_PROVIDER_BINDING_PEPPER: 'secret' },
    });
    seams.materialize.mockReturnValue({
      providers: [{ name: 'cerebras:gemma-4-31b' }],
    });
    seams.smoke.mockResolvedValue([
      { latencyMs: 1, provider: 'cerebras:gemma-4-31b', result: 'pass' },
    ]);
  });

  it('hides disabled requests before any provider or Vercel action', async () => {
    seams.bootstrap.mockResolvedValue(null);
    const response = await POST(
      new Request(
        'https://usebaci.com/api/internal/builder-ai-attestation-smoke',
        { method: 'POST' }
      )
    );
    expect(response.status).toBe(404);
    expect(seams.client).not.toHaveBeenCalled();
    expect(seams.smoke).not.toHaveBeenCalled();
  });

  it('hides a consumed token before provider work or attestation writes', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.client.mockReturnValue({
      claimToken: vi.fn().mockResolvedValue(false),
      disableBootstrap: vi.fn(),
      upsertAttestation: vi.fn(),
    });

    const response = await POST(
      new Request(
        'https://usebaci.com/api/internal/builder-ai-attestation-smoke',
        { method: 'POST' }
      )
    );

    expect(response.status).toBe(404);
    expect(seams.attestation).not.toHaveBeenCalled();
    expect(seams.smoke).not.toHaveBeenCalled();
  });

  it('allows list-delete, provider smoke, and persistence time within route headroom', () => {
    expect(BUILDER_AI_ATTESTATION_MAX_WORK_MS).toBe(44_000);
    expect(maxDuration * 1000).toBeGreaterThan(
      BUILDER_AI_ATTESTATION_MAX_WORK_MS
    );
  });

  it('returns a correlated control-plane failure when the Vercel client is unavailable', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.client.mockReturnValue(null);

    const response = await POST(
      new Request('https://usebaci.com', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      code: 'bootstrap_control_unavailable',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
  });

  it('claims before smoke then persists only after every provider passes', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    const response = await POST(
      new Request(
        'https://usebaci.com/api/internal/builder-ai-attestation-smoke',
        { method: 'POST' }
      )
    );
    expect(response.status).toBe(200);
    expect(
      seams.client.mock.results[0]?.value.claimToken
    ).toHaveBeenCalledBefore(seams.smoke);
    expect(seams.client.mock.results[0]?.value.claimToken).toHaveBeenCalledWith(
      runId
    );
    expect(
      seams.client.mock.results[0]?.value.upsertAttestation
    ).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        phase: 'attest',
        providers: [
          {
            latencyMs: 1,
            provider: 'cerebras',
            result: 'pass',
          },
        ],
        runId,
        status: 'attested',
      })
    );
  });

  it('does not write tags after a smoke failure and redacts provider details', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.smoke.mockResolvedValue([
      { latencyMs: 1, provider: 'cerebras:gemma-4-31b', result: 'fail' },
    ]);
    const response = await POST(
      new Request(
        'https://usebaci.com/api/internal/builder-ai-attestation-smoke',
        { method: 'POST' }
      )
    );
    expect(response.status).toBe(502);
    expect(
      seams.client.mock.results[0]?.value.upsertAttestation
    ).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      code: 'provider_smoke_failed',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
  });

  it('fails before provider materialization when attest cannot build both tags', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.attestation.mockReturnValue(null);

    const response = await POST(
      new Request('https://usebaci.com', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      code: 'attestation_unavailable',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
    expect(seams.materialize).not.toHaveBeenCalled();
    expect(seams.smoke).not.toHaveBeenCalled();
  });

  it('returns a correlated failure when no canonical provider can materialize', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.materialize.mockReturnValue({ providers: [] });

    const response = await POST(
      new Request('https://usebaci.com', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      code: 'provider_configuration_unavailable',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
  });

  it('rejects an unrecognized provider identity without persisting secrets', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.smoke.mockResolvedValue([
      { latencyMs: 1, provider: 'private-model:secret', result: 'pass' },
    ]);

    const response = await POST(
      new Request('https://usebaci.com', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      code: 'provider_alias_invalid',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
    expect(
      seams.client.mock.results[0]?.value.upsertAttestation
    ).not.toHaveBeenCalled();
  });

  it('returns a correlated failure when the final control-plane write fails', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'attest', runId });
    seams.client.mockReturnValue({
      claimToken: vi.fn().mockResolvedValue(true),
      disableBootstrap: vi.fn(),
      upsertAttestation: vi.fn().mockResolvedValue(false),
    });

    const response = await POST(
      new Request('https://usebaci.com', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      code: 'bootstrap_persistence_failed',
      error: 'Builder AI bootstrap failed',
      phase: 'attest',
      runId,
    });
  });

  it('uses process environment materialization then disables bootstrap after verify', async () => {
    seams.bootstrap.mockResolvedValue({ phase: 'verify', runId });
    const response = await POST(
      new Request(
        'https://usebaci.com/api/internal/builder-ai-attestation-smoke',
        { method: 'POST' }
      )
    );

    expect(response.status).toBe(200);
    expect(seams.attestation).not.toHaveBeenCalled();
    expect(seams.materialize).toHaveBeenCalledWith(
      undefined,
      undefined,
      'smoke'
    );
    expect(
      seams.client.mock.results[0]?.value.disableBootstrap
    ).toHaveBeenCalledOnce();
    expect(
      seams.client.mock.results[0]?.value.upsertAttestation
    ).not.toHaveBeenCalled();
  });
});
