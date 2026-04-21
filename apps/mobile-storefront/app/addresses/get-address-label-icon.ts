import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export function getAddressLabelIcon(label?: string): IoniconsName {
  switch (label?.trim().toLowerCase()) {
    case 'home':
      return 'home-outline';
    case 'office':
    case 'work':
      return 'briefcase-outline';
    default:
      return 'business-outline';
  }
}
