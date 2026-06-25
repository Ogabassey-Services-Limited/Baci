interface InternalLinkEquityLink {
  href: string;
  label: string;
}

interface InternalLinkEquityGroup {
  title: string;
  description: string;
  links: InternalLinkEquityLink[];
}

function linkPairs(items: string[]): InternalLinkEquityLink[] {
  return items.map((item) => {
    const [href = '', label = ''] = item.split('|');

    return { href, label };
  });
}

export const OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS: InternalLinkEquityGroup[] =
  [
    {
      title: 'Core shopping paths',
      description:
        'High-intent storefront pages that help buyers move from broad browsing to specific categories.',
      links: linkPairs([
        '/|Ogabassey home',
        '/gaming-laptops|Gaming laptops',
        '/gaming/control|Gaming controls',
        '/gift-cards|Gift cards',
        '/printers|Printers',
        '/smartwatches|Smartwatches',
        '/swap|Device swap',
        '/tvs|TVs',
        '/wearables|Wearables',
      ]),
    },
    {
      title: 'Apple and audio shortcuts',
      description:
        'Quick links for Apple phones, AirPods, earbuds, speakers, and audio accessories.',
      links: linkPairs([
        '/apple/iphone-16-pro-8gb-512gb-physical-esim-new|iPhone 16 Pro 512GB physical eSIM',
        '/apple/iphone-16-pro-max-8gb-512gb-physical-esim-new|iPhone 16 Pro Max 512GB physical eSIM',
        '/apple/iphone-17-pro-8gb-1tb-physical-esim-new|iPhone 17 Pro 1TB physical eSIM',
        '/apple/iphone-17-pro-8gb-256gb-physical-esim-new|iPhone 17 Pro 256GB physical eSIM',
        '/apple/iphone-17-pro-8gb-512gb-physical-esim-new|iPhone 17 Pro 512GB physical eSIM',
        '/audio/apple-airpods-2|Apple AirPods 2',
        '/audio/apple-airpods-3|Apple AirPods 3',
        '/audio/apple-airpods-4-anc|Apple AirPods 4 ANC',
        '/audio/apple-airpods-pro|Apple AirPods Pro',
        '/audio/apple-airpods-pro-2nd-gen-type-c|AirPods Pro 2 USB-C',
        '/audio/apple-airpods-pro-3rd-gen|AirPods Pro 3rd Gen',
        '/audio/jbl-clip-4|JBL Clip 4',
        '/audio/samsung-galaxy-buds4-pro|Samsung Galaxy Buds4 Pro',
      ]),
    },
    {
      title: 'Smartphone price and product paths',
      description:
        'Direct product paths for iPhone, Pixel, Redmi, Samsung, Tecno, and other smartphone shoppers.',
      links: linkPairs([
        '/redmi/redmi-a3-pro|Redmi A3 Pro',
        '/smartphones/apple-airpods-4|Apple AirPods 4 smartphone category',
        '/smartphones/apple-airpods-pro|Apple AirPods Pro smartphone category',
        '/smartphones/google-pixel-6-8gb-256gb|Google Pixel 6 256GB',
        '/smartphones/google-pixel-9-pro-16gb-1tb|Google Pixel 9 Pro 1TB',
        '/smartphones/google-pixel-9-pro-16gb-512gb|Google Pixel 9 Pro 512GB',
        '/smartphones/google-pixel-9-pro-fold-12gb-256gb|Google Pixel 9 Pro Fold 256GB',
        '/smartphones/google-pixel-9-pro-fold-12gb-512gb|Google Pixel 9 Pro Fold 512GB',
        '/smartphones/google-pixel-9-pro-xl-16gb-1tb|Google Pixel 9 Pro XL 1TB',
        '/smartphones/google-pixel-9-pro-xl-16gb-512gb|Google Pixel 9 Pro XL 512GB',
        '/smartphones/iphone-12-pro-6gb-128gb|iPhone 12 Pro 128GB',
        '/smartphones/iphone-12-pro-max-6gb-256gb|iPhone 12 Pro Max 256GB',
        '/smartphones/iphone-13-4gb-256gb|iPhone 13 256GB',
        '/smartphones/iphone-13-pro-max-6gb-128gb|iPhone 13 Pro Max 128GB',
        '/smartphones/iphone-13-pro-max-6gb-256gb|iPhone 13 Pro Max 256GB',
        '/smartphones/iphone-13-pro-max-6gb-512gb|iPhone 13 Pro Max 512GB',
        '/smartphones/iphone-14-plus-6gb-128gb-physical-esim|iPhone 14 Plus physical eSIM',
        '/smartphones/iphone-15-pro-max-8gb-1tb-physical-esim|iPhone 15 Pro Max 1TB physical eSIM',
        '/smartphones/iphone-15-pro-max-8gb-256gb|iPhone 15 Pro Max 256GB',
        '/smartphones/iphone-17-air-8gb-1tb|iPhone 17 Air 1TB',
        '/smartphones/iphone-7-plus-3gb-128gb|iPhone 7 Plus 128GB',
        '/smartphones/iphone-8-plus-3gb-64gb|iPhone 8 Plus 64GB',
        '/smartphones/iphone-se-2nd-gen-3gb-128gb|iPhone SE 2nd Gen 128GB',
        '/smartphones/iphone-x-3gb-256gb|iPhone X 256GB',
        '/smartphones/iphone-x-3gb-64gb|iPhone X 64GB',
        '/smartphones/iphone-xr-3gb-128gb|iPhone XR 128GB',
        '/smartphones/redmi-a3x-4gb-128gb|Redmi A3x 128GB',
        '/smartphones/redmi-note14-8gb-256gb|Redmi Note 14 256GB',
        '/smartphones/samsung-galaxy-a06-lte-4gb-64gb|Samsung Galaxy A06 LTE 64GB',
        '/smartphones/samsung-galaxy-s25-ultra-12gb-1tb|Samsung Galaxy S25 Ultra 1TB',
        '/smartphones/samsung-galaxy-s25-ultra-12gb-512gb|Samsung Galaxy S25 Ultra 512GB',
        '/smartphones/samsung-galaxy-z-flip-7-12gb-256gb|Samsung Galaxy Z Flip 7 256GB',
        '/smartphones/samsung-galaxy-z-fold-6-12gb-256gb|Samsung Galaxy Z Fold 6 256GB',
        '/tecno/tecno-pop-10-pro-4gb-128gb|Tecno Pop 10 Pro 128GB',
        '/tecno/tecno-spark-40|Tecno Spark 40',
      ]),
    },
    {
      title: 'Laptop, MacBook, monitor, and tablet paths',
      description:
        'Direct paths for laptop and monitor shoppers comparing productivity, gaming, and creator devices.',
      links: linkPairs([
        '/accessories/targus-17-inch-groove-backpack|Targus 17-inch Groove backpack',
        '/laptops/dell-alienware-18-area-51|Dell Alienware 18 Area-51',
        '/laptops/dell-latitude-5300-2-in-1-i5|Dell Latitude 5300 2-in-1 i5',
        '/laptops/dell-latitude-5300-2-in-1-i7-8665u-256|Dell Latitude 5300 2-in-1 i7',
        '/laptops/dell-xps-13-9365-i5|Dell XPS 13 9365 i5',
        '/laptops/hp-elitebook-1030-g3-x360-i5|HP EliteBook 1030 G3 x360 i5',
        '/laptops/hp-elitebook-840-g11-ultra-7-32gb|HP EliteBook 840 G11 Ultra 7',
        '/laptops/hp-omnibook-ultra-flip-14-fh0018nia|HP OmniBook Ultra Flip 14',
        '/laptops/hp-victus-15-fa0033|HP Victus 15 FA0033',
        '/laptops/hp-zbook-firefly-g11-ultra-7-165h|HP ZBook Firefly G11 Ultra 7',
        '/laptops/lenovo-legion-5-15iah7h-rtx-3070|Lenovo Legion 5 RTX 3070',
        '/laptops/macbook-air-13-inch-2020-i3-8gb-128gb|MacBook Air 13-inch 2020 i3',
        '/laptops/macbook-pro-13-inch-2017-i7-16gb-1tb-touchbar|MacBook Pro 13-inch 2017 Touch Bar',
        '/laptops/msi-katana-gf66-gaming|MSI Katana GF66 Gaming',
        '/laptops/msi-thin-gf63-12ucx-898-gaming|MSI Thin GF63 12UCX Gaming',
        '/macbooks/macbook-pro-13-inch-2020-m1-8gb-256gb|MacBook Pro 13-inch M1 2020',
        '/monitors/hisense-34g6k-pro-curved-gaming-monitor|Hisense 34G6K Pro curved gaming monitor',
        '/monitors/samsung-c34g55t-curved-gaming-monitor|Samsung C34G55T curved gaming monitor',
        '/tablets/ipad-pro-11-inch-2018|iPad Pro 11-inch 2018',
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
    },
    {
      title: 'Buying advice authors and games',
      description:
        'Editorial and entertainment pages that support buyers with guides, reviews, and author context.',
      links: linkPairs([
        '/blog/author/bassey-john|Bassey John author page',
        '/blog/author/bolakale|Bolakale author page',
        '/gaming/cyberpunk-2077|Cyberpunk 2077',
      ]),
    },
  ];
