import { Ionicons } from '@expo/vector-icons';

export interface RepairService {
  title: string;
  price: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface RepairWorkflowStep {
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const REPAIR_SERVICES: RepairService[] = [
  {
    title: 'Screen Renewal',
    price: 'From ₦25,000',
    desc: "Cracked or unresponsive display? We'll restore it to factory clarity.",
    icon: 'phone-portrait-outline',
  },
  {
    title: 'Battery Boost',
    price: 'From ₦15,000',
    desc: 'Restore all-day power with a genuine battery replacement.',
    icon: 'battery-half-outline',
  },
  {
    title: 'Port Restoration',
    price: 'From ₦12,000',
    desc: "Charging issues? We'll fix or replace your connector port.",
    icon: 'flash-outline',
  },
  {
    title: 'System Revive',
    price: 'From ₦10,000',
    desc: 'Software optimization, OS updates, and performance tuning.',
    icon: 'settings-outline',
  },
];

export const REPAIR_WORKFLOW_STEPS: RepairWorkflowStep[] = [
  {
    title: 'Book Online',
    desc: 'Tap the button below to chat with us on WhatsApp',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    title: 'Drop Off or Ship',
    desc: 'Bring your device in or schedule a pickup',
    icon: 'cube-outline',
  },
  {
    title: 'Expert Repair',
    desc: 'Certified technicians fix it with genuine parts',
    icon: 'construct-outline',
  },
  {
    title: 'Pick Up',
    desc: 'Get your device back, good as new',
    icon: 'checkmark-done-outline',
  },
];

export function buildRepairWhatsappUrl(
  supportWhatsappPhone: string,
  service?: string
) {
  const serviceText = service ? `\n\nService: ${service}` : '';
  const message = encodeURIComponent(
    `Hello! I'd like to book a device repair.${serviceText}\n\nPlease let me know your available time slots.`
  );

  return `https://wa.me/${supportWhatsappPhone}?text=${message}`;
}
