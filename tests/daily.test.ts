import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  createDailySession,
  loadDailySession,
  loadCurrentDailySession,
  localDay,
  saveDailySession,
  validateDailySession,
} from "../src/storage/daily";
import { openDatabase } from "../src/storage/database";
import { getCourse } from "../src/learning/content";
import type { LearningData } from "../src/learning/contracts";
import { advance, startRun } from "../src/learning/engine";
import { scheduleReviewTransition } from "../src/review/engine";

const empty: LearningData = { runs: [], attempts: [], completions: [] };
beforeEach(async () => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("dailySessions", "readwrite");
    tx.objectStore("dailySessions").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
});
it("builds a useful empty-queue plan with distinct versioned lesson and practice tasks", () => {
  const plan = createDailySession(
    empty,
    [],
    new Date(2026, 9, 10, 23, 59).getTime(),
  );
  expect(plan.day).toBe("2026-10-10");
  expect(plan.tasks.map((task) => task.kind)).toEqual(["lesson", "practice"]);
  expect(plan.tasks.map((task) => task.runId)).toEqual([
    `${plan.id}:0`,
    `${plan.id}:1`,
  ]);
  expect(
    plan.tasks.every(
      (task) => task.contentVersion === getCourse(task.courseId).version,
    ),
  ).toBe(true);
  expect(() => validateDailySession(plan)).not.toThrow();
  expect(localDay(new Date(2026, 9, 11, 0, 0).getTime())).toBe("2026-10-11");
});
it("commits one immutable plan per local day and restores the same run bindings", async () => {
  const plan = createDailySession(
    empty,
    [],
    new Date(2026, 9, 12, 10).getTime(),
  );
  await saveDailySession(plan);
  const replacement = structuredClone(plan);
  replacement.tasks[0].courseId = "king-activity";
  expect(await saveDailySession(replacement)).toEqual(plan);
  expect(await loadDailySession(plan.day)).toEqual(plan);
});
it("preserves malformed daily records and blocks replacement instead of resetting them", async () => {
  const plan = createDailySession(
    empty,
    [],
    new Date(2026, 9, 13, 10).getTime(),
  );
  const malformed = { ...plan, tasks: [] };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("dailySessions", "readwrite");
    tx.objectStore("dailySessions").put(malformed);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  await expect(loadDailySession(plan.day)).rejects.toThrow("preserved");
  await expect(saveDailySession(plan)).rejects.toThrow("preserved");
  const raw = await new Promise((resolve) => {
    const tx = db.transaction("dailySessions", "readonly"),
      read = tx.objectStore("dailySessions").get(plan.id);
    tx.oncomplete = () => resolve(read.result);
  });
  expect(raw).toEqual(malformed);
});
it("rejects unavailable content versions in saved daily tasks", () => {
  const plan = createDailySession(empty, [], 1000);
  plan.tasks[0].contentVersion = 99;
  expect(() => validateDailySession(plan)).toThrow("preserved");
});

it("restores an unfinished plan across midnight instead of stranding its run IDs", async () => {
  const day = new Date(2026, 10, 1, 23, 59).getTime();
  const plan = createDailySession(empty, [], day);
  await saveDailySession(plan);
  expect(
    await loadCurrentDailySession(
      localDay(new Date(2026, 10, 2, 0, 1).getTime()),
    ),
  ).toEqual(plan);
});

it("puts the relevant lesson first after repeated misses and retains due recall and targeted practice", () => {
  const source = advance(
    startRun(getCourse("starter-calculation"), 1000, "teaching"),
    { type: "hint" },
    2000,
  );
  const cards = scheduleReviewTransition([], source).map((card) => ({
    ...card,
    needsTeaching: true,
  }));
  const plan = createDailySession(empty, cards, 3000);
  expect(plan.tasks.map((task) => task.kind)).toEqual([
    "lesson",
    "review",
    "practice",
  ]);
  expect(plan.tasks.map((task) => task.courseId)).toEqual([
    "hanging-pieces",
    "review-loose-queen",
    "practice-loose-queen",
  ]);
});
