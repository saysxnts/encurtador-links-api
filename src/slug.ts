import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generates a random slug without ambiguous characters (0/O, 1/l/I). */
export function generateSlug(length = 7): string {
  let slug = "";
  for (let i = 0; i < length; i++) slug += ALPHABET[randomInt(ALPHABET.length)];
  return slug;
}

/** Paths that must never be used as slugs because they collide with routes. */
export const RESERVED_SLUGS = new Set(["api", "health", "docs"]);
