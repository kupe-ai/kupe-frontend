/** Kupe brand tokens — single source of truth. CSS variables in index.css mirror these. */

export const kupe = {
  black: "#0E0E0E",
  white: "#FFFFFF",
  offWhite: "#F3F3F3",
  secondaryBg: "#FAFAFA",
  darkBg: "#0E0E0E",
  darkAlt: "#161616",
  darkWell: "#1C1C1C",

  card: "#FFFFFF",
  cardSecondary: "#F3F3F3",
  border: "#F6F6F6",
  radius: 14,
  radiusLarge: 20,
  shadow: "0 1px 2px rgb(14 14 14 / 0.06)",

  text: {
    primary: "#0E0E0E",
    secondary: "#3D3D3D",
    muted: "#737373",
    onDark: "#FAFAFA",
  },

  hero: {
    pale: "#A8ABFF",
    mid: "#7077FB",
    primary: "#4048FF",
    deep: "#010799",
    glow: "#A8ABFF",
    wash: "#E8EAFF",
  },

  warm: {
    orange: "#F86C1E",
    coral: "#F96B44",
    warmCoral: "#F97F79",
    salmon: "#F897AB",
    pink: "#FAACDB",
    peach: "#F5D2B2",
    amber: "#F1B06A",
  },

  /** Hero fills use the brand PNG, not CSS color stops. */
  assets: {
    heroGradient: "/brand/hero-gradient.png",
    logoLight: "/brand/kupe-light.png",
    logoDark: "/brand/kupe-dark.png",
    logoMark: "/brand/kupe-mark.png",
  },
} as const;

export type KupeTheme = typeof kupe;
