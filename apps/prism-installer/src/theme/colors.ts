// Color tokens matching the Windows and macOS installer mockups

export const WIN = {
  dark: "#0F172A",
  mid: "#1E293B",
  surface: "#263348",
  border: "#334155",
  muted: "#64748B",
  light: "#94A3B8",
  white: "#F1F5F9",
  titleBg: "#0A1120",
  logBg: "#060D1A",
  // Spectral / accent
  blue: "#4A9EFF",
  teal: "#2DD4BF",
  green: "#4ADE80",
  amber: "#FBB040",
  red: "#F87171",
} as const;

export const MAC = {
  bg: "rgba(28, 28, 30, 0.96)",
  panel: "rgba(44, 44, 46, 0.9)",
  surface: "rgba(58, 58, 60, 0.8)",
  border: "rgba(255,255,255,0.1)",
  borderLight: "rgba(255,255,255,0.06)",
  muted: "rgba(255,255,255,0.4)",
  light: "rgba(255,255,255,0.7)",
  white: "rgba(255,255,255,0.92)",
  sidebarBg: "rgba(36,36,38,0.98)",
  // Spectral / accent — same hues, slightly adjusted for macOS vibrancy
  blue: "#4A9EFF",
  teal: "#2DD4BF",
  green: "#32D74B",
  amber: "#FF9F0A",
  red: "#FF453A",
  yellow: "#FFD60A",
} as const;

export type WinColors = typeof WIN;
export type MacColors = typeof MAC;
