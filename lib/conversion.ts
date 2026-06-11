import type { DbCallSummary } from "./adminDb";

// ============================================================
// Booking-outcome classification (regex fallback when the AI
// agent didn't post an explicit booking_status field).
// ============================================================

const CONFIRMED_PATTERNS: RegExp[] = [
  /\b(?:booking|reservation)\s+(?:is\s+)?(?:confirmed|complete|completed|made|secured|done|finalized|finalised)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*confirmed\s+(?:your|the)\s+(?:booking|reservation|stay|room)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*booked\s+(?:you|them|it|your|the)\b/i,
  /\bconfirmation\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9-]/i,
  /\breservation\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9-]/i,
  /\b(?:booking|reservation)\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9-]/i,
  /\byou(?:'re|\s+are)\s+(?:all\s+)?(?:booked|confirmed|set)\b/i,
  /\b(?:successfully|now|just)\s+(?:booked|reserved|confirmed)\b/i,
  /\bI(?:'ll|\s+will)\s+(?:go\s+ahead\s+and\s+)?(?:book|reserve|confirm)\s+(?:you|that|this|the)\b/i,
  /\b(?:room|suite|villa|chalet|cabin|bungalow|cottage)\s+(?:is\s+)?(?:booked|reserved|confirmed)\s+(?:for|under)\b/i,
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
  const explicit = s.booking_status as BookingStatus | null;
  let status: BookingStatus;
  let statusSource: "explicit" | "inferred";
  if (explicit && ["confirmed", "inquiry", "cancelled", "no_booking"].includes(explicit)) {
    status = explicit;
    statusSource = "explicit";
  } else {
    status = classifyConversion(s);
    statusSource = status === "none" ? "explicit" : "inferred";
  }

  // Build the haystack — combine transcript + structured fields so we can
  // extract guests/room/dates from anywhere.
  const haystack = [s.transcript, s.summary, s.action_items, s.key_points, s.mentioned_dates]
    .filter(Boolean)
    .join("\n");

  // Explicit AI fields ALWAYS win. Extraction only fills the gaps.
  const valueLkr = s.booking_value_lkr ?? extractValueLkr(haystack);
  const reference = s.booking_reference || extractReference(haystack);
  const roomType = s.booking_room_type || extractRoomType(haystack);
  const guests = s.booking_guests ?? extractGuests(haystack);

  let checkIn = s.booking_check_in;
  let checkOut = s.booking_check_out;
  if (!checkIn || !checkOut) {
    const dates = extractDates(haystack, s.occurred_at);
    if (!checkIn) checkIn = dates.checkIn;
    if (!checkOut) checkOut = dates.checkOut;
  }
  const nights = computeNights(checkIn, checkOut);

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
