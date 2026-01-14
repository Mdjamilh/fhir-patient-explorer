export type Token = { text: string; kind?: "key" | "string" | "number" | "literal" };

const PATTERN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

/** Splits pretty-printed JSON into tokens for syntax highlighting, keeping all text. */
export function tokenize(json: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of json.matchAll(PATTERN)) {
    const index = match.index;
    if (index > last) tokens.push({ text: json.slice(last, index) });
    const [whole, string, colon, number, literal] = match;
    if (string !== undefined) {
      tokens.push({ text: string, kind: colon ? "key" : "string" });
      if (colon) tokens.push({ text: colon });
    } else if (number !== undefined) {
      tokens.push({ text: number, kind: "number" });
    } else if (literal !== undefined) {
      tokens.push({ text: literal, kind: "literal" });
    }
    last = index + whole.length;
  }
  if (last < json.length) tokens.push({ text: json.slice(last) });
  return tokens;
}
