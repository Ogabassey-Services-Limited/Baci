# UI/UX Discrepancies - Web vs Mobile

**Generated:** January 31, 2026
**Purpose:** Platform consistency alignment for specialized sub-agent

---

## Color System

### Primary Colors
| Element | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Primary brand color | `#3730A3` (indigo) | `#DC2626` (red) | Align to single brand color |
| Primary button background | `bg-indigo-600` | `bg-red-600` | Use consistent primary |
| Link color | `text-indigo-600` | `text-red-600` | Match primary |

**Files affected:**
- Web: `apps/web/src/components/storefront/ogabassey/` (multiple components)
- Mobile: `apps/mobile-storefront/constants/Colors.ts`

---

## Typography

### Font Families
| Context | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Body text | `font-sans` (system sans-serif) | Serif font stack | Align to sans-serif for modern look |
| Headings | Sans-serif | Mixed serif/sans | Consistent heading font |

**Files affected:**
- Mobile: `apps/mobile-storefront/app/_layout.tsx` (font loading)
- Web: `apps/web/tailwind.config.ts`

---

## Spacing & Layout

### Card Components
| Property | Web | Mobile | Recommendation |
|----------|-----|--------|----------------|
| Border radius | `16px` / `rounded-2xl` | `12px` | Align to 12px for mobile-first |
| Padding | `12-16px` | `8px` | Use 12px consistently |
| Shadow | `shadow-md` | Minimal shadow | Consistent elevation system |

**Files affected:**
- Web: `apps/web/src/components/storefront/product-card.tsx`
- Mobile: `apps/mobile-storefront/components/storefront/ProductCard.tsx`

### Grid Spacing
| Context | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Product grid gap | `gap-4` (16px) | `gap-2` (8px) | Use 12px as middle ground |
| Section padding | `py-8` | `py-4` | Proportional to screen size |

---

## Number Formatting

### Currency Display
| Format | Web | Mobile | Recommendation |
|--------|-----|--------|----------------|
| Decimal places | 2 decimals (`₦1,000.00`) | No decimals (`₦1,000`) | Use 0 decimals for NGN (no kobo in practice) |
| Thousands separator | Comma | Comma | Already aligned |

**Files affected:**
- Web: `apps/web/src/lib/utils.ts` (formatCurrency)
- Mobile: `apps/mobile-storefront/lib/utils.ts` (formatCurrency)

---

## Component Patterns

### Empty States
| Component | Web | Mobile | Status |
|-----------|-----|--------|--------|
| Cart empty | Custom illustration | Icon + text | Needs alignment |
| Orders empty | Custom illustration | Icon + text | Needs alignment |
| Saved items | N/A | Icon + text | Mobile-only feature |

### Loading States
| Pattern | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Skeleton loaders | `animate-pulse` | `Skeleton` component | Already similar |
| Spinner style | Tailwind spinner | ActivityIndicator | Platform-native OK |

### Error States
| Pattern | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Toast position | Top-right | Bottom | Align to bottom for thumb reach |
| Error color | `red-500` | `red-600` | Use `red-600` consistently |

---

## Interactive Elements

### Buttons
| Property | Web | Mobile | Recommendation |
|----------|-----|--------|----------------|
| Height | `h-10` (40px) | `h-12` (48px) | 48px for touch targets |
| Border radius | `rounded-lg` (8px) | `rounded-xl` (12px) | 12px for softer look |
| Disabled opacity | `opacity-50` | `opacity-60` | Use 0.5 consistently |

### Input Fields
| Property | Web | Mobile | Recommendation |
|----------|-----|--------|----------------|
| Height | `h-10` | `h-12` | 48px for touch |
| Border color | `border-gray-300` | `border-gray-200` | Use gray-300 |
| Focus ring | `ring-indigo-500` | `ring-red-500` | Match primary color |

---

## Navigation

### Header/Navbar
| Element | Web | Mobile | Recommendation |
|---------|-----|--------|----------------|
| Height | 64px | 56px | Platform-specific OK |
| Cart badge | Top-right of icon | Top-right of icon | Already aligned |
| Search placement | Center | Separate screen | Platform-specific OK |

### Tab Bar (Mobile Only)
| Property | Current | Recommendation |
|----------|---------|----------------|
| Icons | Ionicons | Keep consistent |
| Active color | Primary (red) | Should match brand |
| Badge style | Red dot | Keep consistent |

---

## Images

### Product Images
| Property | Web | Mobile | Recommendation |
|----------|-----|--------|----------------|
| Aspect ratio | `aspect-square` | `aspect-[4/3]` | Use square for consistency |
| Object fit | `object-cover` | `resizeMode="cover"` | Already aligned |
| Placeholder | Gray skeleton | Gray skeleton | Already aligned |

---

## Animations

### Transitions
| Type | Web | Mobile | Recommendation |
|------|-----|--------|----------------|
| Page transitions | None | Slide | Platform-specific OK |
| Button press | `transition-colors` | Scale down | Platform-specific OK |
| List item | Fade in | None | Add subtle fade on mobile |

---

## Priority Matrix

### High Priority (User-Facing Inconsistency)
1. **Primary color mismatch** - Brand identity issue
2. **Currency decimal display** - Confusing for users
3. **Button styling** - Touch target sizes

### Medium Priority (Polish)
4. **Card styling** - Radius and padding
5. **Empty states** - Visual consistency
6. **Font system** - Typography alignment

### Low Priority (Minor)
7. **Grid spacing** - Proportional differences OK
8. **Shadow styles** - Platform conventions differ
9. **Animation patterns** - Platform-native OK

---

## Implementation Notes

### Shared Constants Approach
Consider creating a shared design tokens file:
```typescript
// packages/design-tokens/colors.ts
export const colors = {
  primary: '#3730A3', // or chosen brand color
  primaryLight: '#4F46E5',
  primaryDark: '#312E81',
  // ...
};
```

### Platform-Specific Overrides
Some differences are intentional for platform conventions:
- iOS uses native navigation patterns
- Web has hover states, mobile has press states
- Mobile needs larger touch targets

---

## Related Files
- [Bug Checklist](./BUGLIST.md) - Functional bugs to fix

---

*Last updated: January 31, 2026*
