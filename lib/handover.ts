// Detect "handed over to a human agent" from call transcripts/summaries.
// Twilio has no status for transfers, so we look for telltale phrases the
// AI agent says when escalating. Conservative on purpose — only mark a call
// as a handover when the agent itself signals one, not when a customer
// simply asks for a human (request != actual transfer).

// Broadened to catch real-world transfer phrasing. We look for the AI
// agent's action verb in context of "you / this call / the call / your call"
// so customer requests like "can I speak to a human?" don't false-positive.
const HANDOVER_PATTERNS: RegExp[] = [
  // "transfer you / transferring this call / transferred your call"
  /\btransfer(?:r?ing|red|s)?\s+(?:you|this|the|your)\b/i,
  // "transferred to / transferring to ..." (common in summary fields)
  /\btransfer(?:r?ing|red)?\s+to\s+(?:our|a|the|my|reception|the\s+front|front\s+desk|reservations|booking|sales|support|manager|team|agent|human|representative|specialist|colleague|staff)\b/i,
  // "connect(ing) you to/with"
  /\bconnect(?:ing|ed)?\s+you\b/i,
  // "hand(ing/ed) (you) over/off" / "handoff"
  /\bhand(?:ing|ed)?\s+(?:you\s+)?(?:over|off)\b/i,
  /\bhand[\s-]?off\b/i,
  // "forward(ing/ed) this/the/your call"
  /\bforward(?:ing|ed)?\s+(?:this|the|your)?\s*call\b/i,
  // "escalat(e/ing/ed) this/you/the call/your call"
  /\bescalat(?:e|ing|ed)\s+(?:this|you|the\s+call|your\s+call)\b/i,
  // "passing you to/through"
  /\bpassing\s+you\b/i,
  // "put(ting) you through"
  /\bput(?:ting)?\s+you\s+through\b/i,
  // "redirect(ing) you"
  /\bredirect(?:ing|ed)?\s+you\b/i,
  // "let me get/transfer/connect/put/pass/hand you (over) (to)"
  /\blet\s+me\s+(?:get|transfer|connect|put|pass|hand)\s+you\b/i,
  // "I'll / I will  transfer/connect/hand/forward/pass/put/get/redirect you"
  /\bI(?:'ll|\s+will|\s+am\s+going\s+to|'m\s+going\s+to)\s+(?:transfer|connect|hand|forward|pass|put|get|redirect)\s+you\b/i,
  // "please hold while I connect/transfer you"
  /\bplease\s+hold\s+while\s+I\s+(?:transfer|connect|put|pass|get|redirect|forward)\b/i,
  // Summary/action-items phrasing: "Call was transferred / Customer was transferred / Handed off to"
  /\b(?:was|got|been)\s+(?:transferred|handed\s+off|handed\s+over|forwarded|connected|redirected|escalated)\b/i,
  // "transferred to a human agent / human / live agent / real agent"
  /\btransferred\s+to\s+(?:a\s+)?(?:human|live|real)\s+(?:agent|person|representative)\b/i,
  // "speak with one of our / talk to one of our / speak to our team / our team"
  /\bspeak\s+(?:with|to)\s+(?:one\s+of\s+our|our)\s+(?:team|agent|representative|manager|specialist|colleague|staff|members?)\b/i,
];

export function isHandoverText(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const re of HANDOVER_PATTERNS) if (re.test(text)) return true;
  return false;
}

export type HandoverSignals = {
  transcript?: string | null;
  summary?: string | null;
  action_items?: string | null;
};

export function isHandoverCall(s: HandoverSignals | null | undefined): boolean {
  if (!s) return false;
  return isHandoverText(s.transcript) || isHandoverText(s.summary) || isHandoverText(s.action_items);
}

export const HANDOVER_OUTCOME = "Handed over";
