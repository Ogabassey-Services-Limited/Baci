import { describe, expect, it } from 'vitest';
import { myCoverWebhookSchema } from './mycover-webhook';

describe('myCoverWebhookSchema', () => {
  describe('existing v1 fields (backwards compatibility)', () => {
    it('parses a minimal valid payload', () => {
      const payload = {
        event: 'policy.created',
        data: {},
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('parses payload with all v1 fields', () => {
      const payload = {
        event: 'policy.updated',
        data: {
          policy_id: 'pol-123',
          policy_number: 'POL-2024-001',
          status: 'active',
          customer: {
            email: 'john@example.com',
            phone: '+2348012345678',
            first_name: 'John',
            last_name: 'Doe',
          },
          start_date: '2024-01-01',
          expiration_date: '2024-12-31',
          genius_price: 25000,
          market_price: 30000,
          claim_id: 'claim-456',
          claim_status: 'pending',
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects payload without event field', () => {
      const payload = {
        data: { policy_id: 'pol-123' },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects payload without data field', () => {
      const payload = {
        event: 'policy.created',
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('v2 fields', () => {
    it('accepts certificate_url in data', () => {
      const payload = {
        event: 'policy.created',
        data: {
          policy_id: 'pol-123',
          certificate_url: 'https://mycover.ai/certificates/POL-2024-001.pdf',
        },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.certificate_url).toBe(
          'https://mycover.ai/certificates/POL-2024-001.pdf'
        );
      }
    });

    it('accepts product_id in data', () => {
      const payload = {
        event: 'policy.created',
        data: {
          policy_id: 'pol-123',
          product_id: 'mycover-product-abc',
        },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.product_id).toBe('mycover-product-abc');
      }
    });

    it('accepts product_category_id in data', () => {
      const payload = {
        event: 'policy.created',
        data: {
          policy_id: 'pol-123',
          product_category_id: 'category-gadget-001',
        },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.product_category_id).toBe(
          'category-gadget-001'
        );
      }
    });

    it('accepts provider_id in data', () => {
      const payload = {
        event: 'policy.created',
        data: {
          policy_id: 'pol-123',
          provider_id: 'provider-sti-001',
        },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.provider_id).toBe('provider-sti-001');
      }
    });

    it('accepts all v2 fields together with v1 fields', () => {
      const payload = {
        event: 'policy.created',
        data: {
          policy_id: 'pol-123',
          policy_number: 'POL-2024-001',
          status: 'active',
          genius_price: 25000,
          certificate_url: 'https://mycover.ai/certificates/POL-2024-001.pdf',
          product_id: 'mycover-product-abc',
          product_category_id: 'category-gadget-001',
          provider_id: 'provider-sti-001',
        },
        timestamp: '2024-06-15T12:00:00Z',
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.certificate_url).toBe(
          'https://mycover.ai/certificates/POL-2024-001.pdf'
        );
        expect(result.data.data.product_id).toBe('mycover-product-abc');
        expect(result.data.data.product_category_id).toBe(
          'category-gadget-001'
        );
        expect(result.data.data.provider_id).toBe('provider-sti-001');
      }
    });

    it('v2 fields are accessible on the parsed type (not stripped)', () => {
      const payload = {
        event: 'claim.updated',
        data: {
          claim_id: 'claim-789',
          claim_status: 'Documented',
          certificate_url: 'https://mycover.ai/certificates/cert.pdf',
          product_id: 'prod-1',
          product_category_id: 'cat-1',
          provider_id: 'prov-1',
        },
      };

      const result = myCoverWebhookSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        // These must be present in the parsed output, not stripped by the schema
        const data = result.data.data;
        expect(data).toHaveProperty('certificate_url');
        expect(data).toHaveProperty('product_id');
        expect(data).toHaveProperty('product_category_id');
        expect(data).toHaveProperty('provider_id');
      }
    });
  });
});
