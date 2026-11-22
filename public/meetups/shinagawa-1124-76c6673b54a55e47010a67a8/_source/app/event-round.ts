import type { Worksheet } from "./worksheet";

export type EventRound = 1 | 2 | 3 | 4;

export const roundLabels: Record<EventRound, string> = {
  1: "第1回・牧村さん",
  2: "第2回・宮代さん",
  3: "第3回・南さん",
  4: "全体対話",
};

const eventStart = Date.parse("2026-11-24T00:00:00+09:00");
const secondRound = Date.parse("2026-11-24T14:30:00+09:00");
const thirdRound = Date.parse("2026-11-24T15:30:00+09:00");
const plenary = Date.parse("2026-11-24T17:00:00+09:00");
const eventEnd = Date.parse("2026-11-25T00:00:00+09:00");

// Absolute instants keep the workshop clock independent of the device's time zone.
export function eventRoundAt(now: number = Date.now()): EventRound | null {
  if (!(now >= eventStart && now < eventEnd)) return null;
  if (now >= plenary) return 4;
  if (now >= thirdRound) return 3;
  if (now >= secondRound) return 2;
  return 1;
}

type RoundDraft = {
  round: EventRound;
  manualRoundSlot?: EventRound | null;
  text: string;
  context: string;
  parentId: string | null;
  worksheet?: Worksheet;
};

export function hasDraftWork(draft: Pick<RoundDraft, "text" | "context" | "parentId" | "worksheet">): boolean {
  return Boolean(draft.text.trim() || draft.context.trim() || draft.parentId || Object.values(draft.worksheet || {}).some(value => value?.trim()));
}

export function alignDraftRound<T extends RoundDraft>(draft: T, now: number = Date.now()): T {
  const current = eventRoundAt(now);
  if (!current || draft.round === current || draft.manualRoundSlot === current) return draft;
  if (hasDraftWork(draft)) return draft;
  return { ...draft, round: current, manualRoundSlot: null };
}
