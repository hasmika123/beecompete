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

export { Logo } from './components/logo';
export { ThemeToggle } from './components/theme-toggle';

export * from './icons';
