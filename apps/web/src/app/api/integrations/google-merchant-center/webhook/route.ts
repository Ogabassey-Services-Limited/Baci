import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Placeholder for Webhook handling
  // This would receive notifications from Google Merchant Center (e.g., account issues, product disapprovals)

  try {
    const body = await request.json();
    // Log event type only, not full payload (prevent log injection)
    const eventType = String(body?.event || body?.type || 'unknown').replace(
      /[\r\n]/g,
      ''
    );
    console.log('Received GMC Webhook event:', eventType);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Bad Request', { status: 400 });
  }
}
