/** Kupe brand tokens — single source of truth. CSS variables in index.css mirror these. */

export const kupe = {
  black: "#050305",
  white: "#FEFDFD",
  offWhite: "#F6F4F3",
  secondaryBg: "#F1EEF4",
  darkBg: "#050305",
  darkPurple: "#221735",
  darkAlt: "#110E20",

  card: "#FEFDFD",
  cardSecondary: "#F6F4F3",
  border: "#E1DEED",
  radius: 16,
  radiusLarge: 20,
  shadow: "0 1px 2px rgba(34, 23, 53, 0.04), 0 8px 24px rgba(34, 23, 53, 0.06)",

  text: {
    primary: "#050305",
    secondary: "#38313E",
    muted: "#7B737E",
    onDark: "#F6F4F3",
  },

  purple: {
    deep: "#6D5CB2",
    primary: "#746FD1",
    hover: "#968BF3",
    primaryHover: "#6657B8",
    bright: "#A379F9",
    soft: "#8073D2",
    glow: "#C8B3FA",
    pale: "#E9CBF3",
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
    heroCta: "linear-gradient(100deg, #746FD1, #968BF3)",
    marketingCta: "linear-gradient(100deg, #F86C1E, #F96B44, #FAACDB)",
    dashboard: "linear-gradient(100deg, #6D5CB2, #746FD1, #968BF3)",
    voice: "linear-gradient(100deg, #6D5CB2, #968BF3, #A379F9, #CD93D9, #FAACDB)",
  },

  /** Apple-design skill: critically damped springs, press feedback, materials, type. */
  motion: {
    pressScale: 0.97,
    pressDuration: "100ms",
    uiResponse: "320ms",
    sheetResponse: "380ms",
    easeSpring: "cubic-bezier(0.32, 0.72, 0, 1)",
    easeOut: "ease-out",
  },

  materials: {
    blur: "20px",
    saturate: "180%",
  },

  type: {
    trackingDisplay: "-0.022em",
    trackingTitle: "-0.018em",
    trackingHeadline: "-0.014em",
    trackingBody: "-0.011em",
    trackingCaption: "0.006em",
    leadingDisplay: 1.08,
    leadingTitle: 1.12,
    leadingBody: 1.47,
    leadingCaption: 1.35,
  },
} as const;

export type KupeTheme = typeof kupe;
