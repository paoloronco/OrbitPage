import type { ThemeConfig } from '@/lib/theme';

type CardSurface = ThemeConfig['contentCard'];

export interface CardThemePreset {
  id: string;
  name: string;
  description: string;
  mood: string;
  mode: 'mono' | 'multi';
  card: CardSurface;
  variants: CardSurface[];
}

const surface = (background: string, backgroundSecondary: string, foreground: string, muted: string, border: string, accent: string, accentForeground: string, direction = '145deg'): CardSurface => ({
  background, backgroundSecondary, foreground, muted, border, accent, accentForeground, direction,
});
const mono = (id: string, name: string, description: string, mood: string, card: CardSurface): CardThemePreset => ({ id, name, description, mood, mode: 'mono', card, variants: [card] });
const multi = (id: string, name: string, description: string, mood: string, variants: CardSurface[]): CardThemePreset => ({ id, name, description, mood, mode: 'multi', card: variants[0], variants });

export const cardThemePresets: CardThemePreset[] = [
  mono('ink-signal', 'Mono · Ink Signal', 'Dark editorial cards with a sharp blue signal.', 'Editorial', surface('#111827', '#1f2937', '#f9fafb', '#cbd5e1', '#334155', '#3b82f6', '#ffffff')),
  mono('porcelain', 'Mono · Porcelain', 'Quiet warm cards with precise black typography.', 'Minimal', surface('#fffdf7', '#f4efe3', '#171717', '#57534e', '#d6d3d1', '#171717', '#ffffff')),
  mono('ocean-ledger', 'Mono · Ocean Ledger', 'Deep blue surfaces with cool cyan actions.', 'Professional', surface('#0b2545', '#133c67', '#f0f9ff', '#bae6fd', '#2b5d87', '#38bdf8', '#082f49')),
  mono('moss-paper', 'Mono · Moss Paper', 'Natural green cards with soft paper contrast.', 'Organic', surface('#e7eadf', '#d7ddc8', '#26351f', '#526149', '#aab89b', '#395b2c', '#ffffff')),
  mono('mono-redline', 'Mono · Redline', 'Neutral monochrome cards with a disciplined red accent.', 'Graphic', surface('#f5f5f4', '#e7e5e4', '#1c1917', '#57534e', '#a8a29e', '#dc2626', '#ffffff')),
  mono('highlighter', 'Mono · Highlighter', 'Bold yellow cards built for direct calls to action.', 'Energetic', surface('#fde047', '#facc15', '#1c1917', '#44403c', '#ca8a04', '#1c1917', '#ffffff')),
  multi('sunset-stack', 'Multi · Sunset Stack', 'Warm cards alternate through coral, amber and wine.', 'Warm', [
    surface('#fb7185', '#e11d48', '#fff7ed', '#ffe4e6', '#be123c', '#fff7ed', '#9f1239'),
    surface('#f59e0b', '#ea580c', '#1c1917', '#422006', '#c2410c', '#1c1917', '#ffffff'),
    surface('#fff7ed', '#fed7aa', '#7c2d12', '#9a3412', '#fb923c', '#c2410c', '#ffffff'),
    surface('#881337', '#4c0519', '#fff1f2', '#fecdd3', '#be123c', '#fb7185', '#4c0519'),
  ]),
  multi('coastal-sequence', 'Multi · Coastal Sequence', 'A calm sequence of navy, teal, sky and mist.', 'Calm', [
    surface('#0f172a', '#164e63', '#f0fdfa', '#a5f3fc', '#155e75', '#22d3ee', '#083344'),
    surface('#0f766e', '#14b8a6', '#f0fdfa', '#ccfbf1', '#2dd4bf', '#f0fdfa', '#115e59'),
    surface('#7dd3fc', '#38bdf8', '#082f49', '#0c4a6e', '#0284c7', '#082f49', '#ffffff'),
    surface('#f0fdfa', '#cffafe', '#134e4a', '#0f766e', '#5eead4', '#0f766e', '#ffffff'),
  ]),
  multi('studio-pop', 'Multi · Studio Pop', 'Primary colors rotate like a graphic poster system.', 'Playful', [
    surface('#2563eb', '#1d4ed8', '#eff6ff', '#dbeafe', '#60a5fa', '#facc15', '#172554'),
    surface('#dc2626', '#991b1b', '#fff7ed', '#fee2e2', '#f87171', '#facc15', '#450a0a'),
    surface('#facc15', '#eab308', '#1c1917', '#44403c', '#ca8a04', '#2563eb', '#ffffff'),
    surface('#fff7ed', '#ffedd5', '#1e3a8a', '#475569', '#fdba74', '#dc2626', '#ffffff'),
  ]),
  multi('garden-notes', 'Multi · Garden Notes', 'Forest, sage and clay tones create an organic rhythm.', 'Natural', [
    surface('#14532d', '#166534', '#f0fdf4', '#bbf7d0', '#22c55e', '#fbbf24', '#422006'),
    surface('#84a98c', '#52796f', '#081c15', '#1b4332', '#354f52', '#081c15', '#ffffff'),
    surface('#ecfccb', '#d9f99d', '#365314', '#4d7c0f', '#bef264', '#3f6212', '#ffffff'),
    surface('#c2410c', '#9a3412', '#fff7ed', '#fed7aa', '#fb923c', '#ffedd5', '#7c2d12'),
  ]),
  multi('night-market', 'Multi · Night Market', 'Dark saturated cards shift through neon city colors.', 'Nightlife', [
    surface('#18181b', '#27272a', '#fafafa', '#d4d4d8', '#52525b', '#22d3ee', '#083344'),
    surface('#4c0519', '#881337', '#fff1f2', '#fecdd3', '#be123c', '#fb7185', '#4c0519'),
    surface('#3b0764', '#6b21a8', '#faf5ff', '#e9d5ff', '#9333ea', '#d8b4fe', '#3b0764'),
    surface('#78350f', '#b45309', '#fffbeb', '#fde68a', '#d97706', '#facc15', '#422006'),
  ]),
  multi('pastel-relay', 'Multi · Pastel Relay', 'Soft lilac, peach, mint and sky cards rotate gently.', 'Soft', [
    surface('#ede9fe', '#ddd6fe', '#4c1d95', '#6d28d9', '#c4b5fd', '#7c3aed', '#ffffff'),
    surface('#ffedd5', '#fed7aa', '#7c2d12', '#9a3412', '#fdba74', '#ea580c', '#ffffff'),
    surface('#d1fae5', '#a7f3d0', '#064e3b', '#047857', '#6ee7b7', '#059669', '#ffffff'),
    surface('#e0f2fe', '#bae6fd', '#0c4a6e', '#0369a1', '#7dd3fc', '#0284c7', '#ffffff'),
  ]),
];
