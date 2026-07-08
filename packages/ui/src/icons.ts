/**
 * Icon set — Phosphor (design-brief §3, owner 2026-07-08: richer than plain line
 * icons; weights available per-use: regular · bold · fill · duotone via the `weight`
 * prop). Re-exported through @beecompete/ui so app code never imports an icon library
 * (or inlines SVGs) directly. The `/dist/ssr` entry is context-free, so these work in
 * both server and client components.
 *
 * Curated: add icons here as features need them, keeping usage searchable.
 * Some names are aliased to keep call sites descriptive and stable.
 */
export {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowSquareOut as ExternalLink,
  Bell,
  BookmarkSimple as Bookmark,
  CalendarBlank as Calendar,
  CalendarPlus,
  CaretDown as ChevronDown,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretUp as ChevronUp,
  ChatCircleText as MessageCircle,
  Check,
  CircleNotch as Spinner,
  Clock,
  CurrencyDollar as DollarSign,
  Flag,
  FunnelSimple as Filter,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Link as LinkIcon,
  ListBullets as ListIcon,
  MagnifyingGlass as Search,
  MapPin,
  Medal,
  Moon,
  Question as CircleHelp,
  SealCheck as VerifiedSeal,
  ShareNetwork as Share,
  Sparkle as Sparkles,
  Sun,
  Ticket,
  Trophy,
  User,
  UsersThree as Users,
  WarningCircle as CircleAlert,
  X,
} from '@phosphor-icons/react/dist/ssr';
