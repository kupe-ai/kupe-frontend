import { lazy, type ComponentType } from "react";

export function lazyWithRetry<T extends { default: ComponentType }>(
  factory: () => Promise<T>,
) {
  return lazy(factory);
}
