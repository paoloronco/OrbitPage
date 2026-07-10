type SaveResult = {
  saved: boolean;
  isDirty: boolean;
  error: string;
};

const getSaveErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : 'Changes could not be saved. Try again.';

export async function commitWorkingLinks<T>({
  isDirty,
  links,
  onSave,
}: {
  isDirty: boolean;
  links: T[];
  onSave: (links: T[]) => void | Promise<void>;
}): Promise<SaveResult> {
  if (!isDirty) {
    return { saved: false, isDirty: false, error: '' };
  }

  try {
    await onSave(links);
    return { saved: true, isDirty: false, error: '' };
  } catch (error) {
    return {
      saved: false,
      isDirty: true,
      error: getSaveErrorMessage(error),
    };
  }
}
