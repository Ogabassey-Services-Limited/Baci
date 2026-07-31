import { describe, expect, it } from 'vitest';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { hasMeaningfulAboutPage } from './has-meaningful-about-page';

describe('hasMeaningfulAboutPage', () => {
  it.each([
    ['a story', { story: 'We help merchants sell online.' }],
    ['a populated values list', { values: ['Trust'] }],
    ['a populated team member', { team: [{ name: 'Ada', role: 'Founder' }] }],
    ['a populated milestone', { milestones: [{ title: 'Founded' }] }],
    ['a populated award', { awards: [{ title: 'Best Store' }] }],
    ['visible social proof', { social_proof: { customers_served: 10 } }],
    ['a gallery image', { gallery: ['https://cdn.example.com/store.jpg'] }],
    ['a supported video', { video_url: 'https://youtu.be/dQw4w9WgXcQ' }],
  ])('returns true for %s', (_name, aboutPage) => {
    expect(hasMeaningfulAboutPage(aboutPage)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an empty object', {}],
    ['blank text', { story: '   ' }],
    ['empty arrays', { values: [], team: [], gallery: [] }],
    ['empty nested objects', { social_proof: {}, team: [{}] }],
    ['an unsupported video URL', { video_url: 'https://example.com/video' }],
    ['a template-only headline', { headline: 'Our Story' }],
    [
      'a template-only image',
      { image_url: 'https://cdn.example.com/about.jpg' },
    ],
    [
      'a team member with only Twitter and Instagram links',
      {
        team: [
          {
            social_links: {
              instagram: 'https://instagram.com/baci',
              twitter: 'https://x.com/baci',
            },
          },
        ],
      },
    ],
  ])('returns false for %s', (_name, aboutPage) => {
    expect(hasMeaningfulAboutPage(aboutPage)).toBe(false);
  });

  it('counts Ogabassey-specific headline and image fields for the Ogabassey template', () => {
    expect(
      hasMeaningfulAboutPage(
        {
          headline: 'Our Story',
          image_url: 'https://cdn.example.com/about.jpg',
        },
        OGABASSEY_TEMPLATE_ID
      )
    ).toBe(true);
  });
});
