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
