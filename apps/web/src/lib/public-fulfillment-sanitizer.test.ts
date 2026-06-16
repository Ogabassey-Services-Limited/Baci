import { describe, expect, it } from 'vitest';
import {
  sanitizePublicOrder,
  sanitizePublicOrderItem,
  sanitizePublicProduct,
  sanitizePublicProductVariant,
} from './public-fulfillment-sanitizer';

describe('public-fulfillment-sanitizer', () => {
  describe('sanitizePublicProduct', () => {
    it('removes fulfillment_details from product object', () => {
      const product = {
        id: 'prod-1',
        name: 'iPhone 15',
        fulfillment_details: { imei: '123456789012345' },
      };

      const result = sanitizePublicProduct(product);
      expect(result).toEqual({
        id: 'prod-1',
        name: 'iPhone 15',
      });
      expect(result.fulfillment_details).toBeUndefined();
    });

    it('recursively sanitizes variants array inside product', () => {
      const product = {
        id: 'prod-1',
        name: 'iPhone 15',
        fulfillment_details: { imei: '123456789012345' },
        variants: [
          {
            id: 'var-1',
            fulfillment_details: { imei: '99999' },
          },
        ],
      };

      const result = sanitizePublicProduct(product);
      expect(result).toEqual({
        id: 'prod-1',
        name: 'iPhone 15',
        variants: [
          {
            id: 'var-1',
          },
        ],
      });
    });

    it('works on arrays of products', () => {
      const products = [
        { id: '1', fulfillment_details: 'secret' },
        { id: '2', name: 'MacBook' },
      ];

      const result = sanitizePublicProduct(products);
      expect(result).toEqual([{ id: '1' }, { id: '2', name: 'MacBook' }]);
    });
  });

  describe('sanitizePublicProductVariant', () => {
    it('removes fulfillment_details from variant', () => {
      const variant = {
        id: 'var-1',
        price_override: 100,
        fulfillment_details: 'secret',
      };
      expect(sanitizePublicProductVariant(variant)).toEqual({
        id: 'var-1',
        price_override: 100,
      });
    });
  });

  describe('sanitizePublicOrderItem', () => {
    it('removes fulfillment_data from order item', () => {
      const item = {
        id: 'item-1',
        name: 'iPhone 15',
        price: 500,
        fulfillment_data: { imei: '123456789012345' },
      };
      expect(sanitizePublicOrderItem(item)).toEqual({
        id: 'item-1',
        name: 'iPhone 15',
        price: 500,
      });
    });
  });

  describe('sanitizePublicOrder', () => {
    it('removes fulfillment_details and sanitizes nested order_items', () => {
      const order = {
        id: 'order-1',
        order_number: 'BACI-1001',
        fulfillment_details: { tracking: 'ABC' },
        order_items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            fulfillment_data: { serial: 'XYZ' },
          },
        ],
      };

      expect(sanitizePublicOrder(order)).toEqual({
        id: 'order-1',
        order_number: 'BACI-1001',
        order_items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
          },
        ],
      });
    });

    it('sanitizes nested storefront items arrays', () => {
      const order = {
        id: 'order-2',
        items: [
          {
            id: 'item-2',
            fulfillment_data: { imei: '123456789012345' },
            name: 'iPhone 16',
          },
        ],
      };

      expect(sanitizePublicOrder(order)).toEqual({
        id: 'order-2',
        items: [
          {
            id: 'item-2',
            name: 'iPhone 16',
          },
        ],
      });
    });
  });
});
