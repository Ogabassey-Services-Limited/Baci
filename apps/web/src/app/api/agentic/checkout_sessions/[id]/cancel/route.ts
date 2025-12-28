import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params; // Next.js 15+ await params

  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServiceClient();

    // Check if exists
    const { data: session, error: fetchError } = await supabase
      .from('checkout_sessions')
      .select('status')
      .eq('id', params.id)
      .single();

    if (fetchError || !session)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status === 'completed')
      return NextResponse.json(
        { error: 'Cannot cancel completed session' },
        { status: 409 }
      );

    // Update status
    await supabase
      .from('checkout_sessions')
      .update({ status: 'canceled' })
      .eq('id', params.id);

    return NextResponse.json({
      id: params.id,
      status: 'canceled',
    });
    // biome-ignore lint/suspicious/noExplicitAny: Generic error handling
  } catch (err: any) {
    console.error('Agentic Checkout Cancel Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
