// Matches the athletes.handle CHECK constraint: '^[a-z0-9_]{3,30}$' (no
// hyphens — underscore only). Used to auto-derive a handle from a display
// name so users don't have to pick both separately.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugifyHandle(text: string): string {
  const stripped = text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const padded = stripped.length >= 3 ? stripped : (stripped + "___").slice(0, 3);
  return padded.slice(0, 30);
}
