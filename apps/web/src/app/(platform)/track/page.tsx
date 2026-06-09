import type { Metadata } from 'next';
import TrackClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Track Your Order - Baci',
  description:
    'Track a Baci shipment by entering the tracking number sent after checkout.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrackPage() {
  return <TrackClientPage />;
}
