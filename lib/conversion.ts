import type { DbCallSummary } from "./adminDb";

// Conservative regex set — agent-action keywords in context of booking,
// reservation, confirmation. Customer questions like "do you have rooms?"
// shouldn't false-positive as a confirmed booking.
const CONFIRMED_PATTERNS: RegExp[] = [
  /\b(booking|reservation)\s+(?:is\s+)?(?:confirmed|complete|completed|made|secured)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*confirmed\s+(?:your|the)\s+(?:booking|reservation|stay|room)\b/i,
  /\b(?:I(?:'ve|\s+have))?\s*booked\s+(?:you|them|it|your|the)\b/i,
  /\bconfirmation\s+(?:number|code|id|reference)\s+(?:is|:)\s*[A-Za-z0-9-]/i,
  /\breservation\s+number\s+(?:is|:)\s*[A-Za-z0-9-]/i,
  /\byou(?:'re|\s+are)\s+(?:all\s+)?booked\b/i,
  /\b(?:successfully|now)\s+(?:booked|reserved|confirmed)\b/i,
];

const CANCELLED_PATTERNS: RegExp[] = [
  /\b(?:booking|reservation)\s+(?:is\s+)?(?:cancelled|canceled)\b/i,
  /\bcancel(?:led|ed)?\s+(?:the|your|their)\s+(?:booking|reservation|stay)\b/i,
];

const INQUIRY_PATTERNS: RegExp[] = [
  /\b(?:will|would)\s+(?:call|get)\s+back\b/i,
  /\bthinking\s+(?:about|over)\s+it\b/i,
  /\b(?:check|consult|discuss)\s+with\s+(?:my|the|her|his)\s+(?:husband|wife|partner|family|spouse|team|colleague)\b/i,
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
  // Order matters: confirmed first (highest signal), then cancelled, then
  // inquiry, then no_booking. A transcript that mentions both "booked" and
  // "wrong number" earlier almost certainly ended with the booking.
  if (matchesAny(haystack, CONFIRMED_PATTERNS)) return "confirmed";
  if (matchesAny(haystack, CANCELLED_PATTERNS)) return "cancelled";
  if (matchesAny(haystack, INQUIRY_PATTERNS)) return "inquiry";
  if (matchesAny(haystack, NO_BOOKING_PATTERNS)) return "no_booking";
  return "none";
}

// Attempt to extract a booking value (LKR) from free text — looks for
// "Rs. 24,500" / "Rs 24500" / "24500 LKR" / "24,500 rupees". Returns null
// if nothing convincing is found. Conservative; the AI explicit field
// always wins when present.
const VALUE_PATTERNS: RegExp[] = [
  /Rs\.?\s*([\d,]+(?:\.\d+)?)/i,
  /([\d,]+(?:\.\d+)?)\s*(?:LKR|rupees?)/i,
];
export function extractValueLkr(text: string | null): number | null {
  if (!text) return null;
  for (const re of VALUE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  return null;
}

export type Conversion = {
  id: string;
  twilioCallSid: string | null;
  callerName: string;
  callerPhone: string | null;
  occurredAt: string;
  durationSec: number | null;
  status: BookingStatus;
  statusSource: "explicit" | "inferred"; // explicit = posted by AI; inferred = from keywords
  valueLkr: number | null;
  reference: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  roomType: string | null;
  mentionedDates: string | null;
  summary: DbCallSummary; // for the transcript modal
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
  const valueLkr = s.booking_value_lkr ?? extractValueLkr(s.summary) ?? extractValueLkr(s.action_items);
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
    reference: s.booking_reference,
    checkIn: s.booking_check_in,
    checkOut: s.booking_check_out,
    guests: s.booking_guests,
    roomType: s.booking_room_type,
    mentionedDates: s.mentioned_dates,
    summary: s,
  };
}

export type ConversionStats = {
  totalCalls: number;
  inquiries: number;     // status != "none" && status != "no_booking"
  confirmed: number;
  cancelled: number;
  noBooking: number;
  unknown: number;       // "none"
  conversionPct: number; // confirmed / inquiries
  totalRevenueLkr: number;
  avgValueLkr: number;
};

export function computeStats(items: Conversion[]): ConversionStats {
  const totalCalls = items.length;
  let inquiries = 0, confirmed = 0, cancelled = 0, noBooking = 0, unknown = 0;
  let totalRevenueLkr = 0;
  let confirmedWithValue = 0;
  for (const c of items) {
    if (c.status === "confirmed") confirmed++;
    else if (c.status === "cancelled") cancelled++;
    else if (c.status === "no_booking") noBooking++;
    else if (c.status === "inquiry") inquiries++;
    else unknown++;
    // Confirmed AND inquiry both count as "had real intent" for the
    // conversion-rate denominator below.
    if (c.status === "confirmed" && c.valueLkr != null) {
      totalRevenueLkr += c.valueLkr;
      confirmedWithValue++;
    }
  }
  const intent = confirmed + inquiries + cancelled; // funnel base
  const conversionPct = intent > 0 ? Math.round((confirmed / intent) * 1000) / 10 : 0;
  const avgValueLkr = confirmedWithValue > 0 ? Math.round(totalRevenueLkr / confirmedWithValue) : 0;
  return {
    totalCalls,
    inquiries: confirmed + inquiries + cancelled, // total real-intent calls
    confirmed,
    cancelled,
    noBooking,
    unknown,
    conversionPct,
    totalRevenueLkr,
    avgValueLkr,
  };
}
