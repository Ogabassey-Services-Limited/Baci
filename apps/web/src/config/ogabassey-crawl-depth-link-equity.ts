import type {
  InternalLinkEquityGroupConfig,
  InternalLinkEquityLink,
  InternalLinkEquityProductLink,
} from './ogabassey-internal-link-equity';

export function parsePipePair(item: string) {
  const parts = item.split('|');
  const [rawValue, rawLabel] = parts;
  const value = rawValue?.trim();
  const label = rawLabel?.trim();

  if (parts.length !== 2 || !value || !label) {
    throw new Error(`Malformed Ogabassey crawl-depth link entry: ${item}`);
  }

  return { value, label };
}

export function linkPairs(items: string[]): InternalLinkEquityLink[] {
  return items.map((item) => {
    const { value, label } = parsePipePair(item);

    if (!value.startsWith('/')) {
      throw new Error(
        `Ogabassey crawl-depth link href must start with '/': ${item}`
      );
    }

    return { href: value, label };
  });
}

export function productLinkPairs(
  items: string[]
): InternalLinkEquityProductLink[] {
  return items.map((item) => {
    const { value, label } = parsePipePair(item);

    return { productSlug: value, label };
  });
}

// Live, indexable July 4, 2026 Semrush crawl-depth rows that were not already
// covered by the core Ogabassey shortcut set. Redirecting subdomains and 404
// rows are intentionally excluded so the section does not promote stale URLs.
export const OGABASSEY_CRAWL_DEPTH_LINK_EQUITY_GROUPS: InternalLinkEquityGroupConfig[] =
  [
    {
      title: 'Additional buying guides',
      description:
        'Editorial shortcuts for active device guides that support product research.',
      links: linkPairs([
        '/blog/gadgets/how-to-maintain-your-iphone-battery-health-at-85-and-beyond|How to maintain iPhone battery health at 85% and beyond',
        '/blog/gadgets/tecno-spark-10-pro-all-you-need-to-know|TECNO Spark 10 Pro buying guide',
        '/blog/iphone-12-pro-in-2026-battery-camera-price-and-safer-open-box-checks-1782625809|iPhone 12 Pro in 2026 open-box checks',
        '/blog/iphone-16-plus-open-box-guide-big-battery-iphone-checks-before-you-pay-1782626702|iPhone 16 Plus open-box buying guide',
        '/blog/iphone/the-iphone-15-what-we-know-so-far|The iPhone 15 buying guide',
        '/blog/itel-it2165-vs-it2167-type-c-which-cheap-backup-phone-makes-more-sense-in-nigeria-1781264926|itel it2165 vs it2167 Type-C backup phones',
        '/blog/itel-it5363-in-nigeria-buy-it-for-calls-standby-battery-and-type-c-not-smartphone-features-1781253373|itel it5363 calls and standby guide',
        '/blog/lenovo-yoga-pro-9-16imh9-used-buying-checklist-who-should-pay-for-the-4k-mini-led-model-in-niger-1781336803|Lenovo Yoga Pro 9 used buying checklist',
        '/blog/smartphones/8-things-you-didnt-know-your-iphone-can-do|8 things you did not know your iPhone can do',
        '/blog/snapdragon-elite-laptops-2025|Snapdragon Elite laptops guide',
        '/blog/tecno-spark-go-3-the-most-durable-budget-phone-in-nigeria-1768510560|TECNO Spark Go 3 durability guide',
      ]),
      productLinks: [],
    },
    {
      title: 'Additional comparison shortcuts',
      description:
        'Direct comparison paths for laptop, smartphone, and gaming buyers.',
      links: linkPairs([
        '/laptops/compare/dell-14-plus-2-in-1-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell 14 Plus 2-in-1 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-15-laptop-dc15250-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell 15 Laptop DC15250 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-g16-7640-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell G16 7640 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-inspiron-14-7440-plus-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Inspiron 14 7440 Plus vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-latitude-3410-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Latitude 3410 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-latitude-3540-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Latitude 3540 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-latitude-5550-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Latitude 5550 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-precision-3570-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Precision 3570 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-precision-5530-workstation-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Precision 5530 Workstation vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-vostro-3530-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell Vostro 3530 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-xps-13-9350-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell XPS 13 9350 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-xps-13-9350-xps-ultra9-93502tb-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell XPS 13 9350 Ultra 9 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/dell-xps-15-9560-laptop-vs-lenovo-thinkpad-x1-carbon-gen-7|Dell XPS 15 9560 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-15-fd0005-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 15 fd0005 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-15-fd0127dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 15 fd0127dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-15-fd0133-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 15 fd0133 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-15-fd0230wm-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 15 fd0230wm vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-15-laptop-15-fd0130wm-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 15 fd0130wm vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-250-g10-vs-lenovo-thinkpad-x1-carbon-gen-7|HP 250 G10 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-1030-g2-x360-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 1030 G2 x360 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-1040-g6-x360-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 1040 G6 x360 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-1040-g7-x360-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 1040 G7 x360 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-1040-g8-x360-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 1040 G8 x360 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-640-g11-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 640 G11 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-840-g3-parent-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 840 G3 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-840-g7-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 840 G7 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-840-g8-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook 840 G8 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-elitebook-x-g1i-14-vs-lenovo-thinkpad-x1-carbon-gen-7|HP EliteBook X G1i 14 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-envy-x360-14-es1013-vs-lenovo-thinkpad-x1-carbon-gen-7|HP Envy x360 14 es1013 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-laptop-14-ep1045nia-vs-lenovo-thinkpad-x1-carbon-gen-7|HP Laptop 14 ep1045nia vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-laptop-15-fd0097nia-vs-lenovo-thinkpad-x1-carbon-gen-7|HP Laptop 15 fd0097nia vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-laptop-15-fd0154wm-vs-lenovo-thinkpad-x1-carbon-gen-7|HP Laptop 15 fd0154wm vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-5-16-af1055-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook 5 16 af1055 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-5-laptop-ai-16-af1017wm-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook 5 AI 16 af1017wm vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-5-laptop-ai-16-af1095cl-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook 5 AI 16 af1095cl vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-7-16-az0595-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook 7 16 az0595 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-ultra-flip-14-fh0013dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook Ultra Flip 14 fh0013dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-x-flip-16-as0033dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook X Flip 16 as0033dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-x-flip-16-as0043dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook X Flip 16 as0043dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-x-flip-ngai-14-fm0023dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook X Flip 14 fm0023dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-omnibook-x-laptop-17-dd0033dx-vs-lenovo-thinkpad-x1-carbon-gen-7|HP OmniBook X 17 dd0033dx vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-probook-440-g11-vs-lenovo-thinkpad-x1-carbon-gen-7|HP ProBook 440 G11 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-probook-460-g11-vs-lenovo-thinkpad-x1-carbon-gen-7|HP ProBook 460 G11 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-zbook-firefly-14-g11-vs-lenovo-thinkpad-x1-carbon-gen-7|HP ZBook Firefly 14 G11 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/hp-zbook-studio-15-g5-vs-lenovo-thinkpad-x1-carbon-gen-7|HP ZBook Studio 15 G5 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/lenovo-thinkbook-16-g7-iml-parent-vs-lenovo-thinkpad-x1-carbon-gen-7|Lenovo ThinkBook 16 G7 IML vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/lenovo-thinkpad-e16-gen-2-vs-lenovo-thinkpad-x1-carbon-gen-7|Lenovo ThinkPad E16 Gen 2 vs Lenovo ThinkPad X1 Carbon Gen 7',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-neo|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Neo',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-13-inch-m2-2022|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 13-inch M2 2022',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-14-inch-2021|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 14-inch 2021',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-14-inch-m2-pro-2023|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 14-inch M2 Pro 2023',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-15-inch-2015|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 15-inch 2015',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-15-inch-2016|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 15-inch 2016',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-15-inch-2017|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 15-inch 2017',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-15-inch-2018|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 15-inch 2018',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-16-inch-2021|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 16-inch 2021',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-16-inch-2023|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro 16-inch 2023',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m3-14-inch|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M3 14-inch',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m3-max|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M3 Max',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m3-pro|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M3 Pro',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m4-14-inch|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M4 14-inch',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m4-max|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M4 Max',
        '/laptops/compare/lenovo-thinkpad-x1-carbon-gen-7-vs-macbook-pro-m4-pro|Lenovo ThinkPad X1 Carbon Gen 7 vs MacBook Pro M4 Pro',
        '/playstation-5/compare/gaming-vs-playstation|Gaming vs PlayStation',
        '/smartphones/compare/google-pixel-6a-vs-xiaomi-13t|Google Pixel 6a vs Xiaomi 13T',
        '/smartphones/compare/google-pixel-8-vs-xiaomi-13t|Google Pixel 8 vs Xiaomi 13T',
        '/smartphones/compare/iphone-11-vs-xiaomi-13t|iPhone 11 vs Xiaomi 13T',
        '/smartphones/compare/iphone-12-vs-xiaomi-13t|iPhone 12 vs Xiaomi 13T',
        '/smartphones/compare/iphone-13-pro-vs-xiaomi-13t|iPhone 13 Pro vs Xiaomi 13T',
        '/smartphones/compare/iphone-14-pro-vs-xiaomi-13t|iPhone 14 Pro vs Xiaomi 13T',
        '/smartphones/compare/iphone-14-vs-xiaomi-13t|iPhone 14 vs Xiaomi 13T',
        '/smartphones/compare/iphone-15-plus-vs-xiaomi-13t|iPhone 15 Plus vs Xiaomi 13T',
        '/smartphones/compare/iphone-15-pro-vs-xiaomi-13t|iPhone 15 Pro vs Xiaomi 13T',
        '/smartphones/compare/iphone-15-vs-xiaomi-13t|iPhone 15 vs Xiaomi 13T',
        '/smartphones/compare/iphone-6s-plus-vs-xiaomi-13t|iPhone 6s Plus vs Xiaomi 13T',
        '/smartphones/compare/iphone-6s-vs-xiaomi-13t|iPhone 6s vs Xiaomi 13T',
        '/smartphones/compare/iphone-7-vs-xiaomi-13t|iPhone 7 vs Xiaomi 13T',
        '/smartphones/compare/iphone-8-vs-xiaomi-13t|iPhone 8 vs Xiaomi 13T',
        '/smartphones/compare/iphone-se-3rd-gen-vs-xiaomi-13t|iPhone SE 3rd Gen vs Xiaomi 13T',
        '/smartphones/compare/iphone-xs-max-vs-xiaomi-13t|iPhone XS Max vs Xiaomi 13T',
        '/smartphones/compare/iphone-xs-vs-xiaomi-13t|iPhone XS vs Xiaomi 13T',
        '/smartphones/compare/redmi-note-14-pro-vs-xiaomi-13t|Redmi Note 14 Pro vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-a17-vs-xiaomi-13t|Samsung Galaxy A17 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-a56-5g-vs-xiaomi-13t|Samsung Galaxy A56 5G vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s21-fe-vs-xiaomi-13t|Samsung Galaxy S21 FE vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s21-plus-vs-xiaomi-13t|Samsung Galaxy S21 Plus vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s21-ultra-vs-xiaomi-13t|Samsung Galaxy S21 Ultra vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s21-vs-xiaomi-13t|Samsung Galaxy S21 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s22-plus-vs-xiaomi-13t|Samsung Galaxy S22 Plus vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s22-ultra-vs-xiaomi-13t|Samsung Galaxy S22 Ultra vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s22-vs-xiaomi-13t|Samsung Galaxy S22 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s23-fe-vs-xiaomi-13t|Samsung Galaxy S23 FE vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s23-ultra-vs-xiaomi-13t|Samsung Galaxy S23 Ultra vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s23-vs-xiaomi-13t|Samsung Galaxy S23 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s25-edge-vs-xiaomi-13t|Samsung Galaxy S25 Edge vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-s25-vs-xiaomi-13t|Samsung Galaxy S25 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-flip-3-vs-xiaomi-13t|Samsung Galaxy Z Flip 3 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-flip-4-vs-xiaomi-13t|Samsung Galaxy Z Flip 4 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-flip-5-vs-xiaomi-13t|Samsung Galaxy Z Flip 5 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-flip-6-vs-xiaomi-13t|Samsung Galaxy Z Flip 6 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-flip-7-fe-vs-xiaomi-13t|Samsung Galaxy Z Flip 7 FE vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-fold-3-vs-xiaomi-13t|Samsung Galaxy Z Fold 3 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-fold-4-vs-xiaomi-13t|Samsung Galaxy Z Fold 4 vs Xiaomi 13T',
        '/smartphones/compare/samsung-galaxy-z-fold-5-vs-xiaomi-13t|Samsung Galaxy Z Fold 5 vs Xiaomi 13T',
        '/smartphones/compare/tecno-spark-40-pro-plus-vs-xiaomi-13t|TECNO Spark 40 Pro Plus vs Xiaomi 13T',
      ]),
      productLinks: [],
    },
    {
      title: 'Additional product shortcuts',
      description:
        'Direct product shortcuts for active Apple, laptop, Pixel, Redmi, Samsung, and TECNO pages.',
      links: [],
      productLinks: productLinkPairs([
        'iphone-16-pro-8gb-512gb-physical-esim-new|iPhone 16 Pro 512GB open box',
        'iphone-16-pro-max-8gb-512gb-physical-esim-new|iPhone 16 Pro Max 512GB open box',
        'iphone-17-pro-8gb-1tb-physical-esim-new|iPhone 17 Pro 1TB open box',
        'iphone-17-pro-8gb-256gb-physical-esim-new|iPhone 17 Pro 256GB open box',
        'iphone-17-pro-8gb-512gb-physical-esim-new|iPhone 17 Pro 512GB open box',
        'asus-rog-zephyrus-gaming|ASUS ROG Zephyrus Gaming',
        'dell-alienware-m18-r3-rtx-5080|Dell Alienware m18 R3 RTX 5080',
        'dell-latitude-5300-2-in-1-i5|Dell Latitude 5300 2-in-1 i5',
        'dell-latitude-5300-2-in-1-i7-8665u-256|Dell Latitude 5300 2-in-1 i7',
        'dell-xps-13-9365-i5|Dell XPS 13 9365 i5',
        'hp-elitebook-1030-g3-x360-i5|HP EliteBook 1030 G3 x360 i5',
        'hp-elitebook-840-g11-ultra-7-32gb|HP EliteBook 840 G11 Ultra 7',
        'macbook-air-13-inch-2020-i3-8gb-128gb|MacBook Air 13-inch 2020 i3',
        'macbook-pro-13-inch-2017-i7-16gb-1tb-touchbar|MacBook Pro 13-inch 2017 i7',
        'google-pixel-6-8gb-256gb|Google Pixel 6 256GB',
        'google-pixel-9-pro-16gb-1tb|Google Pixel 9 Pro 1TB',
        'google-pixel-9-pro-16gb-512gb|Google Pixel 9 Pro 512GB',
        'google-pixel-9-pro-fold-12gb-256gb|Google Pixel 9 Pro Fold 256GB',
        'google-pixel-9-pro-fold-12gb-512gb|Google Pixel 9 Pro Fold 512GB',
        'google-pixel-9-pro-xl-16gb-1tb|Google Pixel 9 Pro XL 1TB',
        'google-pixel-9-pro-xl-16gb-512gb|Google Pixel 9 Pro XL 512GB',
        'iphone-12-pro-6gb-128gb|iPhone 12 Pro 128GB',
        'iphone-12-pro-max-6gb-256gb|iPhone 12 Pro Max 256GB',
        'iphone-13-4gb-256gb|iPhone 13 256GB',
        'iphone-13-pro-6gb-128gb|iPhone 13 Pro 128GB',
        'iphone-13-pro-6gb-256gb|iPhone 13 Pro 256GB',
        'iphone-13-pro-max-6gb-128gb|iPhone 13 Pro Max 128GB',
        'iphone-13-pro-max-6gb-256gb|iPhone 13 Pro Max 256GB',
        'iphone-13-pro-max-6gb-512gb|iPhone 13 Pro Max 512GB',
        'iphone-14-plus-6gb-128gb-physical-esim|iPhone 14 Plus 128GB',
        'iphone-15-pro-max-8gb-1tb-physical-esim|iPhone 15 Pro Max 1TB',
        'iphone-15-pro-max-8gb-256gb|iPhone 15 Pro Max 256GB',
        'iphone-17-air-8gb-1tb|iPhone 17 Air 1TB',
        'iphone-7-plus-3gb-128gb|iPhone 7 Plus 128GB',
        'iphone-se-2nd-gen-3gb-128gb|iPhone SE 2nd Gen 128GB',
        'iphone-x-3gb-256gb|iPhone X 256GB',
        'iphone-x-3gb-64gb|iPhone X 64GB',
        'iphone-xr-3gb-128gb|iPhone XR 128GB',
        'redmi-a3x-4gb-128gb|Redmi A3x 128GB',
        'redmi-note14-8gb-256gb|Redmi Note 14 256GB',
        'samsung-galaxy-a06-lte-4gb-64gb|Samsung Galaxy A06 LTE 64GB',
        'samsung-galaxy-s25-ultra-12gb-256gb|Samsung Galaxy S25 Ultra 256GB',
        'samsung-galaxy-z-flip-7-12gb-256gb|Samsung Galaxy Z Flip 7 256GB',
        'samsung-galaxy-z-fold-6-12gb-256gb|Samsung Galaxy Z Fold 6 256GB',
      ]),
    },
  ];
