import {
  PROACTIVE_MESSAGES,
  resolveSuggestionRoute,
  SUGGESTIONS,
} from './types';

describe('types constants', () => {
  describe('SUGGESTIONS', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(SUGGESTIONS)).toBe(true);
      expect(SUGGESTIONS.length).toBeGreaterThan(0);
    });

    it('every suggestion has a non-empty label string', () => {
      for (const suggestion of SUGGESTIONS) {
        expect(typeof suggestion.label).toBe('string');
        expect(suggestion.label.trim().length).toBeGreaterThan(0);
      }
    });

    it('every suggestion has a non-empty icon string', () => {
      for (const suggestion of SUGGESTIONS) {
        expect(typeof suggestion.icon).toBe('string');
        expect(suggestion.icon.trim().length).toBeGreaterThan(0);
      }
    });

    it('contains known suggestion labels', () => {
      const labels = SUGGESTIONS.map((s) => s.label);
      expect(labels).toContain('Track my order');
      expect(labels).toContain('Contact support');
    });

    it('includes a repair-quote deep-link chip pointing at /repairs', () => {
      const repairChip = SUGGESTIONS.find((s) => s.route === '/repairs');
      expect(repairChip).toBeDefined();
      expect(repairChip?.label).toBe('Repair quote');
    });
  });

  describe('resolveSuggestionRoute', () => {
    it('returns the route for navigation chips', () => {
      expect(resolveSuggestionRoute({ route: '/repairs' })).toBe('/repairs');
    });

    it('returns null for message-sending chips', () => {
      expect(resolveSuggestionRoute({ route: undefined })).toBeNull();
    });
  });

  describe('PROACTIVE_MESSAGES', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(PROACTIVE_MESSAGES)).toBe(true);
      expect(PROACTIVE_MESSAGES.length).toBeGreaterThan(0);
    });

    it('every proactive message is a non-empty string', () => {
      for (const msg of PROACTIVE_MESSAGES) {
        expect(typeof msg).toBe('string');
        expect(msg.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
