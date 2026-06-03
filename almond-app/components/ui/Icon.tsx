import {
  Coffee,
  CupSoda,
  Leaf,
  Candy,
  Croissant,
  CakeSlice,
  Utensils,
  Plus,
  MapPin,
  Navigation,
  Home,
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
  Bell,
  Gift,
  Wallet,
  User,
  Star,
  Ticket,
  CreditCard,
  Globe,
  CircleHelp,
  LogOut,
  Phone,
  Mail,
  RotateCw,
  Search,
  Sparkles,
  Coins,
  Banknote,
  Smartphone,
  Camera,
  X,
  Trash2,
  Footprints,
  Bike,
  QrCode,
  History,
  Menu as MenuBars,
  Heart,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '@/constants/theme';

/**
 * Unified icon set (Revision Pack §M): one consistent line-icon family
 * (lucide) for products, categories, and UI — no mixed colored/grey emoji.
 */
export type IconName =
  // products / categories
  | 'coffee'
  | 'cold'
  | 'matcha'
  | 'chocolate'
  | 'pastries'
  | 'cake'
  | 'brunch'
  | 'addons'
  // navigation / ui
  | 'home'
  | 'menu'
  | 'cart'
  | 'track'
  | 'profile'
  | 'map-pin'
  | 'navigation'
  | 'bell'
  | 'gift'
  | 'wallet'
  | 'user'
  | 'star'
  | 'ticket'
  | 'card'
  | 'globe'
  | 'help'
  | 'logout'
  | 'phone'
  | 'mail'
  | 'instagram'
  | 'reorder'
  | 'search'
  | 'sparkles'
  | 'coins'
  | 'cash'
  | 'cliq'
  | 'plus'
  | 'close'
  | 'trash'
  | 'pickup'
  | 'delivery'
  | 'qr'
  | 'history'
  | 'more'
  | 'heart';

const REGISTRY: Record<IconName, LucideIcon> = {
  coffee: Coffee,
  cold: CupSoda,
  matcha: Leaf,
  chocolate: Candy,
  pastries: Croissant,
  cake: CakeSlice,
  brunch: Utensils,
  addons: Plus,
  home: Home,
  menu: ClipboardList,
  cart: ShoppingCart,
  track: MapPin,
  profile: User,
  'map-pin': MapPin,
  navigation: Navigation,
  bell: Bell,
  gift: Gift,
  wallet: Wallet,
  user: User,
  star: Star,
  ticket: Ticket,
  card: CreditCard,
  globe: Globe,
  help: CircleHelp,
  logout: LogOut,
  phone: Phone,
  mail: Mail,
  instagram: Camera,
  reorder: RotateCw,
  search: Search,
  sparkles: Sparkles,
  coins: Coins,
  cash: Banknote,
  cliq: Smartphone,
  plus: Plus,
  close: X,
  trash: Trash2,
  pickup: Footprints,
  delivery: Bike,
  qr: QrCode,
  history: History,
  more: MenuBars,
  heart: Heart,
};

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = colors.dark, strokeWidth = 2 }: Props) {
  const Cmp = REGISTRY[name] ?? Coffee;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
