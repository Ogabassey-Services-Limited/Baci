import { getAppUrl } from '@/env';
import { escapeHtmlText } from '@/lib/sanitize';
import { buildStaffInvitePath } from '@/lib/staff-invite-flow';

interface BuildStaffInviteEmailOptions {
  businessName: string;
  role: string;
  to: string;
  toName?: string | null;
  token: string;
}

interface StaffInviteEmailPayload {
  emailType: 'team';
  htmlContent: string;
  subject: string;
  textContent: string;
  to: string;
  toName?: string;
}

export interface StaffInviteEmailResult {
  email: StaffInviteEmailPayload;
  inviteUrl: string;
}

function escapeHtml(value: string): string {
  return escapeHtmlText(value);
}

export function buildStaffInviteEmail({
  businessName,
  role,
  to,
  toName,
  token,
}: BuildStaffInviteEmailOptions): StaffInviteEmailResult {
  const resolvedBusinessName = businessName || 'Your Store';
  const inviteUrl = `${getAppUrl()}${buildStaffInvitePath(token)}`;
  const safeBusinessName = escapeHtml(resolvedBusinessName);
  const safeName = escapeHtml(toName?.trim() || 'there');
  const safeRole = escapeHtml(role.replaceAll('_', ' '));
  const safeInviteUrl = escapeHtml(inviteUrl);

  return {
    inviteUrl,
    email: {
      to,
      toName: toName?.trim() || undefined,
      subject: `You've been invited to join ${resolvedBusinessName}`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">You're Invited!</h1>
          </div>
          <p>Hi ${safeName},</p>
          <p>You've been invited to join <strong>${safeBusinessName}</strong> as a <strong>${safeRole}</strong>.</p>
          <p>Click the button below to accept your invitation and set up your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeInviteUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Accept Invitation</a>
          </div>
          <p style="font-size: 12px; color: #666;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            This invitation was sent by ${safeBusinessName} via Baci.
          </p>
        </body>
        </html>
      `,
      textContent: `Hi ${toName?.trim() || 'there'},\n\nYou've been invited to join ${resolvedBusinessName} as a ${role.replaceAll('_', ' ')}.\n\nClick the link below to accept your invitation:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nIf you didn't expect this invitation, you can safely ignore this email.`,
      emailType: 'team',
    },
  };
}
