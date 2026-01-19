import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBlogPreviewSecret } from '@/env';

/**
 * Preview API Route
 * Enables Next.js Draft Mode for secure previewing of blog posts.
 * 2026 Best Practice: Async draftMode() and type-safe environment access.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug');
  const merchantSlug = searchParams.get('merchantSlug');

  // Verify secret and required params
  if (secret !== getBlogPreviewSecret()) {
    return new Response('Invalid token', { status: 401 });
  }

  if (!slug || !merchantSlug) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Enable Draft Mode (Next.js 16/15 pattern)
  const draft = await draftMode();
  draft.enable();

  // Redirect to the blog post page
  // The page will detect draft mode and include unpublished content
  redirect(`/${merchantSlug}/blog/${slug}`);
}
