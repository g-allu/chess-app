import type { Attempt, Transition } from "../learning/contracts";
import type { ReviewCard, ReviewConfig } from "./contracts";

export const defaultReviewConfig: ReviewConfig = {
  intervalDays: [1, 3, 7, 14, 30],
  failureDelayHours: 4,
  newCardsPerDay: 5,
  maxDuePerSession: 10,
  teachingAfterFailures: 3,
};
const DAY = 24 * 60 * 60 * 1000;
const iso = (now: number) => new Date(now).toISOString();
export const reviewCardId = (exerciseId: string, version: number) =>
  `${exerciseId}:v${version}:move-recall`;

export function validateReviewConfig(config: ReviewConfig): void {
  if (
    !config ||
    !Array.isArray(config.intervalDays) ||
    !config.intervalDays.length ||
    config.intervalDays.some(
      (days, i) =>
        !Number.isFinite(days) ||
        days <= 0 ||
        (i > 0 && days <= config.intervalDays[i - 1]),
    ) ||
    !Number.isFinite(config.failureDelayHours) ||
    config.failureDelayHours <= 0 ||
    [
      config.newCardsPerDay,
      config.maxDuePerSession,
      config.teachingAfterFailures,
    ].some((value) => !Number.isInteger(value) || value < 1)
  )
    throw new Error("Invalid review settings");
}

function localDay(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function admission(
  cards: ReviewCard[],
  now: number,
  config: ReviewConfig,
): number {
  let day = now;
  while (
    cards.filter(
      (card) => localDay(Date.parse(card.admittedAt)) === localDay(day),
    ).length >= config.newCardsPerDay
  ) {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    day = next.getTime();
  }
  return day;
}

/** Pure scheduling; storage commits this alongside the immutable source attempt. */
export function scheduleAttempt(
  cards: ReviewCard[],
  attempt: Attempt,
  solved: boolean,
  config: ReviewConfig = defaultReviewConfig,
): ReviewCard[] {
  validateReviewConfig(config);
  if (attempt.outcome === "deviation") return cards;
  // An intermediate correct move is not a recall result.
  if (attempt.outcome === "correct" && !solved) return cards;
  const id = reviewCardId(attempt.exerciseId, attempt.contentVersion);
  const previous = cards.find((card) => card.id === id);
  if (previous?.sourceAttemptIds.includes(attempt.id)) return cards;
  const now = Date.parse(attempt.at);
  if (!Number.isFinite(now)) throw new Error("Invalid review timestamp");
  const admittedAt = previous
    ? Date.parse(previous.admittedAt)
    : admission(cards, now, config);
  const card: ReviewCard = previous
    ? structuredClone(previous)
    : {
        schemaVersion: 1,
        id,
        exerciseId: attempt.exerciseId,
        contentVersion: attempt.contentVersion,
        skills: [...attempt.skills],
        evidence: "move-recall",
        sourceAttemptIds: [],
        failedRunIds: [],
        createdAt: attempt.at,
        admittedAt: iso(admittedAt),
        updatedAt: attempt.at,
        dueAt: iso(Math.max(admittedAt, now + config.intervalDays[0] * DAY)),
        intervalIndex: -1,
        consecutiveFailures: 0,
        totalFailures: 0,
        needsTeaching: false,
        lastReviewedAt: null,
      };
  card.sourceAttemptIds.push(attempt.id);
  card.updatedAt = attempt.at;
  const unassisted = attempt.outcome === "correct" && attempt.firstUnassisted;
  if (!unassisted) {
    // Multiple wrong moves/hints in one encounter count as one failed encounter.
    if (!card.failedRunIds.includes(attempt.runId)) {
      card.failedRunIds.push(attempt.runId);
      card.totalFailures++;
      card.consecutiveFailures++;
    }
    card.intervalIndex = -1;
    card.dueAt = iso(
      Math.max(admittedAt, now + config.failureDelayHours * 60 * 60 * 1000),
    );
    card.needsTeaching =
      card.consecutiveFailures >= config.teachingAfterFailures;
  } else if (
    attempt.courseId === `review-${attempt.exerciseId}` &&
    previous &&
    now >= Date.parse(previous.dueAt)
  ) {
    card.intervalIndex = Math.min(
      card.intervalIndex + 1,
      config.intervalDays.length - 1,
    );
    card.dueAt = iso(now + config.intervalDays[card.intervalIndex] * DAY);
    card.consecutiveFailures = 0;
    card.needsTeaching = false;
    card.lastReviewedAt = attempt.at;
  }
  return [...cards.filter((item) => item.id !== id), card];
}

export function scheduleReviewTransition(
  cards: ReviewCard[],
  change: Transition,
  config = defaultReviewConfig,
): ReviewCard[] {
  return change.attempt
    ? scheduleAttempt(cards, change.attempt, change.run.solved, config)
    : cards;
}

export function getDueCards(
  cards: ReviewCard[],
  now = Date.now(),
  limit = defaultReviewConfig.maxDuePerSession,
): ReviewCard[] {
  return cards
    .filter(
      (card) =>
        Date.parse(card.dueAt) <= now && Date.parse(card.admittedAt) <= now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, limit));
}

export function getReviewQueue(
  cards: ReviewCard[],
  now = Date.now(),
  config = defaultReviewConfig,
) {
  const due = getDueCards(cards, now, cards.length);
  return {
    cards: due.slice(0, config.maxDuePerSession),
    totalDue: due.length,
    backlog: Math.max(0, due.length - config.maxDuePerSession),
    teaching: due.filter((card) => card.needsTeaching).length,
  };
}
