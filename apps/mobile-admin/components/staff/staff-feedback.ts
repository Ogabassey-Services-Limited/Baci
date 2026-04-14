export interface StaffInviteFeedback {
  message: string;
  shareMessage?: string;
  shareUrl?: string;
  title: string;
}

interface StaffInviteFeedbackOptions {
  email: string;
  emailDeliveryFailed: boolean;
  inviteUrl?: string;
  kind: 'invite' | 'resend';
}

export function getStaffInviteFeedback({
  email,
  emailDeliveryFailed,
  inviteUrl,
  kind,
}: StaffInviteFeedbackOptions): StaffInviteFeedback {
  if (kind === 'invite') {
    if (inviteUrl) {
      return {
        title: emailDeliveryFailed ? 'Invite Link Ready' : 'Invitation Sent',
        message: emailDeliveryFailed
          ? `We couldn't deliver the invite email to ${email}. Share the link directly to finish setup.`
          : `The invite email was sent to ${email}. Share the link directly if they don't receive it.`,
        shareMessage: `You've been invited to join the team! Accept here: ${inviteUrl}`,
        shareUrl: inviteUrl,
      };
    }

    return {
      title: emailDeliveryFailed ? 'Invite Created' : 'Success',
      message: emailDeliveryFailed
        ? 'The invitation was created, but the email could not be delivered.'
        : 'Invitation sent successfully',
    };
  }

  if (inviteUrl) {
    return {
      title: emailDeliveryFailed ? 'Invite Link Updated' : 'Invitation Resent',
      message: emailDeliveryFailed
        ? `We couldn't deliver the invite email to ${email}. Share the link directly instead.`
        : `A new invite email was sent to ${email}. Share the link directly if it doesn't arrive.`,
      shareMessage: `Here is your new invitation link: ${inviteUrl}`,
      shareUrl: inviteUrl,
    };
  }

  return {
    title: emailDeliveryFailed ? 'Invite Renewed' : 'Success',
    message: emailDeliveryFailed
      ? 'The invitation was renewed, but the email could not be delivered.'
      : 'Invitation renewed',
  };
}
