/**
 * Side-view dog/cat pixel sprites — deterministic species + palette from seed.
 * Frames: stand | sit | sleep | walk0 | walk1. Emotion badges stay in PetAvatarHud.
 */

export type AnimalKind = "dog" | "cat";
export type DogBreed = "corgi" | "shiba" | "dachshund" | "shepherd" | "terrier";
export type BodyFrame = "stand" | "sit" | "sleep" | "walk0" | "walk1";

/** Palette channels painted into grids. */
export type Px = 0 | 1 | 2 | 3 | 4 | null;
// 0 outline, 1 primary, 2 light, 3 accent (ear/nose pink), 4 eye

export type AnimalPalette = {
  outline: string;
  primary: string;
  light: string;
  accent: string;
  eye: string;
};

const PALETTES: AnimalPalette[] = [
  { outline: "#3c2314", primary: "#e68c3c", light: "#f5c88c", accent: "#ffb4aa", eye: "#141414" }, // ginger
  { outline: "#462819", primary: "#dc7832", light: "#f5d2a0", accent: "#ffb4aa", eye: "#141414" }, // shiba
  { outline: "#28190f", primary: "#5a3723", light: "#a06e46", accent: "#c89678", eye: "#0f0f0f" }, // chocolate
  { outline: "#2d1e12", primary: "#b48246", light: "#5f3c23", accent: "#dcb48c", eye: "#141414" }, // shepherd
  { outline: "#463223", primary: "#dcb982", light: "#f5e1be", accent: "#ffc8be", eye: "#1e1e1e" }, // cream
  { outline: "#50505a", primary: "#f0f0f5", light: "#ffffff", accent: "#ffbec8", eye: "#1e1e1e" }, // white
  { outline: "#323237", primary: "#8c919b", light: "#bec3cd", accent: "#dcb4be", eye: "#141414" }, // gray
  { outline: "#141416", primary: "#2d2d32", light: "#5a5a5f", accent: "#b48c96", eye: "#e6e650" }, // black
  { outline: "#321e0f", primary: "#d27d37", light: "#502d19", accent: "#ffb4aa", eye: "#141414" }, // tabby
  { outline: "#372314", primary: "#e68c46", light: "#322d2d", accent: "#ffb4aa", eye: "#141414" }, // calico
];

const DOG_BREEDS: DogBreed[] = ["corgi", "shiba", "dachshund", "shepherd", "terrier"];

export function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function animalIdentity(seed: string): {
  kind: AnimalKind;
  breed: DogBreed;
  palette: AnimalPalette;
} {
  const h = hashSeed(seed || "kori");
  const kind: AnimalKind = h % 2 === 0 ? "dog" : "cat";
  const breed = DOG_BREEDS[h % DOG_BREEDS.length];
  const palette = PALETTES[h % PALETTES.length];
  return { kind, breed, palette };
}

/** Single brand colour for rings / backgrounds — primary of the animal palette. */
export function seedColor(seed: string): string {
  return animalIdentity(seed).palette.primary;
}

function grid(w: number, h: number): Px[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => null));
}

function put(g: Px[][], x: number, y: number, c: Px) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c;
}

function rect(g: Px[][], x0: number, y0: number, x1: number, y1: number, c: Px) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c);
}

function dogStand(breed: DogBreed): Px[][] {
  const g = grid(28, 18);
  rect(g, 8, 8, 20, 13, 1);
  rect(g, 9, 9, 19, 12, 2);
  rect(g, 6, 6, 10, 11, 1);
  rect(g, 3, 3, 9, 8, 1);
  rect(g, 4, 4, 8, 7, 2);
  rect(g, 1, 5, 4, 8, 2);
  put(g, 1, 6, 0);
  put(g, 2, 6, 0);
  put(g, 6, 5, 4);
  for (let x = 3; x < 10; x++) if (g[3][x] === 1) put(g, x, 3, 0);

  if (breed === "corgi") {
    put(g, 5, 1, 0);
    put(g, 5, 2, 1);
    put(g, 6, 2, 1);
    put(g, 8, 1, 0);
    put(g, 8, 2, 1);
    put(g, 7, 2, 1);
    rect(g, 9, 14, 11, 16, 1);
    put(g, 9, 17, 0);
    put(g, 10, 17, 0);
    rect(g, 16, 14, 18, 16, 1);
    put(g, 16, 17, 0);
    put(g, 17, 17, 0);
    put(g, 21, 9, 1);
    put(g, 22, 8, 1);
    put(g, 22, 7, 0);
  } else if (breed === "shiba") {
    put(g, 5, 1, 0);
    put(g, 5, 2, 1);
    put(g, 6, 2, 3);
    put(g, 8, 1, 0);
    put(g, 8, 2, 1);
    put(g, 7, 2, 3);
    rect(g, 9, 14, 11, 17, 1);
    put(g, 10, 17, 0);
    rect(g, 16, 14, 18, 17, 1);
    put(g, 17, 17, 0);
    put(g, 21, 8, 1);
    put(g, 22, 7, 1);
    put(g, 22, 6, 1);
    put(g, 21, 6, 0);
    put(g, 20, 7, 1);
  } else if (breed === "dachshund") {
    rect(g, 8, 9, 23, 13, 1);
    rect(g, 9, 10, 22, 12, 2);
    rect(g, 5, 6, 7, 10, 0);
    rect(g, 5, 7, 6, 9, 1);
    rect(g, 10, 14, 12, 16, 1);
    put(g, 11, 16, 0);
    rect(g, 19, 14, 21, 16, 1);
    put(g, 20, 16, 0);
    put(g, 24, 10, 1);
    put(g, 25, 11, 1);
    put(g, 26, 12, 0);
  } else if (breed === "shepherd") {
    put(g, 5, 1, 0);
    put(g, 5, 2, 1);
    put(g, 6, 2, 1);
    put(g, 8, 1, 0);
    put(g, 8, 2, 1);
    rect(g, 11, 8, 18, 11, 0);
    rect(g, 9, 14, 11, 17, 1);
    put(g, 10, 17, 0);
    rect(g, 16, 14, 18, 17, 1);
    put(g, 17, 17, 0);
    put(g, 21, 9, 1);
    put(g, 22, 10, 1);
    put(g, 23, 11, 0);
  } else {
    put(g, 5, 1, 0);
    put(g, 5, 2, 1);
    put(g, 8, 1, 0);
    put(g, 8, 2, 1);
    rect(g, 9, 14, 11, 17, 1);
    put(g, 10, 17, 0);
    rect(g, 15, 14, 17, 17, 1);
    put(g, 16, 17, 0);
    put(g, 21, 10, 1);
    put(g, 22, 11, 0);
  }
  return g;
}

function dogWalk(breed: DogBreed, frame: 0 | 1): Px[][] {
  const g = dogStand(breed);
  for (let y = 14; y < 18; y++) for (let x = 0; x < 28; x++) g[y][x] = null;
  if (frame === 0) {
    for (const [y, xs] of [
      [14, [8, 9, 10]],
      [15, [8, 9, 10]],
      [16, [9, 10]],
      [17, [10]],
    ] as const) {
      for (const x of xs) g[y][x] = y < 17 ? 1 : 0;
    }
    for (const [y, xs] of [
      [14, [17, 18, 19]],
      [15, [18, 19]],
      [16, [18, 19]],
      [17, [19]],
    ] as const) {
      for (const x of xs) g[y][x] = y < 17 ? 1 : 0;
    }
  } else {
    for (const [y, xs] of [
      [14, [10, 11, 12]],
      [15, [11, 12]],
      [16, [11, 12]],
      [17, [12]],
    ] as const) {
      for (const x of xs) g[y][x] = y < 17 ? 1 : 0;
    }
    for (const [y, xs] of [
      [14, [15, 16, 17]],
      [15, [15, 16]],
      [16, [15, 16]],
      [17, [15]],
    ] as const) {
      for (const x of xs) g[y][x] = y < 17 ? 1 : 0;
    }
  }
  return g;
}

function dogSit(): Px[][] {
  const g = grid(24, 18);
  rect(g, 8, 10, 16, 15, 1);
  rect(g, 9, 11, 15, 14, 2);
  rect(g, 6, 7, 11, 12, 1);
  rect(g, 3, 3, 9, 8, 1);
  rect(g, 4, 4, 8, 7, 2);
  rect(g, 1, 5, 4, 8, 2);
  put(g, 1, 6, 0);
  put(g, 2, 6, 0);
  put(g, 6, 5, 4);
  put(g, 5, 1, 0);
  put(g, 5, 2, 1);
  put(g, 6, 2, 3);
  put(g, 8, 1, 0);
  put(g, 8, 2, 1);
  put(g, 7, 2, 3);
  rect(g, 7, 14, 10, 16, 1);
  put(g, 8, 16, 0);
  put(g, 9, 16, 0);
  put(g, 17, 11, 1);
  put(g, 18, 10, 1);
  put(g, 18, 9, 0);
  put(g, 17, 9, 1);
  return g;
}

function dogSleep(): Px[][] {
  const g = grid(28, 12);
  rect(g, 4, 5, 22, 9, 1);
  rect(g, 5, 6, 21, 8, 2);
  rect(g, 1, 4, 7, 8, 1);
  rect(g, 2, 5, 6, 7, 2);
  put(g, 1, 6, 0);
  put(g, 4, 5, 0);
  put(g, 5, 5, 0);
  rect(g, 4, 3, 6, 5, 0);
  rect(g, 8, 9, 10, 10, 1);
  rect(g, 16, 9, 18, 10, 1);
  put(g, 23, 7, 1);
  put(g, 24, 8, 1);
  put(g, 25, 9, 0);
  return g;
}

function catStand(): Px[][] {
  const g = grid(22, 16);
  rect(g, 6, 7, 15, 11, 1);
  for (const x of [8, 11, 14]) {
    put(g, x, 7, 0);
    put(g, x, 8, 0);
  }
  rect(g, 3, 2, 10, 8, 1);
  rect(g, 4, 3, 9, 7, 2);
  put(g, 4, 0, 0);
  put(g, 4, 1, 1);
  put(g, 5, 1, 3);
  put(g, 8, 0, 0);
  put(g, 8, 1, 1);
  put(g, 7, 1, 3);
  put(g, 5, 4, 4);
  put(g, 6, 4, 2);
  put(g, 8, 4, 4);
  put(g, 9, 4, 2);
  put(g, 7, 5, 3);
  put(g, 6, 6, 0);
  put(g, 7, 6, 0);
  put(g, 8, 6, 0);
  rect(g, 7, 12, 8, 14, 1);
  put(g, 7, 15, 0);
  put(g, 8, 15, 0);
  rect(g, 10, 12, 11, 14, 1);
  put(g, 10, 15, 0);
  put(g, 11, 15, 0);
  rect(g, 13, 12, 14, 14, 1);
  put(g, 13, 15, 0);
  put(g, 14, 15, 0);
  put(g, 16, 9, 0);
  put(g, 17, 10, 1);
  put(g, 17, 11, 0);
  put(g, 16, 12, 0);
  return g;
}

function catWalk(frame: 0 | 1): Px[][] {
  const g = catStand();
  for (let y = 12; y < 16; y++) for (let x = 6; x < 16; x++) g[y][x] = null;
  if (frame === 0) {
    for (let y = 12; y < 15; y++) {
      g[y][6] = 1;
      g[y][7] = 1;
    }
    g[15][6] = 0;
    g[15][7] = 0;
    for (let y = 12; y < 15; y++) {
      g[y][10] = 1;
      g[y][11] = 1;
    }
    g[15][10] = 0;
    g[15][11] = 0;
    for (let y = 12; y < 15; y++) {
      g[y][13] = 1;
      g[y][14] = 1;
    }
    g[15][14] = 0;
    g[8][16] = 1;
    g[7][17] = 0;
  } else {
    for (let y = 12; y < 15; y++) {
      g[y][8] = 1;
      g[y][9] = 1;
    }
    g[15][8] = 0;
    g[15][9] = 0;
    for (let y = 12; y < 15; y++) {
      g[y][11] = 1;
      g[y][12] = 1;
    }
    g[15][11] = 0;
    g[15][12] = 0;
    for (let y = 12; y < 15; y++) {
      g[y][14] = 1;
      g[y][15] = 1;
    }
    g[15][15] = 0;
    g[10][16] = 1;
    g[11][17] = 0;
  }
  return g;
}

function catSit(): Px[][] {
  const g = grid(18, 16);
  rect(g, 5, 8, 12, 13, 1);
  rect(g, 6, 9, 11, 12, 2);
  rect(g, 4, 3, 11, 9, 1);
  rect(g, 5, 4, 10, 8, 2);
  put(g, 5, 1, 0);
  put(g, 5, 2, 1);
  put(g, 6, 2, 3);
  put(g, 9, 1, 0);
  put(g, 9, 2, 1);
  put(g, 8, 2, 3);
  put(g, 6, 5, 4);
  put(g, 7, 5, 2);
  put(g, 9, 5, 4);
  put(g, 10, 5, 2);
  put(g, 8, 6, 3);
  rect(g, 6, 13, 9, 14, 1);
  put(g, 13, 10, 1);
  put(g, 14, 8, 1);
  put(g, 14, 6, 1);
  put(g, 13, 5, 0);
  put(g, 7, 8, 0);
  put(g, 9, 8, 0);
  return g;
}

function catSleep(): Px[][] {
  const g = grid(24, 10);
  rect(g, 3, 4, 18, 7, 1);
  rect(g, 4, 5, 17, 6, 2);
  rect(g, 1, 3, 7, 7, 1);
  rect(g, 2, 4, 6, 6, 2);
  put(g, 3, 4, 0);
  put(g, 4, 4, 0);
  put(g, 5, 4, 0);
  put(g, 6, 4, 0);
  put(g, 4, 2, 0);
  put(g, 5, 2, 3);
  rect(g, 8, 7, 10, 8, 1);
  put(g, 19, 5, 1);
  put(g, 20, 6, 1);
  put(g, 21, 7, 0);
  put(g, 20, 8, 1);
  put(g, 8, 4, 0);
  put(g, 12, 4, 0);
  put(g, 16, 4, 0);
  return g;
}

export function animalFrame(
  seed: string,
  frame: BodyFrame,
): { pixels: Px[][]; palette: AnimalPalette; width: number; height: number } {
  const { kind, breed, palette } = animalIdentity(seed);
  let pixels: Px[][];
  if (kind === "dog") {
    if (frame === "sit") pixels = dogSit();
    else if (frame === "sleep") pixels = dogSleep();
    else if (frame === "walk0") pixels = dogWalk(breed, 0);
    else if (frame === "walk1") pixels = dogWalk(breed, 1);
    else pixels = dogStand(breed);
  } else {
    if (frame === "sit") pixels = catSit();
    else if (frame === "sleep") pixels = catSleep();
    else if (frame === "walk0") pixels = catWalk(0);
    else if (frame === "walk1") pixels = catWalk(1);
    else pixels = catStand();
  }
  return {
    pixels,
    palette,
    width: pixels[0]?.length ?? 1,
    height: pixels.length,
  };
}

export function paletteColor(palette: AnimalPalette, px: Exclude<Px, null>): string {
  switch (px) {
    case 0:
      return palette.outline;
    case 1:
      return palette.primary;
    case 2:
      return palette.light;
    case 3:
      return palette.accent;
    case 4:
      return palette.eye;
  }
}

/** Map HUD pose → body frame (walk cycles handled by the renderer). */
export function poseToBodyFrame(pose: string | undefined): BodyFrame {
  switch (pose) {
    case "walking":
      return "walk0";
    case "sleep":
    case "sad":
    case "heartbreak":
    case "broke":
      return "sleep";
    case "love":
    case "happy":
    case "idea":
    case "flag_wave":
    case "reading":
      return "sit";
    default:
      return "stand";
  }
}
