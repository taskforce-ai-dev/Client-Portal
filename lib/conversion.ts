import type { DbCallSummary } from "./adminDb";

// ============================================================
// Booking-outcome classification (regex fallback when the AI
// agent didn't post an explicit booking_status field).
// ============================================================

const CONFIRMED_PATTERNS: RegExp[] = [
  /\b(?:booking|reservation)\s+(?:is\s+)?(?:confirmed|complete|completed|made|secured|done|finalized|finalised|placed)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*confirmed\s+(?:your|the|her|his|their)\s+(?:booking|reservation|stay|room|villa|chalet|suite|cabin)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*booked\s+(?:you|them|it|your|the|her|him|us)\b/i,
  /\bconfirmation\s+(?:number|code|id|reference|details?)\s+(?:is|are|:)\s*[A-Za-z0-9]/i,
  /\breservation\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9]/i,
  /\b(?:booking|reservation)\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9]/i,
  /\byou(?:'re|\s+are)\s+(?:all\s+)?(?:booked|confirmed|set|good\s+to\s+go)\b/i,
  /\b(?:successfully|now|just)\s+(?:booked|reserved|confirmed)\b/i,
  /\bI(?:'ll|\s+will)\s+(?:go\s+ahead\s+and\s+)?(?:book|reserve|confirm)\s+(?:you|that|this|the|her|him|them)\b/i,
  /\b(?:room|suite|villa|chalet|cabin|bungalow|cottage|treehouse|tree\s+house)\s+(?:is\s+|has\s+been\s+)?(?:booked|reserved|confirmed)\b/i,
  // Explicit structured-output markers — common AI footer phrasing
  /\b(?:booking[_\s]*)?status\s*[:=]\s*(?:confirmed|booked|complete)\b/i,
  /\b(?:outcome|result|final[_\s]*outcome|booking[_\s]*outcome|conversion)\s*[:=]\s*(?:confirmed|booked|complete|success(?:ful)?|won)\b/i,
  /\b(?:reservation|booking|stay)\s*[:=]\s*(?:confirmed|booked|complete|yes)\b/i,
  /\b\[(?:booking[_\s]*)?(?:confirmed|booked|complete)\]/i,
  // Action items that imply a confirmed booking
  /\b(?:send|email|share)\s+(?:the\s+)?(?:confirmation|booking\s+details?|invoice|receipt)\b/i,
  /\bsave\s+(?:the\s+)?(?:booking|reservation)\b/i,
  /\b(?:added|entered|recorded|saved)\s+(?:the\s+)?(?:booking|reservation)\b/i,
];

const CANCELLED_PATTERNS: RegExp[] = [
  /\b(?:booking|reservation)\s+(?:is\s+|has\s+been\s+)?(?:cancelled|canceled)\b/i,
  /\bcancel(?:led|ed)?\s+(?:the|your|their)\s+(?:booking|reservation|stay)\b/i,
];

const INQUIRY_PATTERNS: RegExp[] = [
  /\b(?:will|would|let\s+me)\s+(?:call|get)\s+back\b/i,
  /\bthinking\s+(?:about|over)\s+it\b/i,
  /\b(?:check|consult|discuss)\s+with\s+(?:my|the|her|his|our)\s+(?:husband|wife|partner|family|spouse|team|colleague|friend)\b/i,
  /\b(?:available|availability|rates?|prices?)\s+for\b/i,
  /\b(?:inquiry|enquiry|interested\s+in)\b/i,
  /\b(?:asked|asking)\s+about\s+(?:availability|prices?|rates?|rooms?|the\s+room)\b/i,
];

const NO_BOOKING_PATTERNS: RegExp[] = [
  /\balready\s+booked\s+(?:somewhere|elsewhere)\b/i,
  /\bnot\s+interested\b/i,
  /\bwrong\s+number\b/i,
  /\bno\s+thank(?:s|\s+you)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  for (const re of patterns) if (re.test(text)) return true;
  return false;
}

export type BookingStatus = "confirmed" | "inquiry" | "cancelled" | "no_booking" | "none";

export function classifyConversion(s: Pick<DbCallSummary, "transcript" | "summary" | "action_items" | "key_points">): BookingStatus {
  const haystack = [s.transcript, s.summary, s.action_items, s.key_points].filter(Boolean).join("\n");
  if (!haystack) return "none";
  // Confirmed wins over everything else — a transcript that talks about a
  // confirmation at the end takes precedence over earlier inquiry language.
  if (matchesAny(haystack, CONFIRMED_PATTERNS)) return "confirmed";
  if (matchesAny(haystack, CANCELLED_PATTERNS)) return "cancelled";
  if (matchesAny(haystack, INQUIRY_PATTERNS)) return "inquiry";
  if (matchesAny(haystack, NO_BOOKING_PATTERNS)) return "no_booking";
  return "none";
}

// ============================================================
// Structured parser — pulls KEY: value / KEY = value pairs out of
// text. AI agents commonly append a structured summary block at the
// end of a transcript ("Booking status: confirmed", "Total: Rs.
// 24500", "Room: Treetop Suite", etc.). This catches anything the
// conversational regex misses. Runs over the WHOLE haystack, not just
// the end, so a structured header at the top works too.
// ============================================================

const STATUS_NORMALISE: Record<string, BookingStatus> = {
  confirmed: "confirmed",
  booked: "confirmed",
  complete: "confirmed",
  completed: "confirmed",
  success: "confirmed",
  successful: "confirmed",
  won: "confirmed",
  yes: "confirmed",
  inquiry: "inquiry",
  enquiry: "inquiry",
  pending: "inquiry",
  lead: "inquiry",
  followup: "inquiry",
  "follow-up": "inquiry",
  cancelled: "cancelled",
  canceled: "cancelled",
  declined: "cancelled",
  rejected: "cancelled",
  no_booking: "no_booking",
  "no-booking": "no_booking",
  none: "no_booking",
  lost: "no_booking",
  not_interested: "no_booking",
  "not-interested": "no_booking",
};

export type StructuredBooking = {
  status: BookingStatus | null;
  room: string | null;
  guests: number | null;
  valueLkr: number | null;
  reference: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
};

// Match "key: value" or "key = value" tolerant of various separators
// (label can include underscores, hyphens, spaces; value runs to the
// end of the line).
function matchLabeled(text: string, labels: string[]): string | null {
  for (const lab of labels) {
    const re = new RegExp(`(?:^|\\n|\\r|\\s{2,}|\\*|-|\\u2022)\\s*\\*{0,2}${lab}\\*{0,2}\\s*[:=]\\s*([^\\n\\r]+)`, "i");
    const m = text.match(re);
    if (m) {
      const v = m[1].trim().replace(/^[*"'\s-]+|[*"'\s.,;]+$/g, "");
      if (v) return v;
    }
  }
  return null;
}

function parseValueNumber(raw: string | null): number | null {
  if (!raw) return null;
  // Strip currency markers, words, then parse
  const cleaned = raw
    .replace(/Rs\.?|LKR|rupees?|USD|\$|EUR|€/gi, "")
    .replace(/[,\s]/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 500 ? Math.round(n) : null;
}

function parseDateMaybe(raw: string | null, fallbackYear?: number): string | null {
  if (!raw) return null;
  const text = raw.trim();
  // ISO direct
  const isoM = text.match(/^(\d{4}-\d{2}-\d{2})\b/);
  if (isoM) return isoM[1];
  // DD/MM/YYYY
  const ddmm = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (ddmm) {
    const d = Number(ddmm[1]);
    const m = Number(ddmm[2]);
    let y = ddmm[3] ? Number(ddmm[3]) : (fallbackYear || new Date().getUTCFullYear());
    if (y < 100) y += 2000;
    return iso(y, m, d);
  }
  // "August 12 2026" / "12 August 2026" / "August 12"
  const monthFirst = text.match(new RegExp(`^${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "i"));
  if (monthFirst) {
    const m = MONTHS[monthFirst[1].toLowerCase()];
    const d = Number(monthFirst[2]);
    const y = monthFirst[3] ? Number(monthFirst[3]) : (fallbackYear || new Date().getUTCFullYear());
    return iso(y, m, d);
  }
  const dayFirst = text.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:,?\\s*(\\d{4}))?`, "i"));
  if (dayFirst) {
    const d = Number(dayFirst[1]);
    const m = MONTHS[dayFirst[2].toLowerCase()];
    const y = dayFirst[3] ? Number(dayFirst[3]) : (fallbackYear || new Date().getUTCFullYear());
    return iso(y, m, d);
  }
  return null;
}

export function parseStructured(text: string | null, callDate?: string): StructuredBooking {
  const empty: StructuredBooking = {
    status: null, room: null, guests: null, valueLkr: null,
    reference: null, checkIn: null, checkOut: null, nights: null,
  };
  if (!text) return empty;
  const fbYear = callDate ? new Date(callDate).getUTCFullYear() : undefined;

  // ---- Status -------------------------------------------------------
  const statusRaw = matchLabeled(text, [
    "booking[_\\s-]*status", "reservation[_\\s-]*status", "status",
    "outcome", "result", "final[_\\s-]*outcome", "booking[_\\s-]*outcome",
    "conversion", "booking", "reservation",
  ]);
  let status: BookingStatus | null = null;
  if (statusRaw) {
    const key = statusRaw.toLowerCase().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    status = STATUS_NORMALISE[key] ?? null;
  }
  // Bracketed tags: [CONFIRMED] / [BOOKED] / [INQUIRY]
  if (!status) {
    const tag = text.match(/\[(?:booking[_\s]*)?(confirmed|booked|complete|success(?:ful)?|won|inquiry|enquiry|pending|cancelled|canceled|no[_\s]*booking|lost)\]/i);
    if (tag) {
      const key = tag[1].toLowerCase().replace(/\s+/g, "_");
      status = STATUS_NORMALISE[key] ?? null;
    }
  }

  // ---- Room ---------------------------------------------------------
  const roomRaw = matchLabeled(text, [
    "room[_\\s-]*type", "room", "unit[_\\s-]*type", "unit",
    "accommodation", "accomodation", "category", "villa", "suite", "chalet",
  ]);
  let room: string | null = null;
  if (roomRaw) {
    // Cap at ~40 chars; strip trailing punctuation
    room = roomRaw.slice(0, 60).replace(/\s+/g, " ").trim();
    if (room.length < 2) room = null;
    else room = titleCase(room);
  }

  // ---- Guests -------------------------------------------------------
  const guestsRaw = matchLabeled(text, [
    "guests?", "no\\.?[_\\s]*of[_\\s]*guests", "number[_\\s]*of[_\\s]*guests",
    "adults?", "pax", "occupancy", "headcount", "people", "persons?",
  ]);
  let guests: number | null = null;
  if (guestsRaw) {
    const n = wordToNum(guestsRaw.split(/[\s,]/)[0]);
    if (n && n <= 50) guests = n;
  }

  // ---- Value --------------------------------------------------------
  const valueRaw = matchLabeled(text, [
    "total", "total[_\\s]*amount", "amount", "amount[_\\s]*due",
    "price", "cost", "total[_\\s]*cost", "total[_\\s]*price",
    "booking[_\\s]*value", "value", "charges?", "rate", "grand[_\\s]*total",
    "total[_\\s]*lkr", "booking[_\\s]*total",
  ]);
  let valueLkr = parseValueNumber(valueRaw);

  // ---- Reference ----------------------------------------------------
  const refRaw = matchLabeled(text, [
    "confirmation[_\\s]*number", "confirmation[_\\s]*code", "confirmation[_\\s]*id",
    "confirmation[_\\s]*reference", "confirmation",
    "booking[_\\s]*number", "booking[_\\s]*reference", "booking[_\\s]*id", "booking[_\\s]*ref",
    "reservation[_\\s]*number", "reservation[_\\s]*reference", "reservation[_\\s]*id",
    "reference[_\\s]*number", "reference[_\\s]*code", "reference",
    "ref", "id",
  ]);
  let reference: string | null = null;
  if (refRaw) {
    const cleaned = refRaw.split(/\s/)[0].replace(/[^A-Za-z0-9\-_/]/g, "");
    if (cleaned.length >= 3 && /[A-Z0-9]/i.test(cleaned)) reference = cleaned.toUpperCase();
  }

  // ---- Check-in / Check-out / Nights -------------------------------
  const ciRaw = matchLabeled(text, [
    "check[_\\s-]*in", "check[_\\s-]*in[_\\s-]*date", "arrival", "arrival[_\\s-]*date",
    "from", "start[_\\s-]*date", "stay[_\\s-]*start",
  ]);
  const coRaw = matchLabeled(text, [
    "check[_\\s-]*out", "check[_\\s-]*out[_\\s-]*date", "departure", "departure[_\\s-]*date",
    "to", "until", "end[_\\s-]*date", "stay[_\\s-]*end",
  ]);
  const nightsRaw = matchLabeled(text, [
    "nights?", "no\\.?[_\\s]*of[_\\s]*nights", "length[_\\s]*of[_\\s]*stay", "duration", "stay[_\\s]*duration",
  ]);
  const checkIn = parseDateMaybe(ciRaw, fbYear);
  const checkOut = parseDateMaybe(coRaw, fbYear);
  let nights: number | null = null;
  if (nightsRaw) {
    const n = wordToNum(nightsRaw.split(/[\s,]/)[0]);
    if (n && n <= 365) nights = n;
  }

  return { status, room, guests, valueLkr, reference, checkIn, checkOut, nights };
}

// ============================================================
// Field extractors — pull the practical booking details out of
// free text when the AI agent didn't set explicit fields. Each
// is conservative: returns null when uncertain so we never show
// fabricated data.
// ============================================================

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function wordToNum(s: string): number | null {
  const n = Number(s);
  if (Number.isFinite(n) && n > 0 && n <= 100) return n;
  const w = NUMBER_WORDS[s.toLowerCase()];
  return w || null;
}

function titleCase(s: string): string {
  return s.toLowerCase().split(/\s+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// "2 guests" / "two adults" / "party of 4" / "group of five" / "for 3 people"
const GUEST_PATTERNS: RegExp[] = [
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:guests?|adults?|persons?|people|pax)\b/i,
  /\bparty\s+of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\bgroup\s+of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\bfor\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|guests?|persons?|adults?|of\s+(?:us|you|them))\b/i,
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+of\s+(?:us|you|them)\b/i,
  /\b(\d{1,2})\s*(?:pax|pp)\b/i,
];

export function extractGuests(text: string | null): number | null {
  if (!text) return null;
  for (const re of GUEST_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const n = wordToNum(m[1]);
      if (n && n <= 50) return n;
    }
  }
  // "X adults and Y children" → sum
  const split = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+adults?\s+(?:and|with|\+)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+child(?:ren)?\b/i);
  if (split) {
    const a = wordToNum(split[1]) || 0;
    const c = wordToNum(split[2]) || 0;
    if (a + c > 0) return a + c;
  }
  return null;
}

// Tries to recognise the specific room/unit type mentioned in the call.
// Patterns are intentionally hospitality-focused (suite, chalet, villa,
// cabin, bungalow, cottage, treehouse) and tolerant of phrasing.
const ROOM_PATTERNS: RegExp[] = [
  // Tree house variants — Tree House Chalets specific
  /\b((?:tree[\s-]?top|tree[\s-]?house|treehouse)(?:\s+(?:suite|chalet|villa|cabin|bungalow|cottage|room|unit|deluxe|premium|family))?)\b/i,
  // Quality + type: "Deluxe Suite", "Standard Villa"
  /\b((?:deluxe|standard|premium|executive|family|romantic|honeymoon|luxury|signature|garden|forest|jungle|riverside|lakeside|sea\s*view|ocean[\s-]?view|hill[\s-]?view|mountain|pool|king|queen|twin|double|single)\s+(?:suite|chalet|villa|cabin|bungalow|cottage|room))\b/i,
  // "the Treetop suite" — proper-noun room name
  /\bthe\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:suite|chalet|villa|cabin|bungalow|cottage))\b/,
  // Bare unit type
  /\b((?:suite|chalet|villa|cabin|bungalow|cottage|tree\s*house))\b/i,
];

export function extractRoomType(text: string | null): string | null {
  if (!text) return null;
  for (const re of ROOM_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const clean = m[1].replace(/\s+/g, " ").trim();
      // Skip generic single-word matches if a quality adjective shows up
      // later in the text — we'd rather wait for the better pattern.
      if (clean.split(/\s+/).length === 1) {
        for (const re2 of ROOM_PATTERNS.slice(0, 3)) {
          const m2 = text.match(re2);
          if (m2) return titleCase(m2[1].replace(/\s+/g, " ").trim());
        }
      }
      return titleCase(clean);
    }
  }
  return null;
}

// Date extraction. Handles ISO ("2026-08-12"), "August 12-17", "12-17
// August", "August 12 to 17", with or without year. Returns ISO strings
// so the UI can format them however it likes.
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)";

function iso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function extractDates(text: string | null, callDate?: string): { checkIn: string | null; checkOut: string | null } {
  if (!text) return { checkIn: null, checkOut: null };
  const fallbackYear = callDate
    ? new Date(callDate).getUTCFullYear()
    : new Date().getUTCFullYear();

  // 1) ISO dates take precedence
  const isoMatches = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  if (isoMatches.length >= 2) {
    return { checkIn: isoMatches[0][0], checkOut: isoMatches[1][0] };
  }
  if (isoMatches.length === 1) {
    return { checkIn: isoMatches[0][0], checkOut: null };
  }

  // 2) "August 12-17, 2026" / "August 12 to 17"
  let m = text.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|through|thru|[-–—~])\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, "i"));
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    const d1 = Number(m[2]);
    const d2 = Number(m[3]);
    const year = m[4] ? Number(m[4]) : fallbackYear;
    return { checkIn: iso(year, mon, d1), checkOut: iso(year, mon, d2) };
  }

  // 3) "12-17 August" / "12 to 17 August 2026"
  m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|through|thru|[-–—~])\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:\\s*,?\\s*(\\d{4}))?\\b`, "i"));
  if (m) {
    const d1 = Number(m[1]);
    const d2 = Number(m[2]);
    const mon = MONTHS[m[3].toLowerCase()];
    const year = m[4] ? Number(m[4]) : fallbackYear;
    return { checkIn: iso(year, mon, d1), checkOut: iso(year, mon, d2) };
  }

  // 4) "August 28 to September 3" (cross-month)
  m = text.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|till|through|thru|[-–—~])\\s*${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, "i"));
  if (m) {
    const m1 = MONTHS[m[1].toLowerCase()];
    const d1 = Number(m[2]);
    const m2 = MONTHS[m[3].toLowerCase()];
    const d2 = Number(m[4]);
    const year = m[5] ? Number(m[5]) : fallbackYear;
    const y2 = m2 < m1 ? year + 1 : year; // cross year-end
    return { checkIn: iso(year, m1, d1), checkOut: iso(y2, m2, d2) };
  }

  // 5) "checking in on August 12 for 5 nights" — derive checkout from nights
  const nightsMatch = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+nights?\b/i);
  const nights = nightsMatch ? wordToNum(nightsMatch[1]) : null;

  m = text.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, "i"));
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    const d = Number(m[2]);
    const year = m[3] ? Number(m[3]) : fallbackYear;
    const checkIn = iso(year, mon, d);
    if (checkIn && nights) {
      const ciDate = new Date(checkIn + "T00:00:00Z");
      ciDate.setUTCDate(ciDate.getUTCDate() + nights);
      const checkOut = iso(ciDate.getUTCFullYear(), ciDate.getUTCMonth() + 1, ciDate.getUTCDate());
      return { checkIn, checkOut };
    }
    return { checkIn, checkOut: null };
  }

  // 6) "DD/MM" or "DD/MM/YYYY"
  const ddmm = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)];
  if (ddmm.length >= 1) {
    const parse = (mm: RegExpMatchArray) => {
      const d = Number(mm[1]);
      const mo = Number(mm[2]);
      let y = mm[3] ? Number(mm[3]) : fallbackYear;
      if (y < 100) y += 2000;
      return iso(y, mo, d);
    };
    const first = parse(ddmm[0]);
    const second = ddmm[1] ? parse(ddmm[1]) : null;
    return { checkIn: first, checkOut: second };
  }

  return { checkIn: null, checkOut: null };
}

export function computeNights(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const d1 = new Date(checkIn + (checkIn.length === 10 ? "T00:00:00Z" : ""));
  const d2 = new Date(checkOut + (checkOut.length === 10 ? "T00:00:00Z" : ""));
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

// Extract booking value in LKR. Supports Rs. notation, "rupees", contextual
// "total is", and bare LKR. USD/dollar mentions are intentionally ignored
// here so a wrong currency doesn't pollute the LKR column.
const VALUE_PATTERNS: RegExp[] = [
  /(?:total|grand\s+total|price|amount|cost|charges?|comes?\s+to|will\s+be|that(?:'ll|\s+will)\s+be)\s+(?:is\s+|of\s+)?(?:Rs\.?|LKR)?\s*([\d,]+(?:\.\d+)?)/i,
  /Rs\.?\s*([\d,]+(?:\.\d+)?)/i,
  /([\d,]+(?:\.\d+)?)\s*(?:LKR|rupees?|lkr)/i,
];

export function extractValueLkr(text: string | null): number | null {
  if (!text) return null;
  for (const re of VALUE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      // Sanity floor: anything under 500 LKR is almost certainly a misread.
      if (Number.isFinite(n) && n >= 500) return Math.round(n);
    }
  }
  return null;
}

const REF_PATTERNS: RegExp[] = [
  /confirmation\s+(?:number|code|id|reference)\s*(?:is|:)\s*([A-Z0-9][A-Z0-9\-/]{2,})/i,
  /booking\s+(?:number|reference|id|ref)\s*(?:is|:)\s*([A-Z0-9][A-Z0-9\-/]{2,})/i,
  /reservation\s+(?:number|code|reference|id|ref)\s*(?:is|:)\s*([A-Z0-9][A-Z0-9\-/]{2,})/i,
  /\bref(?:erence)?\s*[#:]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/i,
];

export function extractReference(text: string | null): string | null {
  if (!text) return null;
  for (const re of REF_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// ============================================================
// Final shape consumed by the Conversions page.
// ============================================================

export type Conversion = {
  id: string;
  twilioCallSid: string | null;
  callerName: string;
  callerPhone: string | null;
  occurredAt: string;
  durationSec: number | null;
  status: BookingStatus;
  statusSource: "explicit" | "inferred";
  valueLkr: number | null;
  reference: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guests: number | null;
  roomType: string | null;
  mentionedDates: string | null;
  summary: DbCallSummary;
};

export function toConversion(s: DbCallSummary): Conversion {
  // Build the haystack — combine transcript + structured fields so we can
  // extract guests/room/dates from anywhere.
  const haystack = [s.transcript, s.summary, s.action_items, s.key_points, s.mentioned_dates]
    .filter(Boolean)
    .join("\n");

  // Three-tier classification:
  //   1) explicit AI-posted booking_status  (always wins)
  //   2) structured KEY: value parser       (catches "Status: confirmed"
  //      style footers that the AI puts at the end of transcripts)
  //   3) conversational regex matchers      (catches "you're booked"
  //      style phrases inside dialogue)
  const explicit = s.booking_status as BookingStatus | null;
  const struct = parseStructured(haystack, s.occurred_at);
  let status: BookingStatus;
  let statusSource: "explicit" | "inferred";
  if (explicit && ["confirmed", "inquiry", "cancelled", "no_booking"].includes(explicit)) {
    status = explicit;
    statusSource = "explicit";
  } else if (struct.status) {
    status = struct.status;
    statusSource = "inferred";
  } else {
    status = classifyConversion(s);
    statusSource = status === "none" ? "explicit" : "inferred";
  }

  // Field precedence: explicit AI > structured KEY:value > free-text regex.
  const valueLkr = s.booking_value_lkr ?? struct.valueLkr ?? extractValueLkr(haystack);
  const reference = s.booking_reference || struct.reference || extractReference(haystack);
  const roomType = s.booking_room_type || struct.room || extractRoomType(haystack);
  const guests = s.booking_guests ?? struct.guests ?? extractGuests(haystack);

  let checkIn = s.booking_check_in || struct.checkIn;
  let checkOut = s.booking_check_out || struct.checkOut;
  if (!checkIn || !checkOut) {
    const dates = extractDates(haystack, s.occurred_at);
    if (!checkIn) checkIn = dates.checkIn;
    if (!checkOut) checkOut = dates.checkOut;
  }
  let nights = computeNights(checkIn, checkOut) ?? struct.nights;
  // If we have nights + check-in but no check-out, derive it.
  if (checkIn && !checkOut && nights) {
    const d = new Date(checkIn + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + nights);
    checkOut = iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  return {
    id: s.id,
    twilioCallSid: s.twilio_call_sid,
    callerName: s.caller_name || "—",
    callerPhone: s.caller_phone,
    occurredAt: s.occurred_at,
    durationSec: s.duration_sec,
    status,
    statusSource,
    valueLkr,
    reference,
    checkIn,
    checkOut,
    nights,
    guests,
    roomType,
    mentionedDates: s.mentioned_dates,
    summary: s,
  };
}

export type ConversionStats = {
  totalCalls: number;
  realIntent: number;     // confirmed + inquiry + cancelled
  confirmed: number;
  cancelled: number;
  noBooking: number;
  unknown: number;
  conversionPct: number;  // confirmed / realIntent
  totalRevenueLkr: number;
  avgValueLkr: number;
  totalNights: number;
};

export function computeStats(items: Conversion[]): ConversionStats {
  let confirmed = 0, cancelled = 0, noBooking = 0, unknown = 0, inquiry = 0;
  let totalRevenueLkr = 0, confirmedWithValue = 0, totalNights = 0;
  for (const c of items) {
    if (c.status === "confirmed") confirmed++;
    else if (c.status === "cancelled") cancelled++;
    else if (c.status === "no_booking") noBooking++;
    else if (c.status === "inquiry") inquiry++;
    else unknown++;
    if (c.status === "confirmed") {
      if (c.valueLkr != null) {
        totalRevenueLkr += c.valueLkr;
        confirmedWithValue++;
      }
      if (c.nights) totalNights += c.nights;
    }
  }
  const realIntent = confirmed + inquiry + cancelled;
  const conversionPct = realIntent > 0 ? Math.round((confirmed / realIntent) * 1000) / 10 : 0;
  const avgValueLkr = confirmedWithValue > 0 ? Math.round(totalRevenueLkr / confirmedWithValue) : 0;
  return {
    totalCalls: items.length,
    realIntent,
    confirmed,
    cancelled,
    noBooking,
    unknown,
    conversionPct,
    totalRevenueLkr,
    avgValueLkr,
    totalNights,
  };
}

// Human date helpers used by the UI table.
export function formatStayRange(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return "—";
  const parseDate = (s: string) => new Date((s.length === 10 ? s + "T00:00:00Z" : s));
  const d1 = parseDate(checkIn);
  if (isNaN(d1.getTime())) return checkIn;
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  if (!checkOut) return fmt(d1, { month: "short", day: "numeric", year: "numeric" });
  const d2 = parseDate(checkOut);
  if (isNaN(d2.getTime())) return `${checkIn} → ${checkOut}`;
  const sameYear = d1.getUTCFullYear() === d2.getUTCFullYear();
  const sameMonth = sameYear && d1.getUTCMonth() === d2.getUTCMonth();
  if (sameMonth) return `${fmt(d1, { month: "short", day: "numeric" })} – ${d2.getUTCDate()}`;
  if (sameYear) return `${fmt(d1, { month: "short", day: "numeric" })} – ${fmt(d2, { month: "short", day: "numeric" })}`;
  return `${fmt(d1, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(d2, { month: "short", day: "numeric", year: "numeric" })}`;
}
