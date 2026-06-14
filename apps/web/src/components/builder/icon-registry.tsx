/**
 * Icon Registry for Puck Builder
 *
 * This registry maps icon names to Lucide React icons, enabling merchants
 * to select icons by name in the visual builder interface.
 */
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Award,
  BadgeCheck,
  Banknote,
  Bike,
  Bluetooth,
  Box,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  // Payment & Money
  CreditCard,
  Crown,
  DollarSign,
  Droplet,
  // Sports & Fitness
  Dumbbell,
  Eye,
  Footprints,
  // Electronics & Gaming (New)
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  Globe,
  // Customer Service
  Headphones,
  // Health & Beauty
  Heart,
  HelpCircle,
  // Home & Living
  Home,
  // General Purpose
  Info,
  Lamp,
  Laptop,
  // Eco & Sustainability
  Leaf,
  Lock,
  // Type for LucideIcon
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  Music,
  Package,
  // Art & Creativity
  Palette,
  PenTool,
  Percent,
  Phone,
  Plus,
  Printer,
  Recycle,
  // Refresh & Returns
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  // Security & Trust
  Shield,
  ShieldCheck,
  // Fashion
  Shirt,
  // Shopping & Commerce
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Sofa,
  Sparkles,
  // Quality & Premium
  Star,
  Store,
  Sun,
  Tag,
  Tags,
  ThumbsUp,
  Timer,
  TreePine,
  Trophy,
  // Shipping & Delivery
  Truck,
  Undo,
  Users,
  UtensilsCrossed,
  Verified,
  Wallet,
  Watch,
  Wifi,
  X,
  // Technology
  Zap,
} from 'lucide-react';
import type React from 'react';

/**
 * Registry of all available icons for the builder
 */
const iconRegistry: Record<string, LucideIcon> = {
  // Shipping & Delivery
  truck: Truck,
  package: Package,
  'map-pin': MapPin,
  clock: Clock,
  timer: Timer,
  calendar: Calendar,

  // Security & Trust
  shield: Shield,
  'shield-check': ShieldCheck,
  lock: Lock,
  'check-circle': CheckCircle,
  'check-circle-2': CheckCircle2,
  verified: Verified,

  // Customer Service
  headphones: Headphones,
  'message-circle': MessageCircle,
  phone: Phone,
  mail: Mail,
  'help-circle': HelpCircle,
  users: Users,

  // Quality & Premium
  star: Star,
  award: Award,
  crown: Crown,
  gem: Gem,
  'badge-check': BadgeCheck,
  'thumbs-up': ThumbsUp,

  // Eco & Sustainability
  leaf: Leaf,
  recycle: Recycle,
  'tree-pine': TreePine,
  sparkles: Sparkles,

  // Payment & Money
  'credit-card': CreditCard,
  'dollar-sign': DollarSign,
  percent: Percent,
  gift: Gift,
  wallet: Wallet,
  banknote: Banknote,

  // Technology
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  monitor: Monitor,
  laptop: Laptop,
  bluetooth: Bluetooth,

  // Shopping & Commerce
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  store: Store,
  tag: Tag,
  tags: Tags,
  box: Box,

  // Refresh & Returns
  'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw,
  'arrow-left-right': ArrowLeftRight,
  undo: Undo,

  // Health & Beauty
  heart: Heart,
  smile: Smile,
  sun: Sun,
  moon: Moon,
  droplet: Droplet,

  // Home & Living
  home: Home,
  sofa: Sofa,
  lamp: Lamp,
  coffee: Coffee,
  'utensils-crossed': UtensilsCrossed,

  // Fashion
  shirt: Shirt,
  glasses: Glasses,
  watch: Watch,
  footprints: Footprints,

  // Sports & Fitness
  dumbbell: Dumbbell,
  bike: Bike,
  trophy: Trophy,

  // Art & Creativity
  palette: Palette,
  'pen-tool': PenTool,
  camera: Camera,
  music: Music,

  // Electronics & Gaming
  gamepad: Gamepad2,
  printer: Printer,

  // General Purpose
  info: Info,
  'alert-circle': AlertCircle,
  eye: Eye,
  search: Search,
  settings: Settings,
  globe: Globe,
  'arrow-right': ArrowRight,
  'chevron-right': ChevronRight,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
};

/**
 * Get all icon names as options for Puck select field
 */
export function getIconOptions() {
  return Object.keys(iconRegistry).map((name) => ({
    label: name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    value: name,
  }));
}

/**
 * Render an icon by name
 */
export function renderIcon(
  name: string,
  props?: React.ComponentProps<LucideIcon>
) {
  const IconComponent = iconRegistry[name];
  if (!IconComponent) {
    // Fallback to a default icon if the name is not found
    return <Star {...props} />;
  }
  return <IconComponent {...props} />;
}
