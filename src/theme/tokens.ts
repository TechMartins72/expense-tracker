// Design tokens copied from Stow (stow-app/app/globals.css) so both apps look like one family.
// Light is the main theme. Dark uses Stow's dark palette with brighter muted text and
// slightly larger type for contrast.

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  wordmark: 'Michroma_400Regular',
} as const;

export const radius = { sm: 10, md: 14, lg: 16, card: 20, hero: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

// Stow's type scale (rem x16), mobile factor 0.9 as on Stow's phone layout.
const baseSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48 } as const;
export type TextSize = keyof typeof baseSize;

const light = {
  frame: '#060f21',
  frameRaised: '#0f1c36',
  frameText: '#f0f5fc',
  frameMuted: '#9aa6b8',
  surface: '#f0f5fc',
  surfaceRaised: '#ffffff',
  border: '#dde5f0',
  text: '#122231',
  textMuted: '#3d4f60',
  primary: '#0935d1',
  primaryHover: '#0629a8',
  onPrimary: '#ffffff',
  hero: '#0089ff',
  locked: '#00259b',
  stocks: '#7c4dff',
  income: '#0e9f6e', // Stow --positive
  incomeBg: '#dcf5ea',
  expense: '#e0564b', // soft red
  expenseBg: '#fde8e6',
  warning: '#b54708',
  warningBg: '#fef3c7',
  critical: '#b42318',
  criticalBg: '#fee4e2',
  track: '#e3eaf4',
  scrim: 'rgba(6,15,33,0.45)',
};

export type Palette = typeof light;

const dark: Palette = {
  ...light,
  surface: '#0b1529',
  surfaceRaised: '#13203a',
  border: '#24365a',
  text: '#ffffff',
  textMuted: '#c3cddb',
  primary: '#4d7cff',
  primaryHover: '#6b92ff',
  onPrimary: '#ffffff',
  locked: '#3557d6',
  stocks: '#a68bff',
  income: '#34d399',
  incomeBg: '#0f3a2c',
  expense: '#f87171',
  expenseBg: '#3b1515',
  warning: '#fbbf24',
  warningBg: '#3a2a07',
  critical: '#f87171',
  criticalBg: '#3b1212',
  track: '#1f2e4d',
  scrim: 'rgba(0,0,0,0.6)',
};

export function makeTheme(scheme: 'light' | 'dark') {
  const factor = scheme === 'dark' ? 1.0 : 0.9; // dark: full-size type for legibility
  const size = Object.fromEntries(
    Object.entries(baseSize).map(([k, v]) => [k, Math.round(v * factor)]),
  ) as Record<TextSize, number>;
  return { scheme, colors: scheme === 'dark' ? dark : light, size, fonts, radius, space };
}

export type Theme = ReturnType<typeof makeTheme>;
