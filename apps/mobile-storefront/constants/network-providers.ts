import type { ImageSourcePropType } from 'react-native';
import airtelImage from '@/assets/images/airtel.png';
import gloImage from '@/assets/images/glo.jpg';
import mtnImage from '@/assets/images/mtn.jpeg';
import t2Image from '@/assets/images/t2.png';

export interface NetworkProvider {
  color: string;
  id: string;
  image: ImageSourcePropType;
  name: string;
}

export const NETWORK_PROVIDERS = [
  { id: 'mtn', name: 'MTN', color: '#FFCC00', image: mtnImage },
  { id: 'airtel', name: 'Airtel', color: '#FF0000', image: airtelImage },
  { id: 'glo', name: 'Glo', color: '#00FF00', image: gloImage },
  { id: 't2', name: 'T2 (9mobile)', color: '#006400', image: t2Image },
] as const satisfies readonly NetworkProvider[];
