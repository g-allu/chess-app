import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import type { Square } from "chess.js";
import { getCourse, getExercise } from "../src/learning/content";
import { advance, runBoard, startRun } from "../src/learning/engine";
import { openDatabase } from "../src/storage/database";
import { commitLearning, loadLearning } from "../src/storage/learning";
import { loadReviewCards, saveReviewConfig } from "../src/storage/reviews";
import { defaultReviewConfig, scheduleAttempt } from "../src/review/engine";
import type { ReviewCard } from "../src/review/contracts";
import {
  branchCourses,
  branchExercises,
  branchTeachingCourse,
} from "../src/openings/training";
import { recommendedLesson } from "../src/storage/daily";

const move = (uci: string) => ({
  type: "move" as const,
  input: { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square },
});
beforeEach(async () => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...db.objectStoreNames], "readwrite");
    for (const name of db.objectStoreNames) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
});
it("saved branch courses recall their own legal history and connect repeated misses to teaching", () => {
  const session = branchCourses.find(
    (course) => course.id === "opening-branch-qgd-sideline",
  )!;
  expect(
    session.steps.every(
      (step) =>
        step.kind === "exercise" &&
        branchExercises.some((item) => item.id === step.exerciseId),
    ),
  ).toBe(true);
  const exercise = branchExercises.find(
    (item) =>
      item.id === (session.steps[0] as { exerciseId: string }).exerciseId,
  )!;
  const run = startRun(session, 1000, "branch");
  expect(
    runBoard(run)!
      .history({ verbose: true })
      .map((move) => move.lan),
  ).toEqual(exercise.history);
  expect(branchTeachingCourse(exercise.id)).toBe("opening-qgd");
  let cards: ReviewCard[] = [];
  for (let index = 0; index < 3; index++) {
    const hint = advance(
      { ...run, id: `encounter-${index}` },
      { type: "hint" },
      2000 + index,
    );
    cards = scheduleAttempt(cards, hint.attempt!, false);
  }
  expect(cards[0].needsTeaching).toBe(true);
  // A teaching recommendation must work for generated recall cards as well as authored exercises.
  expect(
    recommendedLesson({ runs: [], attempts: [], completions: [] }, cards).id,
  ).toBe("opening-qgd");
});
it("replays the original opening history rather than treating a FEN as a fresh game", () => {
  const exercise = getExercise("italian-guess");
  const run = startRun(getCourse("practice-italian-guess"), 1000, "history");
  expect(
    runBoard(run)!
      .history({ verbose: true })
      .map((move) => move.lan),
  ).toEqual(exercise.history);
  expect(runBoard(run)!.fen()).toBe(exercise.fen);
});
it("persists a sound repertoire deviation without a failure, card, or duplicate effect", async () => {
  const initial = startRun(
    getCourse("practice-italian-guess"),
    1000,
    "deviation",
  );
  await commitLearning({ run: initial });
  const choice = Object.keys(getExercise("italian-guess").deviations!)[0];
  const deviation = advance(initial, move(choice), 2000);
  expect(deviation.attempt?.outcome).toBe("deviation");
  expect(deviation.run.misses).toBe(0);
  expect(deviation.run.moves).toEqual([]);
  expect(deviation.run.feedback).toContain("not recorded as a chess mistake");
  await commitLearning(deviation);
  await commitLearning(deviation);
  expect((await loadLearning()).attempts).toEqual([deviation.attempt]);
  expect(await loadReviewCards()).toEqual([]);
  const alternative = getExercise("italian-guess").answers[1].line[0];
  const solved = advance(deviation.run, move(alternative), 3000);
  await commitLearning(solved);
  expect(solved.attempt?.firstUnassisted).toBe(true);
  const cards = await loadReviewCards();
  expect(cards).toHaveLength(1);
  expect(cards[0].totalFailures).toBe(0);
  expect(cards[0].sourceAttemptIds).toEqual([solved.attempt!.id]);
});
it("a deviation after an earlier card leaves its saved due date intact during backfill", async () => {
  const course = getCourse("practice-italian-guess");
  const first = startRun(course, 1000, "first");
  await commitLearning({ run: first });
  await commitLearning(advance(first, move("f3g5"), 2000));
  const before = await loadReviewCards();
  await saveReviewConfig({ ...defaultReviewConfig, failureDelayHours: 8 });
  const second = startRun(course, 3000, "second");
  await commitLearning({ run: second });
  await commitLearning(
    advance(
      second,
      move(Object.keys(getExercise("italian-guess").deviations!)[0]),
      4000,
    ),
  );
  expect(await loadReviewCards()).toEqual(before);
});
it("rejects a forged deviation record and schedules an actual error, then advances delayed recall", async () => {
  const initial = startRun(getCourse("practice-italian-guess"), 1000, "miss");
  await commitLearning({ run: initial });
  const wrong = advance(initial, move("f3g5"), 2000);
  expect(wrong.attempt?.outcome).toBe("wrong");
  await expect(
    commitLearning({
      ...wrong,
      attempt: { ...wrong.attempt!, outcome: "deviation" },
    }),
  ).rejects.toThrow();
  expect((await loadLearning()).attempts).toEqual([]);
  await commitLearning(wrong);
  const card = (await loadReviewCards())[0];
  expect(Date.parse(card.dueAt)).toBe(2000 + 4 * 60 * 60 * 1000);
  const review = startRun(
    getCourse("review-italian-guess"),
    Date.parse(card.dueAt),
    "review",
  );
  await commitLearning({ run: review });
  await commitLearning(
    advance(
      review,
      move(getExercise("italian-guess").answers[0].line[0]),
      Date.parse(card.dueAt),
    ),
  );
  const recalled = (await loadReviewCards())[0];
  expect(recalled.intervalIndex).toBe(0);
  expect(recalled.consecutiveFailures).toBe(0);
  expect(Date.parse(recalled.dueAt)).toBe(
    Date.parse(card.dueAt) + 24 * 60 * 60 * 1000,
  );
});
