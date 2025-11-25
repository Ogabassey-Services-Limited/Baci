import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // Placeholder for Webhook handling
    // This would receive notifications from Google Merchant Center (e.g., account issues, product disapprovals)

    try {
        const body = await request.json();
        console.log('Received GMC Webhook:', body);

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return new NextResponse('Bad Request', { status: 400 });
    }
}
