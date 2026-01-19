import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Exit Preview API Route
 * Disables Next.js Draft Mode and redirects the user.
 * 2026 Best Practice: Async draftMode() cleanup.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/blog';

  // Disable Draft Mode
  const draft = await draftMode();
  draft.disable();

  // Redirect back to either the specified callback or the blog home
  redirect(callbackUrl as any);
}
