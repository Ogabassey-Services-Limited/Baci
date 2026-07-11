import { RepairsCatalogScreen } from '@/components/repairs/RepairsCatalogScreen';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';

/**
 * Repairs route: device-first catalogue + booking flow (`RepairsCatalogScreen`
 * owns the catalogue → device detail → booking form → ticket-success steps and
 * its own `Stack.Screen` header/back handling). When the merchant's repairs
 * catalogue is unavailable it degrades to the WhatsApp-only "Repair Lab"
 * fallback, preserving today's behaviour. Reached from the drawer, the home
 * service card, and the chat "Repair quote" chip.
 */
export default function RepairsScreen() {
  return (
    <StorefrontScreenShell edges={['bottom', 'left', 'right']} themeBackground>
      <RepairsCatalogScreen />
    </StorefrontScreenShell>
  );
}
