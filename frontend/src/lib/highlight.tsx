/** Splits text around every quote (whitespace-tolerant) and marks the quoted parts. */
export function withHighlights(text: string, quotes: string[]) {
  const patterns = [...new Set(quotes)]
    .filter((q) => q.trim())
    .sort((a, b) => b.length - a.length)
    .map((q) =>
      q
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s+"),
    );
  if (!patterns.length) return [text];
  const re = new RegExp(`(${patterns.join("|")})`, "g");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}
