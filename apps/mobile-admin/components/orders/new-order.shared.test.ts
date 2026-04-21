import { describe, expect, it } from 'vitest';
import {
  formatPriceInput,
  getCustomerDisplayContact,
  getCustomerDisplayInitial,
  getCustomerDisplayName,
} from './new-order.shared';

describe('new-order.shared', () => {
  describe('formatPriceInput', () => {
    it('formats integer portions with grouping separators', () => {
      expect(formatPriceInput('12500')).toBe('12,500');
    });

    it('preserves decimal portions while formatting the whole number', () => {
      expect(formatPriceInput('12500.75')).toBe('12,500.75');
    });

    it('returns an empty string when no value is provided', () => {
      expect(formatPriceInput(undefined)).toBe('');
      expect(formatPriceInput('')).toBe('');
    });

    it('keeps existing grouping, normalizes leading decimals, and collapses extra dots', () => {
      expect(formatPriceInput('1,000')).toBe('1,000');
      expect(formatPriceInput('.5')).toBe('0.5');
      expect(formatPriceInput('1.2.3')).toBe('1.23');
    });
  });

  describe('customer display helpers', () => {
    it('prefers the trimmed full name for customer display', () => {
      expect(
        getCustomerDisplayName({
          email: 'ada@example.com',
          first_name: ' Ada ',
          last_name: ' Lovelace ',
          phone: '08012345678',
        })
      ).toBe('Ada Lovelace');
    });

    it('falls back from email to phone to unknown when names are unavailable', () => {
      expect(
        getCustomerDisplayName({
          email: 'merchant-owner@example.com',
          first_name: null,
          last_name: null,
          phone: null,
        })
      ).toBe('merchant-owner');

      expect(
        getCustomerDisplayName({
          email: '   ',
          first_name: '',
          last_name: '',
          phone: '08000000000',
        })
      ).toBe('08000000000');

      expect(
        getCustomerDisplayName({
          email: null,
          first_name: null,
          last_name: null,
          phone: null,
        })
      ).toBe('Unknown');
    });

    it('exposes a contact line and fallback initial from customer data', () => {
      expect(
        getCustomerDisplayContact({
          email: 'ada@example.com',
          phone: '08012345678',
        })
      ).toBe('08012345678');
      expect(
        getCustomerDisplayContact({
          email: 'ada@example.com',
          phone: null,
        })
      ).toBe('ada@example.com');
      expect(
        getCustomerDisplayContact({
          email: null,
          phone: null,
        })
      ).toBe('No contact info');

      expect(
        getCustomerDisplayInitial({
          email: 'ada@example.com',
          first_name: 'Ada',
          phone: '08012345678',
        })
      ).toBe('A');
      expect(
        getCustomerDisplayInitial({
          email: null,
          first_name: '',
          phone: '08012345678',
        })
      ).toBe('0');
      expect(
        getCustomerDisplayInitial({
          email: null,
          first_name: null,
          phone: null,
        })
      ).toBe('?');
    });
  });
});
