// Simple heuristic to catch obvious phone numbers in chat messages, so
// buyers/sellers keep contact on-platform rather than immediately jumping
// to text/call (which also takes them out of reach of dispute support).
// Not foolproof - a determined person can always write "five five five..."
// - but it blocks the common formats people actually type without thinking.
export function containsPhoneNumber(text: string): boolean {
  // Find runs of digits with only spaces/dashes/dots/parens as separators,
  // then check whether the run has at least 7 actual digits (the shortest
  // plausible local phone number length).
  const candidateRuns = text.match(/\d[\d\-.\s()]{5,}\d/g) || [];
  return candidateRuns.some((run) => (run.match(/\d/g) || []).length >= 7);
}
