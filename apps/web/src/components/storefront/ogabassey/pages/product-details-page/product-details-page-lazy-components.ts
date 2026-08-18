import dynamic from 'next/dynamic';

export const AdUnit = dynamic(
  () => import('../../components/AdUnit').then((mod) => mod.AdUnit),
  { loading: () => null, ssr: false }
);

export const BannerCarousel = dynamic(
  () =>
    import('../../components/BannerCarousel').then((mod) => mod.BannerCarousel),
  { loading: () => null, ssr: false }
);

export const NegotiationModal = dynamic(
  () =>
    import('../../components/NegotiationModal').then((mod) => mod.NegotiationModal),
  { loading: () => null, ssr: false }
);

export const FlyToCartAnimation = dynamic(
  () =>
    import('../../components/FlyToCartAnimation').then(
      (mod) => mod.FlyToCartAnimation
    ),
  { loading: () => null, ssr: false }
);

export const SelectionRequiredModal = dynamic(
  () =>
    import('./selection-required-modal').then((mod) => mod.SelectionRequiredModal),
  { loading: () => null, ssr: false }
);
