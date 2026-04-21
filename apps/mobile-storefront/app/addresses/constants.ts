import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export const ADDRESS_FALLBACK_LABEL = 'Address';
export const ADDRESS_DEFAULT_BADGE_LABEL = 'Default';
export const ADDRESS_DELETE_PROMPT_TITLE = 'Delete Address';
export const ADDRESS_DELETE_ACTION_LABEL = 'Delete';
export const ADDRESS_EDIT_ACTION_LABEL = 'Edit';
export const ADDRESS_EMPTY_ADD_ACTION_LABEL = 'Add Address';
export const ADDRESS_EMPTY_SUBTITLE = 'Add an address for faster checkout';
export const ADDRESS_EMPTY_TITLE = 'No saved addresses';
export const ADDRESS_MENU_TITLE = 'Address Options';
/** Bottom padding in pixels to keep the address list clear of the FAB and home-indicator area. */
export const ADDRESS_LIST_BOTTOM_PADDING = 80;
export const ADDRESS_MENU_CANCEL_ACTION_LABEL = 'Cancel';
export const ADDRESS_SET_DEFAULT_ACTION_LABEL = 'Set Default';

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
