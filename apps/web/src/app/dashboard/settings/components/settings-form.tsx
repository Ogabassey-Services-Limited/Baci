'use client';

import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import {
  SettingsFormContents,
  type SettingsFormProps,
} from './settings-form-contents';

extend([a11yPlugin]);

export function SettingsForm({
  initialMerchant,
  initialBlogEnabled,
}: SettingsFormProps) {
  return (
    <SettingsFormContents
      key={initialMerchant.id}
      initialMerchant={initialMerchant}
      initialBlogEnabled={initialBlogEnabled}
    />
  );
}
