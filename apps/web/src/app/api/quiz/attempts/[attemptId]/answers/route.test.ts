import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postLegacyQuizAnswer } from './legacy-route';
import { POST } from './route';
import { postQuizAnswerV2 } from './v2-route';

vi.mock('./legacy-route', () => ({
  postLegacyQuizAnswer: vi.fn(),
}));
vi.mock('./v2-route', () => ({
  postQuizAnswerV2: vi.fn(),
}));

const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';

function request(contractVersion?: string) {
  return new NextRequest(
    `https://shop.test/api/quiz/attempts/${ATTEMPT_ID}/answers`,
    {
      headers: contractVersion
        ? { 'X-Baci-Quiz-Contract': contractVersion }
        : undefined,
      method: 'POST',
    }
  );
}

function context() {
  return { params: Promise.resolve({ attemptId: ATTEMPT_ID }) };
}

describe('quiz answer route dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(postLegacyQuizAnswer).mockResolvedValue(
      NextResponse.json({ contract: 'legacy' })
    );
    vi.mocked(postQuizAnswerV2).mockResolvedValue(
      NextResponse.json({ contract: 'v2' })
    );
  });

  it('sends requests without a contract header to the legacy handler', async () => {
    const routeContext = context();
    const response = await POST(request(), routeContext);

    expect(await response.json()).toEqual({ contract: 'legacy' });
    expect(postLegacyQuizAnswer).toHaveBeenCalledWith(
      expect.any(NextRequest),
      routeContext
    );
    expect(postQuizAnswerV2).not.toHaveBeenCalled();
  });

  it('sends every declared contract to v2, where unsupported versions are rejected', async () => {
    const routeContext = context();
    const response = await POST(request('1'), routeContext);

    expect(await response.json()).toEqual({ contract: 'v2' });
    expect(postQuizAnswerV2).toHaveBeenCalledWith(
      expect.any(NextRequest),
      routeContext
    );
    expect(postLegacyQuizAnswer).not.toHaveBeenCalled();
  });

  it('sends the current contract to the v2 handler', async () => {
    await POST(request('2'), context());

    expect(postQuizAnswerV2).toHaveBeenCalledTimes(1);
    expect(postLegacyQuizAnswer).not.toHaveBeenCalled();
  });
});
