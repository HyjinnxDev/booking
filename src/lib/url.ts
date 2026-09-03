// Review §1.5. A `?next=` value is only safe if it's a same-site absolute path.
// Rejects `//evil.com`, `https://evil.com`, `\\evil.com`, and anything not
// starting with a single `/`.
export function safeNext(next: string | null | undefined, fallback = '/bookings'): string {
  if (!next || !/^\/(?!\/)[^\\]*$/.test(next)) return fallback;
  return next;
}
