// Detect "handed over to a human agent" from call transcripts/summaries.
// Twilio has no status for transfers, so we look for telltale phrases the
// AI agent says when escalating. Conservative on purpose — only mark a call
// as a handover when the agent itself signals one, not when a customer
// simply asks for a human (request != actual transfer).

const HANDOVER_PATTERNS: RegExp[] = [
  /\b(transferring|transfer(?:ring)?\s+you)\b/i,
  /\b(connect(?:ing)?\s+you\s+(?:to|with)\s+(?:our|a|the)\s+(?:team|agent|human|representative|specialist|manager))\b/i,
  /\b(let\s+me\s+(?:get|put)\s+you\s+(?:through\s+)?to\s+(?:our|a|the))\b/i,
  /\b(handing\s+you\s+over\s+to\s+(?:our|a|the))\b/i,
  /\b(forward(?:ing)?\s+(?:this|the)\s+call\s+to)\b/i,
  /\b(escalat(?:e|ing)\s+(?:this|you)\s+to\s+(?:our|a|the))\b/i,
  /\b(please\s+hold\s+while\s+I\s+connect\s+you)\b/i,
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
