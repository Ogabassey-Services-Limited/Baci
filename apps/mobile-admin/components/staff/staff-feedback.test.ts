import { describe, expect, it } from 'vitest';
import { getStaffInviteFeedback } from '@/components/staff/staff-feedback';

describe('getStaffInviteFeedback', () => {
  it('builds invite success feedback with a share link', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: false,
        inviteUrl: 'https://usebaci.com/invite',
        kind: 'invite',
      })
    ).toEqual({
      title: 'Invitation Sent',
      message:
        "The invite email was sent to ada@example.com. Share the link directly if they don't receive it.",
      shareMessage:
        "You've been invited to join the team! Accept here: https://usebaci.com/invite",
      shareUrl: 'https://usebaci.com/invite',
    });
  });

  it('builds resend failure feedback without a share link when none exists', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: true,
        kind: 'resend',
      })
    ).toEqual({
      title: 'Invite Renewed',
      message:
        'The invitation was renewed, but the email could not be delivered.',
    });
  });

  it('builds invite failure feedback with a share link when delivery fails', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: true,
        inviteUrl: 'https://usebaci.com/invite',
        kind: 'invite',
      })
    ).toEqual({
      title: 'Invite Link Ready',
      message:
        "We couldn't deliver the invite email to ada@example.com. Share the link directly to finish setup.",
      shareMessage:
        "You've been invited to join the team! Accept here: https://usebaci.com/invite",
      shareUrl: 'https://usebaci.com/invite',
    });
  });

  it('builds resend success feedback with a share link', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: false,
        inviteUrl: 'https://usebaci.com/invite',
        kind: 'resend',
      })
    ).toEqual({
      title: 'Invitation Resent',
      message:
        "A new invite email was sent to ada@example.com. Share the link directly if it doesn't arrive.",
      shareMessage:
        'Here is your new invitation link: https://usebaci.com/invite',
      shareUrl: 'https://usebaci.com/invite',
    });
  });

  it('builds invite success feedback without a share link when none exists', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: false,
        kind: 'invite',
      })
    ).toEqual({
      title: 'Success',
      message: 'Invitation sent successfully',
    });
  });

  it('builds resend failure feedback with a share link when delivery fails', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: true,
        inviteUrl: 'https://usebaci.com/invite',
        kind: 'resend',
      })
    ).toEqual({
      title: 'Invite Link Updated',
      message:
        "We couldn't deliver the invite email to ada@example.com. Share the link directly instead.",
      shareMessage:
        'Here is your new invitation link: https://usebaci.com/invite',
      shareUrl: 'https://usebaci.com/invite',
    });
  });

  it('builds resend success feedback without a share link when none exists', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: false,
        kind: 'resend',
      })
    ).toEqual({
      title: 'Success',
      message: 'Invitation renewed',
    });
  });

  it('builds invite failure feedback without a share link when none exists', () => {
    expect(
      getStaffInviteFeedback({
        email: 'ada@example.com',
        emailDeliveryFailed: true,
        kind: 'invite',
      })
    ).toEqual({
      title: 'Invite Created',
      message:
        'The invitation was created, but the email could not be delivered.',
    });
  });
});
