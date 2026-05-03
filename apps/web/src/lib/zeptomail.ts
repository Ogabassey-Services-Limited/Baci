import { SendMailClient } from 'zeptomail';
import { createAdminClient } from '@/lib/supabase/admin';

// Lazy-initialized client
let client: SendMailClient | null = null;

/**
 * Get or create the ZeptoMail client with validation
 */
function getClient(): SendMailClient {
  if (client) return client;

  const token = process.env.ZEPTOMAIL_TOKEN?.trim();
  if (!token) {
    throw new Error('ZEPTOMAIL_TOKEN environment variable is not configured');
  }

  client = new SendMailClient({
    url: 'api.zeptomail.com/',
    token,
  });

  return client;
}

// Default sender configuration — trim to guard against env vars set with `echo` (trailing \n)
const DEFAULT_FROM_DOMAIN = (
  process.env.ZEPTOMAIL_FROM_DOMAIN || 'usebaci.com'
).trim();

// Email type to sender address mapping
export type EmailType =
  | 'orders'
  | 'welcome'
  | 'notifications'
  | 'team'
  | 'newsletter'
  | 'noreply';

const EMAIL_SENDERS: Record<EmailType, { prefix: string; name: string }> = {
  orders: { prefix: 'orders', name: 'Baci Orders' },
  welcome: { prefix: 'hello', name: 'Baci' },
  notifications: { prefix: 'notifications', name: 'Baci Notifications' },
  team: { prefix: 'team', name: 'Baci Team' },
  newsletter: { prefix: 'newsletter', name: 'Baci Newsletter' },
  noreply: { prefix: 'noreply', name: 'Baci' },
};

function getSenderAddress(
  emailType: EmailType = 'noreply',
  customName?: string
): { address: string; name: string } {
  const sender = EMAIL_SENDERS[emailType] || EMAIL_SENDERS.noreply;
  return {
    address: `${sender.prefix}@${DEFAULT_FROM_DOMAIN}`,
    name: customName || sender.name,
  };
}

/**
 * Validate email address format
 * Uses length limit and simpler pattern to prevent ReDoS
 */
function isValidEmail(email: string): boolean {
  // Limit length to prevent ReDoS attacks
  if (!email || email.length > 254) return false;

  // Simple email validation - avoids complex patterns that can cause backtracking
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) return false;

  const dotIndex = email.lastIndexOf('.');
  if (dotIndex < atIndex + 2 || dotIndex === email.length - 1) return false;

  // No whitespace allowed
  if (/\s/.test(email)) return false;

  return true;
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
  auditContext?: EmailAuditContext;
}

interface SendEmailWithTemplateParams {
  to: string;
  toName?: string;
  templateKey: string;
  mergeInfo: Record<string, string>;
  replyTo?: string;
  emailType?: EmailType;
  fromName?: string;
  auditContext?: EmailAuditContext;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  errorDetails?: unknown;
}

interface EmailAuditContext {
  merchantId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  metadata?: Record<string, unknown>;
}

interface EmailAttemptRow {
  transport_type: 'html' | 'template' | 'batch_template';
  status: 'pending' | 'accepted' | 'failed';
  email_type: EmailType;
  recipient_email: string;
  recipient_name?: string;
  from_address: string;
  from_name: string;
  reply_to?: string;
  subject?: string;
  template_key?: string;
  attempt_count?: number;
  merchant_id?: string | null;
  order_id?: string | null;
  customer_id?: string | null;
  metadata?: Record<string, unknown>;
  provider_message_id?: string;
  provider_error_code?: string;
  provider_error_message?: string;
  provider_error_details?: unknown;
}

interface ZeptoMailError {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
}

type EmailAttemptInsert = EmailAttemptRow & {
  id?: string;
};

/**
 * Parse ZeptoMail error response
 */
function parseError(error: unknown): {
  message: string;
  code?: string;
  details?: unknown;
} {
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

function buildAuditMetadata(
  context: EmailAuditContext | undefined,
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(context?.metadata ?? {}),
    ...(metadata ?? {}),
  };
}

function getAuditClient() {
  try {
    return createAdminClient();
  } catch (error) {
    console.error('Email audit client unavailable:', error);
    return null;
  }
}

async function insertEmailAttempts(
  attempts: EmailAttemptInsert[]
): Promise<string[]> {
  if (attempts.length === 0) {
    return [];
  }

  const supabase = getAuditClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('email_send_attempts')
    .insert(attempts)
    .select('id');

  if (error) {
    console.error('Failed to log email attempts:', error);
    return [];
  }

  return (data ?? [])
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string');
}

async function updateEmailAttempts(
  ids: string[],
  patch: Partial<EmailAttemptInsert>
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const supabase = getAuditClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('email_send_attempts')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) {
    console.error('Failed to update email attempts:', error);
  }
}

function createAuditAttempt(params: {
  transportType: EmailAttemptRow['transport_type'];
  emailType: EmailType;
  recipientEmail: string;
  recipientName?: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  subject?: string;
  templateKey?: string;
  auditContext?: EmailAuditContext;
  metadata?: Record<string, unknown>;
  status?: EmailAttemptRow['status'];
  providerErrorMessage?: string;
}): EmailAttemptInsert {
  return {
    transport_type: params.transportType,
    status: params.status ?? 'pending',
    email_type: params.emailType,
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName,
    from_address: params.fromAddress,
    from_name: params.fromName,
    reply_to: params.replyTo,
    subject: params.subject,
    template_key: params.templateKey,
    merchant_id: params.auditContext?.merchantId ?? null,
    order_id: params.auditContext?.orderId ?? null,
    customer_id: params.auditContext?.customerId ?? null,
    metadata: buildAuditMetadata(params.auditContext, params.metadata),
    ...(params.providerErrorMessage
      ? { provider_error_message: params.providerErrorMessage }
      : {}),
  };
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
  return (
    RETRY_CONFIG.retryableCodes.includes(errorCode) ||
    errorCode.startsWith('TM_5')
  );
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
  auditContext,
}: SendEmailParams): Promise<EmailResult> {
  const sender = getSenderAddress(emailType, fromName);

  // Validate email
  if (!isValidEmail(to)) {
    await insertEmailAttempts([
      createAuditAttempt({
        transportType: 'html',
        emailType,
        recipientEmail: to,
        recipientName: toName,
        fromAddress: sender.address,
        fromName: sender.name,
        replyTo,
        subject,
        auditContext,
        status: 'failed',
        providerErrorMessage: `Invalid email address: ${to}`,
      }),
    ]);

    return {
      success: false,
      error: `Invalid email address: ${to}`,
    };
  }

  if (replyTo && !isValidEmail(replyTo)) {
    await insertEmailAttempts([
      createAuditAttempt({
        transportType: 'html',
        emailType,
        recipientEmail: to,
        recipientName: toName,
        fromAddress: sender.address,
        fromName: sender.name,
        replyTo,
        subject,
        auditContext,
        status: 'failed',
        providerErrorMessage: `Invalid reply-to email address: ${replyTo}`,
      }),
    ]);

    return {
      success: false,
      error: `Invalid reply-to email address: ${replyTo}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null =
    null;
  const auditIds = await insertEmailAttempts([
    createAuditAttempt({
      transportType: 'html',
      emailType,
      recipientEmail: to,
      recipientName: toName,
      fromAddress: sender.address,
      fromName: sender.name,
      replyTo,
      subject,
      auditContext,
    }),
  ]);

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();

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

      await updateEmailAttempts(auditIds, {
        status: 'accepted',
        provider_message_id: response?.request_id || 'unknown',
        attempt_count: attempt + 1,
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      // Only retry on retryable errors
      if (
        attempt < RETRY_CONFIG.maxRetries &&
        isRetryableError(lastError.code)
      ) {
        const delay = RETRY_CONFIG.baseDelayMs * 2 ** attempt;
        console.warn(
          `ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail email error:', JSON.stringify(lastError));
  await updateEmailAttempts(auditIds, {
    status: 'failed',
    attempt_count: RETRY_CONFIG.maxRetries + 1,
    provider_error_code: lastError?.code,
    provider_error_message: lastError?.message || 'Unknown error',
    provider_error_details: lastError?.details,
  });
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
  auditContext,
}: SendEmailWithTemplateParams): Promise<EmailResult> {
  const sender = getSenderAddress(emailType, fromName);

  // Validate email
  if (!isValidEmail(to)) {
    await insertEmailAttempts([
      createAuditAttempt({
        transportType: 'template',
        emailType,
        recipientEmail: to,
        recipientName: toName,
        fromAddress: sender.address,
        fromName: sender.name,
        replyTo,
        templateKey,
        auditContext,
        status: 'failed',
        providerErrorMessage: `Invalid email address: ${to}`,
      }),
    ]);

    return {
      success: false,
      error: `Invalid email address: ${to}`,
    };
  }

  if (replyTo && !isValidEmail(replyTo)) {
    await insertEmailAttempts([
      createAuditAttempt({
        transportType: 'template',
        emailType,
        recipientEmail: to,
        recipientName: toName,
        fromAddress: sender.address,
        fromName: sender.name,
        replyTo,
        templateKey,
        auditContext,
        status: 'failed',
        providerErrorMessage: `Invalid reply-to email address: ${replyTo}`,
      }),
    ]);

    return {
      success: false,
      error: `Invalid reply-to email address: ${replyTo}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null =
    null;
  const auditIds = await insertEmailAttempts([
    createAuditAttempt({
      transportType: 'template',
      emailType,
      recipientEmail: to,
      recipientName: toName,
      fromAddress: sender.address,
      fromName: sender.name,
      replyTo,
      templateKey,
      auditContext,
      metadata: { mergeInfoKeys: Object.keys(mergeInfo) },
    }),
  ]);

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();

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

      await updateEmailAttempts(auditIds, {
        status: 'accepted',
        provider_message_id: response?.request_id || 'unknown',
        attempt_count: attempt + 1,
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      if (
        attempt < RETRY_CONFIG.maxRetries &&
        isRetryableError(lastError.code)
      ) {
        const delay = RETRY_CONFIG.baseDelayMs * 2 ** attempt;
        console.warn(
          `ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail template email error:', JSON.stringify(lastError));
  await updateEmailAttempts(auditIds, {
    status: 'failed',
    attempt_count: RETRY_CONFIG.maxRetries + 1,
    provider_error_code: lastError?.code,
    provider_error_message: lastError?.message || 'Unknown error',
    provider_error_details: lastError?.details,
  });
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
  auditContext,
}: {
  recipients: Array<{
    to: string;
    toName?: string;
    mergeInfo: Record<string, string>;
  }>;
  templateKey: string;
  emailType?: EmailType;
  fromName?: string;
  auditContext?: EmailAuditContext;
}): Promise<EmailResult> {
  const sender = getSenderAddress(emailType, fromName);

  // Validate all emails
  const invalidEmails = recipients.filter((r) => !isValidEmail(r.to));
  if (invalidEmails.length > 0) {
    await insertEmailAttempts(
      invalidEmails.map((recipient) =>
        createAuditAttempt({
          transportType: 'batch_template',
          emailType,
          recipientEmail: recipient.to,
          recipientName: recipient.toName,
          fromAddress: sender.address,
          fromName: sender.name,
          templateKey,
          auditContext,
          status: 'failed',
          providerErrorMessage: `Invalid email address: ${recipient.to}`,
        })
      )
    );

    return {
      success: false,
      error: `Invalid email addresses: ${invalidEmails.map((r) => r.to).join(', ')}`,
    };
  }

  let lastError: { message: string; code?: string; details?: unknown } | null =
    null;
  const auditIds = await insertEmailAttempts(
    recipients.map((recipient) =>
      createAuditAttempt({
        transportType: 'batch_template',
        emailType,
        recipientEmail: recipient.to,
        recipientName: recipient.toName,
        fromAddress: sender.address,
        fromName: sender.name,
        templateKey,
        auditContext,
        metadata: { mergeInfoKeys: Object.keys(recipient.mergeInfo) },
      })
    )
  );

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const zeptoClient = getClient();

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

      await updateEmailAttempts(auditIds, {
        status: 'accepted',
        provider_message_id: response?.request_id || 'unknown',
        attempt_count: attempt + 1,
      });

      return {
        success: true,
        messageId: response?.request_id || 'unknown',
      };
    } catch (error) {
      lastError = parseError(error);

      if (
        attempt < RETRY_CONFIG.maxRetries &&
        isRetryableError(lastError.code)
      ) {
        const delay = RETRY_CONFIG.baseDelayMs * 2 ** attempt;
        console.warn(
          `ZeptoMail retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  console.error('ZeptoMail batch email error:', JSON.stringify(lastError));
  await updateEmailAttempts(auditIds, {
    status: 'failed',
    attempt_count: RETRY_CONFIG.maxRetries + 1,
    provider_error_code: lastError?.code,
    provider_error_message: lastError?.message || 'Unknown error',
    provider_error_details: lastError?.details,
  });
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    errorCode: lastError?.code,
    errorDetails: lastError?.details,
  };
}
