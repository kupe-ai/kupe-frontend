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

  teal: {
    deep: "#007E6D",
    primary: "#009D88",
    hover: "#00CAB5",
    primaryHover: "#007E6D",
    bright: "#00CAB5",
    soft: "#4CAE7D",
    glow: "#6BA3FF",
    pale: "#C8F5EE",
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

  gradients: {
    heroCta: "linear-gradient(100deg, #009D88, #00CAB5)",
    marketingCta: "linear-gradient(100deg, #F86C1E, #F96B44, #FAACDB)",
    dashboard: "linear-gradient(100deg, #007E6D, #009D88, #00CAB5)",
    voice: "linear-gradient(100deg, #007E6D, #009D88, #00CAB5, #5B8DEF, #4CAE7D)",
  },
} as const;

export type KupeTheme = typeof kupe;
