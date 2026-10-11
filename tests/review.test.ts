import { describe, expect, it } from "vitest";
import type { Attempt } from "../src/learning/contracts";
import { getCourse } from "../src/learning/content";
import { advance, startRun } from "../src/learning/engine";
import {
  defaultReviewConfig,
  getDueCards,
  getReviewQueue,
  scheduleAttempt,
  scheduleReviewTransition,
} from "../src/review/engine";
import type { ReviewCard } from "../src/review/contracts";

const now = Date.parse("2026-10-11T12:00:00Z"),
  DAY = 86400000;
function attempt(
  index: number,
  at: number,
  outcome: Attempt["outcome"] = "correct",
  extra: Partial<Attempt> = {},
): Attempt {
  return {
    schemaVersion: 1,
    id: `run-${index}:1`,
    runId: `run-${index}`,
    courseId: "starter-calculation",
    exerciseId: "loose-queen",
    contentVersion: 1,
    stepId: "position-1",
    skills: ["piece-safety"],
    at: new Date(at).toISOString(),
    outcome,
    fen: "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1",
    hints: 0,
    firstUnassisted: outcome === "correct",
    ...extra,
  };
}
function card(): ReviewCard {
  return scheduleAttempt([], attempt(0, now), true)[0];
}

it("advances delayed unassisted reviews through 1/3/7/14/30 days and holds the final interval", () => {
  let cards = [card()];
  let at = Date.parse(cards[0].dueAt);
  for (const [index, days] of [1, 3, 7, 14, 30, 30].entries()) {
    cards = scheduleAttempt(
      cards,
      attempt(index + 1, at, "correct", { courseId: "review-loose-queen" }),
      true,
    );
    expect(Date.parse(cards[0].dueAt)).toBe(at + days * DAY);
    expect(cards[0].intervalIndex).toBe(Math.min(index, 4));
    expect(cards[0].lastReviewedAt).toBe(new Date(at).toISOString());
    expect(getDueCards(cards, at)).toEqual([]);
    at = Date.parse(cards[0].dueAt);
  }
});
it("does not advance a card for an early review or a solved ordinary practice run", () => {
  const cards = [card()];
  expect(
    scheduleAttempt(
      cards,
      attempt(1, now + 1000, "correct", { courseId: "review-loose-queen" }),
      true,
    )[0].dueAt,
  ).toBe(cards[0].dueAt);
  expect(
    scheduleAttempt(cards, attempt(2, now + DAY), true)[0].intervalIndex,
  ).toBe(-1);
});
it.each(["wrong", "hint", "retry", "timeout"] as const)(
  "schedules %s for a shorter 4-hour recall",
  (outcome) => {
    const cards = scheduleAttempt([], attempt(0, now, outcome), false);
    expect(cards[0].dueAt).toBe(new Date(now + 4 * 3600000).toISOString());
    expect(cards[0].consecutiveFailures).toBe(1);
    expect(cards[0].evidence).toBe("move-recall");
    expect(cards[0]).not.toHaveProperty("planUnderstanding");
  },
);
it("assisted final success resets the interval and preserves failure history", () => {
  const wrong = attempt(1, now, "wrong");
  let cards = scheduleAttempt([card()], wrong, false);
  cards = scheduleAttempt(
    cards,
    attempt(1, now + 1000, "correct", {
      id: "run-1:2",
      firstUnassisted: false,
      hints: 1,
    }),
    true,
  );
  expect(cards[0].totalFailures).toBe(1);
  expect(cards[0].intervalIndex).toBe(-1);
  expect(Date.parse(cards[0].dueAt)).toBe(now + 1000 + 4 * 3600000);
});
it("counts failed encounters once per run and recommends teaching after three", () => {
  let cards: ReviewCard[] = [];
  for (let run = 0; run < 3; run++) {
    cards = scheduleAttempt(
      cards,
      attempt(run, now + run * DAY, "hint"),
      false,
    );
    cards = scheduleAttempt(
      cards,
      attempt(run, now + run * DAY + 1000, "wrong", { id: `run-${run}:2` }),
      false,
    );
  }
  expect(cards[0].totalFailures).toBe(3);
  expect(cards[0].needsTeaching).toBe(true);
  cards = scheduleAttempt(
    cards,
    attempt(4, Date.parse(cards[0].dueAt), "correct", {
      courseId: "review-loose-queen",
    }),
    true,
  );
  expect(cards[0].consecutiveFailures).toBe(0);
  expect(cards[0].totalFailures).toBe(3);
  expect(cards[0].needsTeaching).toBe(false);
});
it("keeps a single deterministic card per exercise version and makes duplicate attempts idempotent", () => {
  const source = attempt(0, now, "hint");
  const cards = scheduleAttempt([], source, false);
  expect(scheduleAttempt(cards, source, false)).toBe(cards);
  const changed = scheduleAttempt(cards, attempt(1, now + DAY, "wrong"), false);
  expect(changed).toHaveLength(1);
  expect(changed[0].sourceAttemptIds).toEqual([source.id, "run-1:1"]);
  expect(
    scheduleAttempt(
      changed,
      attempt(2, now + DAY, "wrong", { contentVersion: 2 }),
      false,
    ),
  ).toHaveLength(2);
});
it("waits for the final correct follow-up of a multi-move exercise", () => {
  let run = startRun(getCourse("starter-calculation"), now, "multi");
  // Seek the fork position using its preceding single-move answers.
  for (const input of [
    { from: "a1", to: "a2" },
    { from: "d2", to: "g5" },
    { from: "f7", to: "g7" },
  ]) {
    run = advance(
      run,
      { type: "move", input: input as { from: "a1"; to: "a2" } },
      now,
    ).run;
    run = advance(run, { type: "next" }, now).run;
  }
  const first = advance(
    run,
    { type: "move", input: { from: "e5", to: "f7" } },
    now,
  );
  expect(first.run.solved).toBe(false);
  expect(scheduleReviewTransition([], first)).toEqual([]);
  const final = advance(
    first.run,
    { type: "move", input: { from: "f7", to: "d8" } },
    now + 1000,
  );
  expect(final.run.solved).toBe(true);
  expect(scheduleReviewTransition([], final)).toHaveLength(1);
});
it("caps daily admissions and due backlogs without discarding cards", () => {
  let cards: ReviewCard[] = [];
  const config = {
    ...defaultReviewConfig,
    newCardsPerDay: 2,
    maxDuePerSession: 2,
  };
  for (let index = 0; index < 7; index++)
    cards = scheduleAttempt(
      cards,
      attempt(index, now, "wrong", { exerciseId: `exercise-${index}` }),
      false,
      config,
    );
  expect(cards).toHaveLength(7);
  expect(
    cards.filter((item) => item.admittedAt === new Date(now).toISOString()),
  ).toHaveLength(2);
  const queue = getReviewQueue(cards, now + 10 * DAY, config);
  expect(queue.cards).toHaveLength(2);
  expect(queue.totalDue).toBe(7);
  expect(queue.backlog).toBe(5);
});
it("uses exact due boundaries and configured intervals with deterministic overdue ordering", () => {
  const config = { ...defaultReviewConfig, intervalDays: [2, 5] };
  const cards = scheduleAttempt([], attempt(0, now), true, config);
  expect(getDueCards(cards, now + 2 * DAY - 1)).toEqual([]);
  expect(getDueCards(cards, now + 2 * DAY)).toEqual(cards);
  const second = {
    ...cards[0],
    id: "second",
    dueAt: new Date(now + DAY).toISOString(),
  };
  expect(
    getDueCards([cards[0], second], now + 30 * DAY).map((item) => item.id),
  ).toEqual(["second", cards[0].id]);
});
