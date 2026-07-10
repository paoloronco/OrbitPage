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
