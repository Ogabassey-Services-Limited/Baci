import {
  API_BASE_URL,
  EDGE_MARGIN,
  FAB_SIZE,
  HIDDEN_ROUTES,
  NUDGE_HIDDEN_DURATION,
  NUDGE_INITIAL_DELAY,
  NUDGE_VISIBLE_DURATION,
  SCREEN_WIDTH,
  SNAP_THRESHOLD,
} from './constants';

describe('chat constants', () => {
  describe('HIDDEN_ROUTES', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(HIDDEN_ROUTES)).toBe(true);
      expect(HIDDEN_ROUTES.length).toBeGreaterThan(0);
    });

    it('every route starts with "/"', () => {
      for (const route of HIDDEN_ROUTES) {
        expect(route.startsWith('/')).toBe(true);
      }
    });

    it('contains expected routes', () => {
      expect(HIDDEN_ROUTES).toContain('/checkout');
      expect(HIDDEN_ROUTES).toContain('/cart');
      expect(HIDDEN_ROUTES).toContain('/auth/login');
      expect(HIDDEN_ROUTES).toContain('/order-success');
    });
  });

  describe('FAB_SIZE', () => {
    it('is a positive number', () => {
      expect(typeof FAB_SIZE).toBe('number');
      expect(FAB_SIZE).toBeGreaterThan(0);
    });
  });

  describe('EDGE_MARGIN', () => {
    it('is a positive number', () => {
      expect(typeof EDGE_MARGIN).toBe('number');
      expect(EDGE_MARGIN).toBeGreaterThan(0);
    });
  });

  describe('SNAP_THRESHOLD', () => {
    it('equals half the screen width', () => {
      expect(typeof SNAP_THRESHOLD).toBe('number');
      expect(SNAP_THRESHOLD).toBe(SCREEN_WIDTH / 2);
    });
  });

  describe('API_BASE_URL', () => {
    it('starts with "https://"', () => {
      expect(typeof API_BASE_URL).toBe('string');
      expect(API_BASE_URL.startsWith('https://')).toBe(true);
    });
  });

  describe('nudge timing constants', () => {
    it('NUDGE_VISIBLE_DURATION is a positive number', () => {
      expect(typeof NUDGE_VISIBLE_DURATION).toBe('number');
      expect(NUDGE_VISIBLE_DURATION).toBeGreaterThan(0);
    });

    it('NUDGE_HIDDEN_DURATION is a positive number', () => {
      expect(typeof NUDGE_HIDDEN_DURATION).toBe('number');
      expect(NUDGE_HIDDEN_DURATION).toBeGreaterThan(0);
    });

    it('NUDGE_INITIAL_DELAY is a positive number', () => {
      expect(typeof NUDGE_INITIAL_DELAY).toBe('number');
      expect(NUDGE_INITIAL_DELAY).toBeGreaterThan(0);
    });
  });
});
