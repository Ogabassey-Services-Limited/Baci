import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { builderCreateSchema, builderPublishSchema } from '@/schemas/builder';
import {
  getBuilderRequestContext,
  loadBuilderPayload,
  publishBuilderDraft,
  saveBuilderDraft,
} from './builder-route-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageSlug = searchParams.get('slug') || 'home';

  const contextResult = await getBuilderRequestContext(request, 'view');
  if (contextResult.response) {
    return contextResult.response;
  }

  const builderPayload = await loadBuilderPayload(
    contextResult.context.supabase,
    contextResult.context.merchantId,
    pageSlug,
    contextResult.context.canEdit
  );
  if (builderPayload.response) {
    return builderPayload.response;
  }

  return NextResponse.json(builderPayload.data);
}

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) return response as NextResponse;

  const contextResult = await getBuilderRequestContext(request, 'edit');
  if (contextResult.response) {
    return contextResult.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = builderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const saveResult = await saveBuilderDraft(
    contextResult.context.supabase,
    contextResult.context.merchantId,
    parsed.data
  );
  if (saveResult.response) {
    return saveResult.response;
  }

  return NextResponse.json({
    success: true,
    data: saveResult.data,
    lastUpdated: saveResult.lastUpdated,
  });
}

export async function PUT(request: NextRequest) {
  // Publish endpoint
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) return response as NextResponse;

  const contextResult = await getBuilderRequestContext(request, 'edit');
  if (contextResult.response) {
    return contextResult.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = builderPublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const publishResult = await publishBuilderDraft(
    contextResult.context.supabase,
    contextResult.context.merchantId,
    parsed.data
  );
  if (publishResult.response) {
    return publishResult.response;
  }

  return NextResponse.json({
    success: true,
    lastUpdated: publishResult.lastUpdated,
  });
}
