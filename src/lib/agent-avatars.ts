/** Coded robot-head avatars. Each seed maps to a stable gradient. */

export const AGENT_AVATAR_GRADIENTS = [
  { from: "#86efac", to: "#166534" },
  { from: "#f9a8d4", to: "#9d174d" },
  { from: "#fdba74", to: "#c2410c" },
  { from: "#fca5a5", to: "#b91c1c" },
  { from: "#93c5fd", to: "#1d4ed8" },
  { from: "#d8b4fe", to: "#6b21a8" },
  { from: "#5eead4", to: "#0f766e" },
  { from: "#fde68a", to: "#a16207" },
  { from: "#a5b4fc", to: "#3730a3" },
  { from: "#67e8f9", to: "#0e7490" },
  { from: "#f0abfc", to: "#a21caf" },
  { from: "#bbf7d0", to: "#047857" },
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
