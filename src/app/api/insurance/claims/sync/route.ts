
import { NextRequest, NextResponse } from 'next/server';
import { syncClaimsStatus } from '@/services/insurance';

export async function POST(request: NextRequest) {
    try {
        // In a real scenario, verify admin auth or cron secret
        const { searchParams } = new URL(request.url);
        const merchantId = searchParams.get('merchantId') || 'default';

        const result = await syncClaimsStatus(merchantId);

        if (!result.success) {
            return NextResponse.json({ error: result.message || 'Sync failed' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Claims status synced successfully',
            updatedCount: result.updated
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
