// @beecompete/ui — the ONE home for shared UI (architecture §8, design-brief).
//
// RULE (see CLAUDE.md): every shared component/style/icon lives here. Search this
// package before creating anything new. Never inline SVGs or hand-roll styles.
//
// Tokens: import '@beecompete/ui/styles/tokens.css' in the app's Tailwind entry.

export { cn } from './lib/cn';

export { Button, buttonClasses } from './components/button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button';

export { Input, Textarea } from './components/input';
export type { InputProps, TextareaProps } from './components/input';

export { Select } from './components/select';
export type { SelectProps, SelectOption } from './components/select';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card';
export type { CardProps } from './components/card';

export { Badge } from './components/badge';
export type { BadgeProps, BadgeVariant } from './components/badge';

export { Checkbox } from './components/checkbox';
export type { CheckboxProps } from './components/checkbox';

export { RadioGroup, Radio } from './components/radio-group';
export type { RadioGroupProps, RadioProps } from './components/radio-group';

export { Chip } from './components/chip';
export type { ChipProps } from './components/chip';

export { Avatar } from './components/avatar';
export type { AvatarProps, AvatarSize } from './components/avatar';

export { Alert } from './components/alert';
export type { AlertProps, AlertTone } from './components/alert';

export { Skeleton } from './components/skeleton';

export { Spinner } from './components/spinner';
export type { SpinnerProps, SpinnerSize } from './components/spinner';

export { EmptyState } from './components/empty-state';
export type { EmptyStateProps } from './components/empty-state';

export { FormField } from './components/form-field';
export type { FormFieldProps } from './components/form-field';

export { Tabs, TabList, Tab, TabPanel } from './components/tabs';
export type { TabsProps, TabProps, TabPanelProps, TabsVariant } from './components/tabs';

export { Tooltip } from './components/tooltip';
export type { TooltipProps } from './components/tooltip';

export { Modal } from './components/modal';
export type { ModalProps } from './components/modal';

export { ToastProvider, useToast } from './components/toast';
export type { ToastOptions, ToastTone } from './components/toast';

export { Logo } from './components/logo';
export { ThemeToggle } from './components/theme-toggle';

export * from './icons';
