import * as brevo from '@getbrevo/brevo';

// Initialize Brevo client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

// Default sender email
const DEFAULT_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'orders@usebaci.com';
const DEFAULT_FROM_NAME = process.env.BREVO_FROM_NAME || 'Baci';

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
}

/**
 * Send transactional email via Brevo
 */
export async function sendEmail({
  to,
  toName,
  subject,
  htmlContent,
  textContent,
  replyTo,
}: SendEmailParams) {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      email: DEFAULT_FROM_EMAIL,
      name: DEFAULT_FROM_NAME,
    };

    sendSmtpEmail.to = [
      {
        email: to,
        name: toName || to,
      },
    ];

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    if (textContent) {
      sendSmtpEmail.textContent = textContent;
    }

    if (replyTo) {
      sendSmtpEmail.replyTo = {
        email: replyTo,
      };
    }

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

    return {
      success: true,
      messageId: response.body?.messageId ?? response.response?.headers?.['x-message-id'] ?? 'unknown',
    };
  } catch (error) {
    console.error('Brevo email error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { apiInstance as brevoClient };
