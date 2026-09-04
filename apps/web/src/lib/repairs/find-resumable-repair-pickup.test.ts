import { describe, expect, it, vi } from 'vitest';
import type { RepairBookingInput } from '@/lib/validations/repair';
import { findResumablePickupRepair } from './find-resumable-repair-pickup';
import { repairPickupResumeClaims } from './repair-pickup-resume-claim';

const mocks = vi.hoisted(() => ({
  createRepairPickupReceiverClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/repairs/repair-pickup-receiver-client', () => ({
  createRepairPickupReceiverClient: mocks.createRepairPickupReceiverClient,
}));

const merchantId = '123e4567-e89b-12d3-a456-426614174000';
const repairId = '223e4567-e89b-12d3-a456-426614174000';
const secret = 'paystack-secret-for-tests';
const input = {
  customerEmail: 'ada@example.com',
  customerName: 'Ada Lovelace',
  customerPhone: '+2348012345678',
  deviceModel: 'iPhone 15',
  deviceType: 'Smartphone',
  issueDescription: 'The screen no longer responds to touch.',
  pickupAddress: '12 Station Road, Osogbo',
  preferredDate: '2026-09-10T09:00',
  serviceType: 'pickup',
} as RepairBookingInput;

describe('findResumablePickupRepair', () => {
  it('does not reclaim by email alone without a resume capability', async () => {
    const result = await findResumablePickupRepair({
      input,
      merchantId,
      resumeToken: null,
      secret,
    });

    expect(result).toEqual({ kind: 'none' });
    expect(mocks.createRepairPickupReceiverClient).not.toHaveBeenCalled();
  });

  it('reclaims only when the signed resume token matches the unpaid repair', async () => {
    mocks.createRepairPickupReceiverClient.mockReturnValue({
      rpc: mocks.rpc,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: [{ id: repairId, ticket_number: 17 }],
      error: null,
    });
    const resumeToken = repairPickupResumeClaims.create(
      {
        customerEmail: input.customerEmail,
        issuedAt: Date.now(),
        merchantId,
        repairId,
      },
      secret
    );

    const result = await findResumablePickupRepair({
      input,
      merchantId,
      resumeToken,
      secret,
    });

    expect(result).toEqual({
      kind: 'found',
      repair: { success: true, id: repairId, ticketNumber: 17 },
    });
  });

  it('fails closed when the scoped resume lookup errors', async () => {
    mocks.createRepairPickupReceiverClient.mockReturnValue({
      rpc: mocks.rpc,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'jwt expired' },
    });
    const resumeToken = repairPickupResumeClaims.create(
      {
        customerEmail: input.customerEmail,
        issuedAt: Date.now(),
        merchantId,
        repairId,
      },
      secret
    );

    const result = await findResumablePickupRepair({
      input,
      merchantId,
      resumeToken,
      secret,
    });

    expect(result).toMatchObject({ kind: 'error' });
  });
});
