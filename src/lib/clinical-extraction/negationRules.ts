/**
 * @deprecated FROZEN — ADR-001 (docs/ADR-001-pipeline-consolidation.md).
 * Clinical assertion is resolved by clinical_nlp (negation.py), which is
 * sentence-scoped with termination cues and the full A3 assertion vocabulary.
 * This 36-char-lookbehind module is a false-positive *and* false-negative
 * generator (audit C1) kept only as a legacy fallback. Do not import from
 * application code (enforced by eslint no-restricted-imports).
 */
import type { Segment } from "./types";

const negationTriggers = [
  "denies",
  "denied",
  "no",
  "not",
  "without",
  "w/o",
  "negative for"
];

export function isNegated(segment: Segment, mentionStart: number) {
  const localStart = Math.max(0, mentionStart - segment.start - 36);
  const localEnd = Math.max(0, mentionStart - segment.start);
  const before = segment.text.slice(localStart, localEnd).toLowerCase();
  return negationTriggers.some((trigger) => new RegExp(`(?:^|\\W)${escapeRegExp(trigger)}(?:$|\\W)`, "i").test(before));
}

export function isOrdered(segment: Segment, mentionStart: number) {
  const localStart = Math.max(0, mentionStart - segment.start - 28);
  const before = segment.text.slice(localStart, Math.max(0, mentionStart - segment.start)).toLowerCase();
  return /\b(ordered|order|obtain|check)\b/.test(before);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
