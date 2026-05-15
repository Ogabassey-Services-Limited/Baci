# Home Service Cards Design Snapshot

Date: 2026-05-09

This captures the approved mobile home design test where the three service cards sit below the utility bar.

## Stable Below-Utility Layout

- `HomeServiceCards` is rendered after `BlockRenderer` for the `CategoryRail` block in `apps/mobile-storefront/app/(tabs)/index.tsx`.
- Cards are one row: `IMEI Checker`, `Repairs`, `Swap/Trade`.
- Each card uses an outer `View` for width, border, radius, and background.
- Each card uses an inner `Pressable` with `flex: 1`.
- Icon and label sit inside an inner row `View`.
- IMEI icon is `barcode-outline` in `BRAND.primary`.
- Card width is calculated from screen width: `(rowWidth - 16) / 3`.
- Row style: `marginTop: 28`, `marginBottom: -2`.
- Utility panel style: `marginTop: -8`, `marginBottom: 0`, `translateY: 8`.
- Moving outline duration: `6570ms`, a 30% speed reduction from the original `4600ms` runner.

## Restore Below-Utility Placement

In the home screen block map, use this ordering for `CategoryRail`:

```tsx
<BlockRenderer ... />
{isUtilityBlock ? <HomeServiceCards placement="belowUtility" /> : null}
```
