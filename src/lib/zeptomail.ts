import { SendMailClient } from 'zeptomail';

// Lazy-initialized client
let client: SendMailClient | null = null;

/**
 * Get or create the ZeptoMail client with validation
 */
function getClient(): SendMailClient {
  if (client) return client;

  const token = process.env.ZEPTOMAIL_TOKEN;
  if (!token) {
    throw new Error('ZEPTOMAIL_TOKEN environment variable is not configured');
  }

  client = new SendMailClient({
    url: 'api.zeptomail.com/',
    token,
  });

  return client;
}

// Default sender configuration
const DEFAULT_FROM_DOMAIN = process.env.ZEPTOMAIL_FROM_DOMAIN || 'usebaci.com';

// Email type to sender address mapping
export type EmailType = 'orders' | 'welcome' | 'notifications' | 'team' | 'newsletter' | 'noreply';

const EMAIL_SENDERS: Record<EmailType, { prefix: string; name: string }> = {
  orders: { prefix: 'orders', name: 'Baci Orders' },
  welcome: { prefix: 'hello', name: 'Baci' },
  notifications: { prefix: 'notifications', name: 'Baci Notifications' },
  team: { prefix: 'team', name: 'Baci Team' },
  newsletter: { prefix: 'newsletter', name: 'Baci Newsletter' },
  noreply: { prefix: 'noreply', name: 'Baci' },
};

function getSenderAddress(emailType: EmailType = 'noreply', customName?: string): { address: string; name: string } {
  const sender = EMAIL_SENDERS[emailType] || EMAIL_SENDERS.noreply;
  return {
    address: `${sender.prefix}@${DEFAULT_FROM_DOMAIN}`,
    name: customName || sender.name,
  };
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
  emailType?: EmailType;
  fromName?: string;
}

interface SendEmailWithTemplateParams {
  to: string;
  toName?: string;
  templateKey: string;
  mergeInfo: Record<string, string>;
  replyTo?: string;
  emailType?: EmailType;
  fromName?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  errorDetails?: unknown;
}

interface ZeptoMailError {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
}

/**
 * Parse ZeptoMail error response
 */
function parseError(error: unknown): { message: string; code?: string; details?: unknown } {
  if (error instanceof Error) {
    return { message: error.message };
  }

  const zeptoError = error as ZeptoMailError;
  if (zeptoError?.error) {
    return {
      message: zeptoError.error.message || 'Unknown ZeptoMail error',
      code: zeptoError.error.code,
      details: zeptoError.error.details,
    };
  }

  return { message: String(error) };
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableCodes: ['TM_5001', 'TM_5002', 'TM_5003'], // Server errors
};

/**
 * Check if error is retryable
 */
function isRetryableError(errorCode?: string): boolean {
  if (!errorCode) return false;
  return RETRY_CONFIG.retryableCodes.includes(errorCode) || errorCode.startsWith('TM_5');
}

/**
 * Send transactional email via ZeptoMail with HTML content
 */
export async function sendEmail({
  to,
  toName,
  subject,
  htmlContent,
  textContent,
  replyTo,
  emailType = 'noreply',
  fromName,
}: SendEmailParams): Promise<EmailResult> {
  // Validate email
  if (!isValidEmail(to)) {
    return {
      success: false,
      error: `Invalid email address: ${to}`,
    };
  }

  if (replyTo && !isValidEmail(replyTo)) {
    return {
      success: false,
      error: `Invalid reply-to email address: ${replyTo}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();
      const sender = getSenderAddress(emailType, fromName);

      const response = await zeptoClient.sendMail({
        from: sender,
        to: [
          {
            email_address: {
              address: to,
              name: toName || to,
            },
          },
        ],
        subject,
        htmlbody: htmlContent,
        ...(textContent && { textbody: textContent }),
        ...(replyTo && {
          reply_to: [
            {
              address: replyTo,
              name: replyTo,
            },
          ],
        }),
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      // Only retry on retryable errors
      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(lastError.code)) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.warn(`ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms:`, lastError.message);
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail email error:', lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    errorCode: lastError?.code,
    errorDetails: lastError?.details,
  };
}

/**
 * Send transactional email via ZeptoMail using a template
 */
export async function sendEmailWithTemplate({
  to,
  toName,
  templateKey,
  mergeInfo,
  replyTo,
  emailType = 'noreply',
  fromName,
}: SendEmailWithTemplateParams): Promise<EmailResult> {
  // Validate email
  if (!isValidEmail(to)) {
    return {
      success: false,
      error: `Invalid email address: ${to}`,
    };
  }

  if (replyTo && !isValidEmail(replyTo)) {
    return {
      success: false,
      error: `Invalid reply-to email address: ${replyTo}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();
      const sender = getSenderAddress(emailType, fromName);

      const response = await zeptoClient.sendMailWithTemplate({
        template_key: templateKey,
        from: sender,
        to: [
          {
            email_address: {
              address: to,
              name: toName || to,
            },
          },
        ],
        merge_info: mergeInfo,
        ...(replyTo && {
          reply_to: [
            {
              address: replyTo,
              name: replyTo,
            },
          ],
        }),
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(lastError.code)) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.warn(`ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms:`, lastError.message);
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail template email error:', lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    errorCode: lastError?.code,
    errorDetails: lastError?.details,
  };
}

/**
 * Send batch emails via ZeptoMail using a template
 */
export async function sendBatchEmailWithTemplate({
  recipients,
  templateKey,
  emailType = 'noreply',
  fromName,
}: {
  recipients: Array<{
    to: string;
    toName?: string;
    mergeInfo: Record<string, string>;
  }>;
  templateKey: string;
  emailType?: EmailType;
  fromName?: string;
}): Promise<EmailResult> {
  // Validate all emails
  const invalidEmails = recipients.filter((r) => !isValidEmail(r.to));
  if (invalidEmails.length > 0) {
    return {
      success: false,
      error: `Invalid email addresses: ${invalidEmails.map((r) => r.to).join(', ')}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();
      const sender = getSenderAddress(emailType, fromName);

      const response = await zeptoClient.mailBatchWithTemplate({
        template_key: templateKey,
        from: sender,
        to: recipients.map((r) => ({
          email_address: {
            address: r.to,
            name: r.toName || r.to,
          },
          merge_info: r.mergeInfo,
        })),
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(lastError.code)) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.warn(`ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms:`, lastError.message);
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail batch email error:', lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    errorCode: lastError?.code,
    errorDetails: lastError?.details,
  };
}
