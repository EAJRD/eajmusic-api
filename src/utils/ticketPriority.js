// Auto-priority for support tickets - the user never picks a priority
// (a self-reported "urgent" is not a reliable signal); it's derived from the
// ticket's category, with a keyword scan over the message as an escalation
// path for categories that read low-risk by default but describe something
// serious (e.g. "Other" mentioning a legal threat).
const CATEGORY_BASE_PRIORITY = {
  'Missing Royalties': 'high',
  'Takedown Request': 'high',
  'Account Issues': 'normal',
  General: 'normal',
  Other: 'low',
};

const URGENT_KEYWORDS = [
  'urgente', 'urgent', 'fraude', 'fraud', 'hackeo', 'hackearon', 'hacked',
  'robo', 'robaron', 'stolen', 'demanda', 'demandar', 'legal action', 'lawsuit',
  'copyright strike', 'suspendida', 'suspended', 'bloqueada', 'blocked',
  'no puedo acceder', "can't access", 'cannot access', 'perdí acceso', 'lost access',
];

export function computeTicketPriority(category, message) {
  const base = CATEGORY_BASE_PRIORITY[category] || 'normal';
  const text = `${message || ''}`.toLowerCase();
  if (URGENT_KEYWORDS.some((kw) => text.includes(kw))) return 'high';
  return base;
}
