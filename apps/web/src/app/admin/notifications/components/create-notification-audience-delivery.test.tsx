import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CreateNotificationInput } from '@/types/notifications';
import { CreateNotificationAudienceDelivery } from './create-notification-audience-delivery';

const formData: CreateNotificationInput = {
  channels: ['in_app'],
  message: 'Maintenance starts soon.',
  notification_type: 'info',
  priority: 'normal',
  target_type: 'specific',
  target_merchant_ids: [],
  title: 'Maintenance',
};

function renderAudience(overrides: Partial<CreateNotificationInput> = {}) {
  const props = {
    expiresEnabled: false,
    formData: { ...formData, ...overrides },
    minDateTime: '2026-08-05T12:00',
    onExpiresEnabledChange: vi.fn(),
    onScheduleEnabledChange: vi.fn(),
    onToggleChannel: vi.fn(),
    onUpdate: vi.fn(),
    scheduleEnabled: false,
  };
  return {
    ...render(<CreateNotificationAudienceDelivery {...props} />),
    props,
  };
}

describe('CreateNotificationAudienceDelivery', () => {
  it('normalizes comma-separated merchant IDs before updating a specific audience', () => {
    const { props } = renderAudience();

    fireEvent.change(screen.getByLabelText(/merchant ids/i), {
      target: { value: ' merchant-1, ,merchant-2 , ' },
    });

    expect(props.onUpdate).toHaveBeenCalledWith({
      target_merchant_ids: ['merchant-1', 'merchant-2'],
    });
  });

  it('exposes scheduled time only after scheduling is enabled and preserves its minimum', () => {
    const { props, rerender } = renderAudience({ target_type: 'all' });

    expect(
      screen.queryByLabelText(/schedule date and time/i)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/schedule for later/i));
    expect(props.onScheduleEnabledChange).toHaveBeenCalledWith(true);

    rerender(
      <CreateNotificationAudienceDelivery
        {...props}
        formData={{ ...formData, target_type: 'all' }}
        scheduleEnabled
      />
    );
    const scheduledFor = screen.getByLabelText(/schedule date and time/i);
    expect(scheduledFor).toHaveAttribute('min', '2026-08-05T12:00');
    fireEvent.change(scheduledFor, { target: { value: '2026-08-06T08:30' } });
    expect(props.onUpdate).toHaveBeenCalledWith({
      scheduled_for: '2026-08-06T08:30',
    });
  });
});
