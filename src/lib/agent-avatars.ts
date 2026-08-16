/**
 * Avatar hues, weighted toward Kupe blues / violets.
 * Order of weight: blue, indigo, violet, purple, pink, green, cyan, yellow, then orange.
 */

export const AGENT_AVATAR_GRADIENTS = [
  { from: "#93c5fd", to: "#2563eb" },
  { from: "#60a5fa", to: "#1d4ed8" },
  { from: "#818cf8", to: "#4048ff" },
  { from: "#a5b4fc", to: "#4338ca" },
  { from: "#818cf8", to: "#3730a3" },
  { from: "#6366f1", to: "#312e81" },
  { from: "#c4b5fd", to: "#6d28d9" },
  { from: "#a78bfa", to: "#5b21b6" },
  { from: "#d8b4fe", to: "#7e22ce" },
  { from: "#c084fc", to: "#6b21a8" },
  { from: "#f9a8d4", to: "#db2777" },
  { from: "#faacdb", to: "#c026d3" },
  { from: "#86efac", to: "#16a34a" },
  { from: "#6ee7b7", to: "#059669" },
  { from: "#67e8f9", to: "#0891b2" },
  { from: "#fde68a", to: "#ca8a04" },
  { from: "#fdba74", to: "#ea580c" },
] as const;

export type AgentAvatarGradient = (typeof AGENT_AVATAR_GRADIENTS)[number];

export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarGradientForSeed(seed: string): AgentAvatarGradient {
  return AGENT_AVATAR_GRADIENTS[hashSeed(seed) % AGENT_AVATAR_GRADIENTS.length]!;
}
