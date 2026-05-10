import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — merge Tailwind class strings with proper conflict resolution.
 *
 * Combines multiple class names (from `clsx`-style inputs) and resolves
 * Tailwind utility conflicts via `tailwind-merge`. Standard shadcn pattern.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
