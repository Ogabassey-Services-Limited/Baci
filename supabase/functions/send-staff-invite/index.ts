import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ZEPTOMAIL_TOKEN = Deno.env.get('ZEPTOMAIL_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface StaffMember {
    id: string;
    merchant_id: string;
    email: string;
    name: string | null;
    role: string;
    invitation_token: string;
}

interface WebhookPayload {
    type: 'INSERT';
    table: string;
    record: StaffMember;
    schema: string;
}

const EMAIL_TEMPLATE = (name: string, businessName: string, role: string, inviteUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; color: #334155;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                You've been invited to join <strong>${businessName}</strong> as a <strong>${role.replace('_', ' ')}</strong> on Baci.
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                Click the button below to accept your invitation and set up your account:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #fbbf24; color: #1e1e1e; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                This invitation will expire in 7 days. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Baci Platform. All rights reserved.</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Sent via Baci Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const payload: WebhookPayload = await req.json();
        const { record } = payload;

        // Only process staff invites
        if (!record.email || !record.invitation_token || !record.merchant_id) {
            console.log('Skipping: Missing required fields');
            return new Response(JSON.stringify({ message: 'Skipped' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Initialize Supabase Admin Client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Fetch Merchant Details
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('business_name')
            .eq('id', record.merchant_id)
            .single();

        if (merchantError || !merchant) {
            console.error('Merchant fetch error:', merchantError);
            throw new Error('Merchant not found');
        }

        const businessName = merchant.business_name || 'Your Store';
        const inviteUrl = `https://usebaci.com/invite/${record.invitation_token}`;
        const name = record.name || 'there';

        const htmlBody = EMAIL_TEMPLATE(name, businessName, record.role, inviteUrl);

        console.log(`Sending invite email to ${record.email} for ${businessName}`);

        // Send via ZeptoMail
        const response = await fetch('https://api.zeptomail.com/v1.1/email', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
            },
            body: JSON.stringify({
                from: { address: 'noreply@usebaci.com', name: 'Baci' },
                to: [{ email_address: { address: record.email, name: record.name || '' } }],
                subject: `You've been invited to join ${businessName}`,
                htmlbody: htmlBody,
            }),
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error('ZeptoMail Error:', responseText);
            throw new Error(`ZeptoMail failed: ${responseText}`);
        }

        return new Response(JSON.stringify({ success: true, message: 'Email sent' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
