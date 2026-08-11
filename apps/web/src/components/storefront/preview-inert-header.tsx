type PreviewLink = {
  label: string;
};

type PreviewHeaderLayout =
  | 'logo-left-nav-center'
  | 'logo-left-nav-right'
  | 'logo-center';

type PreviewHeaderProps = {
  backgroundColor?: string;
  ctaButton?: { show: boolean; text: string };
  glassEffect?: boolean;
  layout?: PreviewHeaderLayout;
  navigationLinks?: PreviewLink[];
  paddingY?: 'sm' | 'md' | 'lg';
  searchRadius?: 'none' | 'sm' | 'md' | 'full';
  searchStyle?: 'outline' | 'filled' | 'minimal';
  showCart?: boolean;
  showLogo?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  sticky?: boolean;
  storeName?: string;
  textColor?: string;
};

const layoutClasses: Record<PreviewHeaderLayout, string> = {
  'logo-center': 'grid grid-cols-3 items-center gap-3',
  'logo-left-nav-center': 'grid grid-cols-[auto_1fr_auto] items-center gap-3',
  'logo-left-nav-right': 'flex items-center gap-3',
};

const paddingClasses = {
  lg: 'py-6',
  md: 'py-4',
  sm: 'py-2',
} as const;

const searchRadiusClasses = {
  full: 'rounded-full',
  md: 'rounded-md',
  none: 'rounded-none',
  sm: 'rounded-sm',
} as const;

const searchStyleClasses = {
  filled: 'border border-transparent bg-muted',
  minimal: 'border-0 bg-transparent',
  outline: 'border border-current bg-transparent',
} as const;

function InertHeaderAction({ children }: { children: string }) {
  return (
    <button aria-disabled="true" disabled type="button">
      {children}
    </button>
  );
}

export function PreviewInertHeader({
  backgroundColor,
  ctaButton,
  glassEffect = false,
  layout = 'logo-left-nav-center',
  navigationLinks = [],
  paddingY = 'md',
  searchRadius = 'md',
  searchStyle = 'outline',
  showCart = false,
  showLogo = true,
  showMenu = false,
  showSearch = false,
  sticky = false,
  storeName = 'Preview Store',
  textColor,
}: PreviewHeaderProps) {
  const isCenteredLayout = layout === 'logo-center';
  return (
    <header
      className={`${paddingClasses[paddingY]} ${layoutClasses[layout]}${
        sticky ? ' sticky top-0 z-10' : ''
      }${glassEffect ? ' bg-store-background/70 backdrop-blur-md' : ''}`}
      data-glass-effect={String(glassEffect)}
      data-layout={layout}
      data-sticky={String(sticky)}
      data-testid="builder-preview-inert-header"
      style={{ backgroundColor, color: textColor }}
    >
      {showLogo ? (
        <strong
          className={
            isCenteredLayout ? 'col-start-2 justify-self-center' : undefined
          }
        >
          {storeName}
        </strong>
      ) : null}
      {navigationLinks.length > 0 ? (
        <nav
          aria-label="Preview navigation"
          className={
            layout === 'logo-left-nav-right'
              ? 'ml-auto'
              : isCenteredLayout
                ? 'col-start-2 row-start-2 justify-self-center'
                : 'justify-self-center'
          }
        >
          {navigationLinks.map((link) => (
            <span key={link.label}>{link.label}</span>
          ))}
        </nav>
      ) : null}
      <div
        className={
          isCenteredLayout ? 'col-start-3 justify-self-end' : 'flex gap-2'
        }
      >
        {showSearch ? (
          <button
            aria-disabled="true"
            className={`${searchStyleClasses[searchStyle]} ${searchRadiusClasses[searchRadius]}`}
            data-search-radius={searchRadius}
            data-search-style={searchStyle}
            disabled
            type="button"
          >
            Search
          </button>
        ) : null}
        {showCart ? <InertHeaderAction>Cart</InertHeaderAction> : null}
        {showMenu ? <InertHeaderAction>Menu</InertHeaderAction> : null}
        {ctaButton?.show ? (
          <InertHeaderAction>{ctaButton.text}</InertHeaderAction>
        ) : null}
      </div>
    </header>
  );
}
