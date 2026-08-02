import { NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { publishScheduledPosts } from './publish-scheduled-posts-workflow';

/**
 * POST /api/cron/publish-scheduled-posts
 *
 * Manual fallback only - DO NOT re-enable Vercel Cron for this route.
 * Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
 *
 * Security: Requires Authorization header (fallback to x-cron-secret)
 */
export async function POST(request: Request) {
  // Use constant-time comparison before beginning any privileged cron work.
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    console.warn('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return await publishScheduledPosts(createServiceClient());
}

// Support GET for manual fallback invocation.
export async function GET(request: Request) {
  const secret = getCronSecret();
  if (!hasValidCronSecret(request.headers, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });

  return await POST(mockRequest);
}
