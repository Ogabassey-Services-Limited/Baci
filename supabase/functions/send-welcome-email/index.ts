import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ZEPTOMAIL_TOKEN = Deno.env.get('ZEPTOMAIL_TOKEN') || '';
// DB Webhook payload type
interface AuthUserRecord {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  [key: string]: unknown;
}

type WebhookPayload = {
  table: string;
  schema: string;
} & (
  | { type: 'INSERT'; record: AuthUserRecord; old_record: null }
  | {
      type: 'UPDATE';
      record: AuthUserRecord;
      old_record: Partial<AuthUserRecord> | null;
    }
  | { type: 'DELETE'; record: null; old_record: AuthUserRecord }
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log('Received webhook:', payload.type, payload.table);

    // 1. Verify it's the right event
    if (payload.table !== 'users' || payload.schema !== 'auth') {
      return new Response('Ignored: Not auth.users', { status: 200 });
    }

    if (payload.type !== 'UPDATE') {
      return new Response('Ignored: Not UPDATE', { status: 200 });
    }

    const { record, old_record } = payload;

    if (!record || !old_record) {
      return new Response('Ignored: Missing record data', { status: 200 });
    }

    // Check if email_confirmed_at changed from null to something
    const wasConfirmed = old_record ? old_record.email_confirmed_at !== null : true;
    const isConfirmed = record.email_confirmed_at !== null;

    if (wasConfirmed || !isConfirmed) {
      return new Response('Ignored: Not an email confirmation event', {
        status: 200,
      });
    }

    console.log('Email confirmed for user:', record.id, record.email);

    // 2. Fetch Merchant Name
    // We need to wait a moment because the merchant creation might be happening in parallel/transaction
    // checking public.merchants

    // Simple retry logic if merchant not found immediately (race condition possible during signup)
    let businessName = 'Merchant';

    // Try to fetch merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('business_name')
      .eq('user_id', record.id)
      .single();

    if (merchant) {
      businessName = merchant.business_name;
    } else {
      console.log(
        'Merchant record not found immediately via user_id, defaulting name.'
      );
    }

    // 3. Send Email
    const emailTo = record.email;

    console.log('Sending welcome email to:', emailTo, 'Name:', businessName);

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; color: #333; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Welcome to Baci!</h1>
    <p>Hi ${businessName},</p>
    <p>Thanks for verifying your account. We're excited to have you on board!</p>
    <p>Your store is ready to go. You can access your dashboard to start adding products and customizing your site.</p>
    <p>
      <a href="https://usebaci.com/dashboard" 
         style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Go to Dashboard
      </a>
    </p>
    <p>If you have any questions, feel free to reply to this email.</p>
  </div>
</body>
</html>
    `;

    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
      },
      body: JSON.stringify({
        from: { address: 'noreply@usebaci.com', name: 'Baci' },
        to: [{ email_address: { address: emailTo, name: businessName } }],
        subject: 'Welcome to Baci - Your store is ready!',
        htmlbody: htmlBody,
      }),
    });

    const responseText = await response.text();
    console.log('ZeptoMail response:', response.status, responseText);

    if (!response.ok) {
      console.error('Failed to send welcome email via Zepto');
      return new Response(JSON.stringify({ error: 'ZeptoMail failed' }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return new Response(JSON.stringify({ error: 'Internal Error' }), {
      status: 500,
    });
  }
});
