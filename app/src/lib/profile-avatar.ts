export function isBundledProfileAvatar(value?: string | null) {
  if (!value) return false;
  try {
    const pathname = new URL(value, "https://orbitpage.invalid").pathname;
    return pathname === "/src/assets/profile-avatar.jpg" ||
      /\/(?:orbitpage-runtime\/)?assets\/profile-avatar(?:-[a-z\d_-]+)?\.jpg$/i.test(pathname);
  } catch {
    return false;
  }
}

export function persistedProfileAvatar(value?: string | null) {
  return value && !isBundledProfileAvatar(value) ? value : "";
}

