import { defaultTheme, type ThemeConfig } from "@/lib/theme";
import type { ThemePreset } from "@/lib/theme-presets";
import { cardThemePresets, type CardThemePreset } from "@/lib/card-theme-presets";
import type { EditorThemeAccess } from "@/lib/editor-capabilities";

export type EditableTheme = ThemeConfig & { cardBlurTint?: string };

const sameCardSurface = (left: ThemeConfig['contentCard'], right: ThemeConfig['contentCard']) => (
  Object.keys(left).every((key) => left[key as keyof typeof left] === right[key as keyof typeof right])
);

export const findMatchingCardPreset = (theme: ThemeConfig) => cardThemePresets.find((preset) => (
  preset.mode === theme.contentCardMode &&
  sameCardSurface(preset.card, theme.contentCard) &&
  preset.variants.length === theme.contentCardVariants.length &&
  preset.variants.every((variant, index) => sameCardSurface(variant, theme.contentCardVariants[index]))
))?.id || null;

export const buildPagePresetTheme = (
  pendingTheme: EditableTheme,
  preset: ThemePreset,
  accessLevel?: EditorThemeAccess,
): EditableTheme => {
  const advanced = !accessLevel || accessLevel === "advanced";
  const premium = advanced || accessLevel === "premium";
  const cardPresetId = premium ? findMatchingCardPreset(pendingTheme) : null;
  const preserveCards = advanced || Boolean(cardPresetId);
  return {
    ...preset.theme,
    content: pendingTheme.content,
    contentCard: preserveCards ? pendingTheme.contentCard : preset.theme.contentCard,
    contentCardMode: preserveCards ? pendingTheme.contentCardMode : preset.theme.contentCardMode,
    contentCardVariants: preserveCards ? pendingTheme.contentCardVariants : preset.theme.contentCardVariants,
    profileCardEffect: advanced ? pendingTheme.profileCardEffect : preset.theme.profileCardEffect,
    contentCardEffect: advanced ? pendingTheme.contentCardEffect : preset.theme.contentCardEffect,
    profileCardOpacity: advanced ? pendingTheme.profileCardOpacity : preset.theme.profileCardOpacity,
    contentCardOpacity: advanced ? pendingTheme.contentCardOpacity : preset.theme.contentCardOpacity,
    orbitPageAccess: { mode: "preset", presetId: preset.id, cardPresetId },
  };
};

export const buildCardPresetTheme = (
  pendingTheme: EditableTheme,
  preset: CardThemePreset,
  accessLevel?: EditorThemeAccess,
): EditableTheme => {
  const advanced = !accessLevel || accessLevel === "advanced";
  const baseTheme = advanced || pendingTheme.orbitPageAccess?.mode === "preset"
    ? pendingTheme
    : defaultTheme;
  return {
    ...baseTheme,
    content: pendingTheme.content,
    card: preset.card.background,
    cardGradient: {
      from: preset.card.background,
      to: preset.card.backgroundSecondary,
      direction: preset.card.direction,
    },
    contentCard: preset.card,
    contentCardMode: preset.mode,
    contentCardVariants: preset.variants,
    orbitPageAccess: {
      mode: "preset",
      presetId: baseTheme.orbitPageAccess?.presetId || "default",
      cardPresetId: preset.id,
    },
  };
};

type ThemeSaveResult = {
  saved: boolean;
  isDirty: boolean;
  error: string;
};

const getThemeSaveErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : 'Theme could not be saved. Try again.';

export async function commitPendingTheme<T>({
  isDirty,
  theme,
  onSave,
}: {
  isDirty: boolean;
  theme: T;
  onSave: (theme: T) => void | Promise<void>;
}): Promise<ThemeSaveResult> {
  if (!isDirty) {
    return { saved: false, isDirty: false, error: '' };
  }

  try {
    await onSave(theme);
    return { saved: true, isDirty: false, error: '' };
  } catch (error) {
    return {
      saved: false,
      isDirty: true,
      error: getThemeSaveErrorMessage(error),
    };
  }
}

export function parseImportedTheme<T>(
  source: string,
  normalizeTheme: (raw: Record<string, unknown>) => T,
) {
  const raw = JSON.parse(source) as Record<string, unknown>;
  return {
    theme: normalizeTheme(raw),
    isDirty: true,
    error: '',
  };
}

export function prepareThemeExport<T>(theme: T) {
  return JSON.stringify(theme, null, 2);
}
