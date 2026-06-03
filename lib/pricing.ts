// Anthropic / Claude pricing in USD per 1M tokens. Keep in sync with
// https://www.anthropic.com/pricing as needed. Used to estimate per-call cost
// from input/output token counts ingested by the agent's backend.
type ModelPrice = { input: number; output: number; cacheWrite?: number; cacheRead?: number };

const PRICES: Record<string, ModelPrice> = {
  // Claude 4.x
  "claude-opus-4-8":         { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-opus-4-7":         { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-opus-4":           { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-sonnet-4-6":       { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3 },
  "claude-sonnet-4":         { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3 },
  "claude-haiku-4-5":        { input: 1,    output: 5,    cacheWrite: 1.25,  cacheRead: 0.1 },
  "claude-haiku-4":          { input: 1,    output: 5,    cacheWrite: 1.25,  cacheRead: 0.1 },
  // Claude 3.5 / 3
  "claude-3-5-sonnet":       { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3 },
  "claude-3-5-haiku":        { input: 0.8,  output: 4,    cacheWrite: 1,     cacheRead: 0.08 },
  "claude-3-opus":           { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-3-sonnet":         { input: 3,    output: 15 },
  "claude-3-haiku":          { input: 0.25, output: 1.25, cacheWrite: 0.3,   cacheRead: 0.03 },
};

const DEFAULT_PRICE: ModelPrice = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

function priceFor(model: string): ModelPrice {
  if (!model) return DEFAULT_PRICE;
  if (PRICES[model]) return PRICES[model];
  // Strip trailing date suffix and any minor revision, try longest prefix match.
  const stripped = model.replace(/-\d{8}$/, "").replace(/-latest$/, "");
  if (PRICES[stripped]) return PRICES[stripped];
  let best: ModelPrice | null = null;
  let bestLen = 0;
  for (const k of Object.keys(PRICES)) {
    if (stripped.startsWith(k) && k.length > bestLen) { best = PRICES[k]; bestLen = k.length; }
  }
  return best ?? DEFAULT_PRICE;
}

export type TokenCounts = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
};

// Cost stored as USD micros (1 USD = 1,000,000 micros) — fits in a bigint,
// preserves four+ decimal places without floats.
export function costMicros(model: string, u: TokenCounts): number {
  const p = priceFor(model);
  const inp = (u.input_tokens || 0) * p.input;            // tokens * (USD per 1M) = micros directly
  const out = (u.output_tokens || 0) * p.output;
  const cw  = (u.cache_creation_tokens || 0) * (p.cacheWrite ?? p.input * 1.25);
  const cr  = (u.cache_read_tokens || 0) * (p.cacheRead ?? p.input * 0.1);
  return Math.round(inp + out + cw + cr);
}

export function usdFromMicros(micros: number): number {
  return (micros || 0) / 1_000_000;
}

// Optional LKR conversion (configurable via env, defaults to a reasonable rate).
export function lkrFromMicros(micros: number): number {
  const rate = Number(process.env.USD_TO_LKR || "305");
  return usdFromMicros(micros) * rate;
}
