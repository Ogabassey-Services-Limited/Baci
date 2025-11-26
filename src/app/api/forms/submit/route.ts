import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const body = await request.json();

        const { merchantId, formName, formData } = body;

        // Validate required fields
        if (!merchantId || !formName || !formData) {
            return NextResponse.json(
                { error: 'Missing required fields: merchantId, formName, or formData' },
                { status: 400 }
            );
        }

        // Validate merchant exists
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('id', merchantId)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json(
                { error: 'Invalid merchant ID' },
                { status: 400 }
            );
        }

        // Get IP address and user agent
        const ip = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Insert form submission
        const { data: submission, error: submitError } = await supabase
            .from('form_submissions')
            .insert({
                merchant_id: merchantId,
                form_name: formName,
                form_data: formData,
                ip_address: ip,
                user_agent: userAgent,
                status: 'unread'
            })
            .select()
            .single();

        if (submitError) {
            console.error('Error saving form submission:', submitError);
            return NextResponse.json(
                { error: 'Failed to save form submission' },
                { status: 500 }
            );
        }

        // TODO: Send email notification to merchant (optional feature)
        // This could be implemented using Resend, SendGrid, or similar

        return NextResponse.json({
            success: true,
            message: 'Form submitted successfully',
            submissionId: submission.id
        });

    } catch (error) {
        console.error('Form submission error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
