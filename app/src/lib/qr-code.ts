export function buildLockedQrUrl(baseUrl: string, path: string) {
  if (!baseUrl) return { url: "", error: "" };

  const trimmedPath = path.trim();
  if (!trimmedPath) return { url: baseUrl, error: "" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedPath) || trimmedPath.startsWith("//")) {
    return { url: "", error: "Use a relative path only. External domains are blocked." };
  }

  const normalizedPath = trimmedPath.startsWith("?") || trimmedPath.startsWith("#")
    ? trimmedPath
    : trimmedPath.replace(/^\/+/, "").replace(/^\.\//, "");
  if (normalizedPath.split(/[?#]/)[0].split("/").includes("..")) {
    return { url: "", error: "Path cannot contain parent directory segments." };
  }

  try {
    const base = new URL(baseUrl);
    const baseWithDirectory = `${base.toString().replace(/\/$/, "")}/`;
    const url = new URL(normalizedPath, normalizedPath.startsWith("?") || normalizedPath.startsWith("#") ? base : baseWithDirectory);
    if (url.origin !== base.origin) return { url: "", error: "The QR target must stay on your public domain." };
    return { url: url.toString(), error: "" };
  } catch {
    return { url: "", error: "Enter a valid relative path." };
  }
}

const colorLuminance = (hex: string) => {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) || [];
  if (channels.length !== 3 || channels.some(Number.isNaN)) return 0;
  const [red, green, blue] = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const qrContrastRatio = (foreground: string, background: string) => {
  const first = colorLuminance(foreground);
  const second = colorLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};
