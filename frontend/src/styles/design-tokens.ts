export const colors = {
  primary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  secondary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  success: { 500: '#22c55e', 600: '#16a34a' },
  danger: { 500: '#ef4444', 600: '#dc2626' },
  warning: { 500: '#f59e0b', 600: '#d97706' },
  surface: {
    bg: '#f8fafc',
    card: '#ffffff',
    muted: '#f1f5f9',
    border: '#e2e8f0',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
    inverse: '#ffffff',
  },
} as const;

export const spacing = {
  page: 'p-4 sm:p-6',
  card: 'p-4 sm:p-6',
  gap: 'gap-4',
  section: 'space-y-6',
} as const;

export const radius = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
} as const;

export const shadows = {
  card: 'shadow-md',
  elevated: 'shadow-lg',
  modal: 'shadow-xl',
} as const;

export const typography = {
  display: 'text-3xl sm:text-4xl font-extrabold tracking-tight',
  h1: 'text-2xl sm:text-3xl font-bold',
  h2: 'text-xl sm:text-2xl font-semibold',
  h3: 'text-lg sm:text-xl font-semibold',
  body: 'text-base text-gray-700',
  small: 'text-sm text-gray-500',
  tiny: 'text-xs text-gray-400',
} as const;
