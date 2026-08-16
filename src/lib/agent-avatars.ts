/** Human portrait avatars in `public/avatar`. Picked stably from a seed. */
export const AGENT_AVATAR_IDS = [
  "5",
  "6",
  "7",
  "10",
  "11",
  "15",
  "18",
  "24",
  "39",
  "40",
  "41",
  "43",
  "45",
  "46",
  "47",
  "67",
  "82",
  "86",
  "87",
  "88",
  "103",
  "107",
  "108",
  "112",
] as const;

export function avatarSrcForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const id = AGENT_AVATAR_IDS[hash % AGENT_AVATAR_IDS.length];
  return `/avatar/${id}.png`;
}
