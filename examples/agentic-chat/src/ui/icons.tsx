import {
  Activity,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Info,
  type LucideIcon,
  Package,
  Rocket,
  Shield,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

/** The small allow-list of icons the model may render. */
export const ICONS = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'dollar-sign': DollarSign,
  users: Users,
  check: Check,
  info: Info,
  zap: Zap,
  rocket: Rocket,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  clock: Clock,
  calendar: Calendar,
  'arrow-up-right': ArrowUpRight,
  activity: Activity,
  package: Package,
} satisfies Record<string, LucideIcon>;

export const ICON_NAMES = Object.keys(ICONS) as [keyof typeof ICONS, ...(keyof typeof ICONS)[]];

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className ?? 'size-4'} strokeWidth={2} aria-hidden="true" />;
}
