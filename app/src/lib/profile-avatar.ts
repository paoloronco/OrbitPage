export function isBundledProfileAvatar(value?: unknown) {
  if (typeof value !== "string" || !value) return false;
  if (/^data:image\//i.test(value)) return true;
  try {
    const pathname = new URL(value, "https://orbitpage.invalid").pathname;
    return pathname === "/src/assets/profile-avatar.jpg" ||
      /\/(?:orbitpage-runtime\/)?assets\/profile-avatar(?:-[a-z\d_-]+)?\.jpg$/i.test(pathname);
  } catch {
    return false;
  }
}

export function persistedProfileAvatar(value?: unknown) {
  return typeof value === "string" && value && !/^blob:/i.test(value) && !isBundledProfileAvatar(value) ? value : "";
}
