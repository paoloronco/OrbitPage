import type { ThemeConfig } from "@/lib/theme";

export interface CardThemePreset {
  id: string;
  name: string;
  description: string;
  mood: string;
  card: ThemeConfig["contentCard"];
}

const card = (
  id: string,
  name: string,
  description: string,
  mood: string,
  colors: Omit<ThemeConfig["contentCard"], "direction"> & { direction?: string },
): CardThemePreset => ({
  id,
  name,
  description,
  mood,
  card: { direction: "145deg", ...colors },
});

export const cardThemePresets: CardThemePreset[] = [
  card("ink-signal", "Ink Signal", "Near-black cards with crisp type and an electric blue action.", "Dark / precise", {
    background: "#111827", backgroundSecondary: "#1f2937", foreground: "#f8fafc", muted: "#aebbd0", border: "#334155", accent: "#3b82f6", accentForeground: "#f8fafc",
  }),
  card("porcelain", "Porcelain", "Clean warm-white surfaces with navy type and a confident cobalt CTA.", "Light / clean", {
    background: "#fffdf8", backgroundSecondary: "#f4efe5", foreground: "#172033", muted: "#667085", border: "#d9d1c4", accent: "#155eef", accentForeground: "#f8fafc",
  }),
  card("citrus-press", "Citrus Press", "Graphic cream cards, dark ink and a punchy citrus action color.", "Editorial / bold", {
    background: "#fff7d6", backgroundSecondary: "#f4e7ae", foreground: "#26251e", muted: "#6f694d", border: "#d4c36e", accent: "#d64f18", accentForeground: "#fffaf0", direction: "90deg",
  }),
  card("ocean-ledger", "Ocean Ledger", "Deep teal surfaces with airy labels and a bright aqua signal.", "Coastal / premium", {
    background: "#0d3440", backgroundSecondary: "#164d58", foreground: "#effcfa", muted: "#abd3d0", border: "#2d6870", accent: "#5eead4", accentForeground: "#10343a",
  }),
  card("cherry-club", "Cherry Club", "Burgundy depth, soft rose type and a high-energy cherry CTA.", "Social / dramatic", {
    background: "#321521", backgroundSecondary: "#4a1d2c", foreground: "#fff1f4", muted: "#d7a9b5", border: "#71364a", accent: "#ff5b78", accentForeground: "#2b111a",
  }),
  card("moss-paper", "Moss Paper", "Natural paper tones with forest text and an earthy olive action.", "Organic / calm", {
    background: "#eef0df", backgroundSecondary: "#dfe4c8", foreground: "#253127", muted: "#63705f", border: "#b9c29f", accent: "#4f6f52", accentForeground: "#f7faef",
  }),
  card("cobalt-poster", "Cobalt Poster", "Poster-blue cards with warm white text and a decisive red button.", "Graphic / direct", {
    background: "#173f9f", backgroundSecondary: "#2456bd", foreground: "#fff8e8", muted: "#cfdbff", border: "#7e9be7", accent: "#f05a3f", accentForeground: "#fffaf4", direction: "90deg",
  }),
  card("mono-redline", "Mono Redline", "Quiet monochrome cards sharpened by one precise red action.", "Minimal / exact", {
    background: "#f6f6f2", backgroundSecondary: "#e9e9e3", foreground: "#20201e", muted: "#686864", border: "#c8c8c1", accent: "#d83232", accentForeground: "#fff8f5",
  }),
  card("violet-studio", "Violet Studio", "Soft lilac surfaces, plum typography and a saturated violet CTA.", "Creative / soft", {
    background: "#f7f0fa", backgroundSecondary: "#eadcf0", foreground: "#38243e", muted: "#79657f", border: "#cfb9d6", accent: "#76529d", accentForeground: "#fff9ff",
  }),
  card("terracotta", "Terracotta", "Sun-baked clay cards with cream lettering and apricot actions.", "Warm / crafted", {
    background: "#59372d", backgroundSecondary: "#71483a", foreground: "#fff3e8", muted: "#dfbdac", border: "#936250", accent: "#f29a6e", accentForeground: "#3a211b",
  }),
  card("highlighter", "Highlighter", "Charcoal cards and acid-lime actions built for maximum visibility.", "Bold / high contrast", {
    background: "#20231d", backgroundSecondary: "#30352a", foreground: "#f5f8ed", muted: "#b7c0aa", border: "#4a5240", accent: "#c8f33d", accentForeground: "#20231d",
  }),
  card("skyline", "Skyline", "Cool mist cards, strong slate type and a clear azure interaction color.", "Fresh / versatile", {
    background: "#eef7fb", backgroundSecondary: "#dceef5", foreground: "#183442", muted: "#607b88", border: "#b3d4df", accent: "#087ea4", accentForeground: "#f5fcff",
  }),
];
