const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHORT_HEX_COLOR = /^#[0-9a-f]{3}$/i;

export const isHexColor = (value: string) => HEX_COLOR.test(value);

export const normalizeHexColor = (input: string, fallback: string) => {
  const candidate = input.trim().startsWith("#") ? input.trim() : `#${input.trim()}`;
  if (HEX_COLOR.test(candidate)) return candidate.toLowerCase();
  if (SHORT_HEX_COLOR.test(candidate)) {
    return `#${candidate.slice(1).split("").map((character) => character.repeat(2)).join("")}`.toLowerCase();
  }
  return HEX_COLOR.test(fallback) ? fallback.toLowerCase() : "#000000";
};
