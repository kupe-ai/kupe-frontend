/**
 * Kori overlay motion — open and close.
 *
 * Uses `data-[state=…]` (Radix’s real attribute) so enter/exit always run,
 * even without shadcn’s `data-open:` custom variants.
 */
export const koriFade =
  "duration-200 ease-[var(--ease-pop)] fill-mode-both data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const koriPop = `${koriFade} data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95`;

export const koriFromSide =
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

export const koriSheetSlide =
  "data-[side=bottom]:data-[state=open]:slide-in-from-bottom-10 data-[side=left]:data-[state=open]:slide-in-from-left-10 data-[side=right]:data-[state=open]:slide-in-from-right-10 data-[side=top]:data-[state=open]:slide-in-from-top-10 data-[side=bottom]:data-[state=closed]:slide-out-to-bottom-10 data-[side=left]:data-[state=closed]:slide-out-to-left-10 data-[side=right]:data-[state=closed]:slide-out-to-right-10 data-[side=top]:data-[state=closed]:slide-out-to-top-10";
