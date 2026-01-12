import { logger } from '@/lib/logger';

const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN;
const API_URL = 'https://api.zeptomail.com/v1.1/email';
const SENDER_EMAIL = 'noreply@usebaci.com';
const SENDER_NAME = 'Baci - The Ecommerce Builder';

export async function sendWelcomeEmail(to: string, name: string) {
  if (!ZEPTOMAIL_TOKEN) {
    logger.warn({
      message: 'ZEPTOMAIL_TOKEN not found, skipping welcome email',
    });
    return { success: false, error: 'Missing configuration' };
  }

  // Clean token if it has prefix in env
  const token = ZEPTOMAIL_TOKEN.replace('Zoho-enczapikey ', '');

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
    <p>Hi ${name},</p>
    <p>Thanks for creating your store. We're excited to have you on board!</p>
    <p>Your store is ready to go. You can access your dashboard to start adding products and customizing your site.</p>
    <p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://usebaci.com'}/dashboard" 
         style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Go to Dashboard
      </a>
    </p>
    <p>If you have any questions, feel free to reply to this email.</p>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify({
        from: { address: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email_address: { address: to, name } }],
        subject: 'Welcome to Baci - Your store is ready!',
        htmlbody: htmlBody,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ message: 'Failed to send welcome email', error: text });
      return { success: false, error: text };
    }

    return { success: true };
  } catch (error) {
    logger.error({ message: 'Exception sending welcome email', error });
    return { success: false, error: String(error) };
  }
}
