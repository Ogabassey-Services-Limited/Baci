import { describe, expect, it } from 'vitest';
import { aiBuilderConfigSchema } from './builder-config-shape';

describe('aiBuilderConfigSchema', () => {
  it('parses a valid builder config and keeps its content/root/zones', () => {
    const result = aiBuilderConfigSchema.safeParse({
      content: [{ type: 'Hero', props: { title: 'Home' } }],
      root: { title: 'Home' },
      zones: { 'hero-drop': [{ type: 'Text', props: { text: 'Nested' } }] },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toHaveLength(1);
      expect(result.data.zones).toEqual({
        'hero-drop': [{ type: 'Text', props: { text: 'Nested' } }],
      });
    }
  });

  it('accepts and passes through arbitrary theme colour dictionaries', () => {
    const result = aiBuilderConfigSchema.safeParse({
      content: [],
      theme: {
        colors: {
          primary: '#1d4ed8',
          footer: { text: '#ffffff' },
          // Unknown, template-specific colour key must survive passthrough.
          promoBanner: '#facc15',
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.theme?.colors).toMatchObject({
        primary: '#1d4ed8',
        footer: { text: '#ffffff' },
        promoBanner: '#facc15',
      });
    }
  });

  it('rejects a payload whose content is the wrong type', () => {
    const result = aiBuilderConfigSchema.safeParse({ content: 'not-an-array' });
    expect(result.success).toBe(false);
  });
});
