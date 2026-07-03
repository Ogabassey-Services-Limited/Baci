export interface InternalLinkEquityLink {
  href: string;
  label: string;
}

export interface InternalLinkEquityProductLink {
  productSlug: string;
  label: string;
}

export interface InternalLinkEquityGroupConfig {
  title: string;
  description: string;
  links: InternalLinkEquityLink[];
  productLinks: InternalLinkEquityProductLink[];
}

function linkPairs(items: string[]): InternalLinkEquityLink[] {
  return items.map((item) => {
    const [href = '', label = ''] = item.split('|');

    return { href, label };
  });
}

function productLinkPairs(items: string[]): InternalLinkEquityProductLink[] {
  return items.map((item) => {
    const [productSlug = '', label = ''] = item.split('|');

    return { productSlug, label };
  });
}

// Product entries are referenced by slug and resolved to their canonical
// category path at render time, so catalog recategorizations and variant
// consolidations never leave this section linking through 308 redirects.
// Only category, comparison, and editorial paths may be hardcoded as hrefs.
export const OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS: InternalLinkEquityGroupConfig[] =
  [
    {
      title: 'Core shopping paths',
      description:
        'High-intent storefront pages that help buyers move from broad browsing to specific categories.',
      links: linkPairs([
        '/|Ogabassey home',
        '/accessories|Accessories',
        '/audio|Audio',
        '/compare|Compare products',
        '/earbuds|Earbuds',
        '/gaming-accessories|Gaming accessories',
        '/gaming-laptops|Gaming laptops',
        '/gift-cards|Gift cards',
        '/laptops|Laptops',
        '/lg-tvs|LG TVs',
        '/portable-gaming|Portable gaming',
        '/printers|Printers',
        '/repair|Repair booking',
        '/repairs|Phone repairs',
        '/samsung-tvs|Samsung TVs',
        '/smartphones|Smartphones',
        '/smartwatches|Smartwatches',
        '/swap|Device swap',
        '/tvs|TVs',
        '/wearables|Wearables',
      ]),
      productLinks: [],
    },
    {
      title: 'Apple and audio shortcuts',
      description:
        'Quick links for Apple phones, AirPods, earbuds, speakers, and audio accessories.',
      links: [],
      productLinks: productLinkPairs([
        'iphone-16-pro|iPhone 16 Pro',
        'iphone-16-pro-max|iPhone 16 Pro Max',
        'iphone-17-pro|iPhone 17 Pro',
        'apple-airpods-2|Apple AirPods 2',
        'apple-airpods-3|Apple AirPods 3',
        'airpods-4|Apple AirPods 4',
        'apple-airpods-4-anc|Apple AirPods 4 ANC',
        'apple-airpods-pro|Apple AirPods Pro',
        'apple-airpods-pro-2nd-gen-type-c|AirPods Pro 2 USB-C',
        'apple-airpods-pro-3rd-gen|AirPods Pro 3rd Gen',
        'jbl-clip-4|JBL Clip 4',
        'samsung-galaxy-buds4-pro|Samsung Galaxy Buds4 Pro',
      ]),
    },
    {
      title: 'Smartphone price and product paths',
      description:
        'Direct product paths for iPhone, Pixel, Redmi, Samsung, Tecno, and other smartphone shoppers.',
      links: [],
      productLinks: productLinkPairs([
        'google-pixel-6|Google Pixel 6',
        'google-pixel-9-pro|Google Pixel 9 Pro',
        'google-pixel-9-pro-fold|Google Pixel 9 Pro Fold',
        'google-pixel-9-pro-xl|Google Pixel 9 Pro XL',
        'iphone-7-plus|iPhone 7 Plus',
        'iphone-8-plus|iPhone 8 Plus',
        'iphone-x|iPhone X',
        'iphone-xr|iPhone XR',
        'iphone-se-2nd-gen|iPhone SE 2nd Gen',
        'iphone-12-pro|iPhone 12 Pro',
        'iphone-12-pro-max|iPhone 12 Pro Max',
        'iphone-13|iPhone 13',
        'iphone-13-pro-max|iPhone 13 Pro Max',
        'iphone-14-plus|iPhone 14 Plus',
        'iphone-15-pro-max|iPhone 15 Pro Max',
        'iphone-air|iPhone Air',
        'redmi-a3-pro|Redmi A3 Pro',
        'redmi-a3x|Redmi A3x',
        'redmi-note-14|Redmi Note 14',
        'samsung-galaxy-a06-lte|Samsung Galaxy A06 LTE',
        'samsung-galaxy-s25-ultra|Samsung Galaxy S25 Ultra',
        'samsung-galaxy-z-flip-7|Samsung Galaxy Z Flip 7',
        'samsung-galaxy-z-fold-6|Samsung Galaxy Z Fold 6',
        'tecno-pop-10-pro-4gb-128gb|Tecno Pop 10 Pro',
        'tecno-spark-40|Tecno Spark 40',
      ]),
    },
    {
      title: 'Laptop, MacBook, monitor, and tablet paths',
      description:
        'Direct paths for laptop and monitor shoppers comparing productivity, gaming, and creator devices.',
      links: [],
      productLinks: productLinkPairs([
        'targus-17-inch-groove-backpack|Targus 17-inch Groove backpack',
        'dell-alienware-18-area-51|Dell Alienware 18 Area-51',
        'dell-latitude-5300-2-in-1|Dell Latitude 5300 2-in-1',
        'dell-xps-13-9365|Dell XPS 13 9365',
        'hp-elitebook-1030-g3-x360|HP EliteBook 1030 G3 x360',
        'hp-elitebook-840-g11|HP EliteBook 840 G11',
        'hp-omnibook-ultra-flip-14-fh0018nia|HP OmniBook Ultra Flip 14',
        'hp-victus-15-fa0033|HP Victus 15',
        'hp-zbook-firefly-g11-ultra-7-165h|HP ZBook Firefly G11',
        'lenovo-legion-5-15iah7h-rtx-3070|Lenovo Legion 5 RTX 3070',
        'macbook-air-13-inch-2020-intel|MacBook Air 13-inch 2020',
        'macbook-pro-13-inch-2017|MacBook Pro 13-inch 2017',
        'macbook-pro-13-inch-2020-m1-8gb-256gb|MacBook Pro 13-inch M1 2020',
        'msi-katana-gf66-gaming|MSI Katana GF66 Gaming',
        'msi-thin-gf63-12ucx-898-gaming|MSI Thin GF63 Gaming',
        'hisense-34g6k-pro-curved-gaming-monitor|Hisense 34G6K Pro curved gaming monitor',
        'samsung-c34g55t-curved-gaming-monitor|Samsung C34G55T curved gaming monitor',
        'ipad-pro-11-inch-2018|iPad Pro 11-inch 2018',
      ]),
    },
    {
      title: 'Comparison shortcuts',
      description:
        'Crawlable paths to comparison pages for buyers choosing between similar devices.',
      links: linkPairs([
        '/childrens-tablets/compare/bebe-tab-b88-spider-vs-macpad-air-17-pro-max|Bebe Tab B88 Spider vs MacPad Air 17 Pro Max',
        '/gaming-laptops/compare/msi-katana-gf66-gaming-vs-msi-vector-16-hx-ai-400-gaming|MSI Katana GF66 vs MSI Vector 16 HX AI',
        '/lg-tvs/compare/lg-nanocell-8k-smart-tv-vs-lg-oled-smart-tv|LG NanoCell 8K Smart TV vs LG OLED Smart TV',
        '/portable-gaming/compare/steam-deck-vs-steam-deck-oled|Steam Deck vs Steam Deck OLED',
        '/samsung-tvs/compare/samsung-curved-uhd-4k-smart-tv-vs-samsung-oled-smart-tv|Samsung Curved UHD 4K TV vs Samsung OLED TV',
        '/smartwatches/compare/apple-watch-se-3-vs-riversong-motive-9-pro-smart-watch|Apple Watch SE 3 vs Riversong Motive 9 Pro',
        '/soundbars/compare/samsung-sound-bar-hw-q800b-vs-samsung-sound-bar-hw-q910c|Samsung HW-Q800B vs Samsung HW-Q910C soundbars',
        '/tvs/compare/lg-vs-samsung|LG vs Samsung TVs',
        '/vr-headsets/compare/playstation-vr-2-sense-charger-vs-playstation-vr-2-vr|PlayStation VR2 Sense Charger vs PlayStation VR2',
      ]),
      productLinks: [],
    },
    {
      title: 'Buying advice authors and games',
      description:
        'Editorial and entertainment pages that support buyers with guides, reviews, and author context.',
      links: linkPairs([
        '/blog/author/bassey-john|Bassey John author page',
        '/blog/author/bolakale|Bolakale author page',
      ]),
      productLinks: productLinkPairs([
        'control|Control (PlayStation 4)',
        'cyberpunk-2077|Cyberpunk 2077',
      ]),
    },
  ];
