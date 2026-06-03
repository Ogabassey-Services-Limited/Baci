import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkTransactionStatus,
  purchaseBill,
  verifyBillCustomer,
} from './monnify-bills';

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/env', () => ({
  getMonnifyBaseUrl: () => 'https://sandbox.monnify.com',
}));

describe('Monnify Bills Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyBillCustomer', () => {
    it('returns verified details on success', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          customerName: 'JANE DOE',
          validationReference: 'VAL-123',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result).toEqual({
        verified: true,
        customerName: 'JANE DOE',
        validationReference: 'VAL-123',
        message: 'success',
      });
    });

    it('handles verification failure gracefully', async () => {
      const mockResponse = {
        requestSuccessful: false,
        responseCode: '99',
        responseMessage: 'Invalid meter number',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result.verified).toBe(false);
      expect(result.message).toBe('Invalid meter number');
    });
  });

  describe('purchaseBill', () => {
    it('returns successful PurchaseResult', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'Transaction Completed Successfully',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'PAID',
          token: 'TOKEN-1234',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123',
        '08012345678',
        'VAL-123'
      );

      expect(result).toEqual({
        success: true,
        reference: 'BACI-REF-123',
        transactionId: 'MON-TX-123',
        pin: 'TOKEN-1234',
        message: 'Transaction Completed Successfully',
        status: 'successful',
        amount: 2000,
      });
    });

    it('returns failed PurchaseResult on API failure', async () => {
      const mockResponse = {
        requestSuccessful: false,
        responseCode: '99',
        responseMessage: 'Insufficient Balance on Monnify Wallet',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123',
        '08012345678',
        'VAL-123'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toBe('Insufficient Balance on Monnify Wallet');
    });
  });

  describe('checkTransactionStatus', () => {
    it('returns successful status when PAID', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'PAID',
          token: 'TOKEN-1234',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkTransactionStatus('BACI-REF-123');
      expect(result).toEqual({
        status: 'successful',
        message: 'success',
        pin: 'TOKEN-1234',
      });
    });

    it('returns processing status when PENDING', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'PENDING',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkTransactionStatus('BACI-REF-123');
      expect(result.status).toBe('processing');
    });

    it('returns failed status when FAILED', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'FAILED',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkTransactionStatus('BACI-REF-123');
      expect(result.status).toBe('failed');
    });
  });
});
