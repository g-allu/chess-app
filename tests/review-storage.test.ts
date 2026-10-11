import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { openDatabase } from "../src/storage/database";
import { commitLearning, loadLearning } from "../src/storage/learning";
import {
  loadReviewCards,
  loadReviewConfig,
  saveReviewConfig,
} from "../src/storage/reviews";
import { defaultReviewConfig } from "../src/review/engine";
import { getCourse } from "../src/learning/content";
import { advance, startRun } from "../src/learning/engine";

beforeEach(async () => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...db.objectStoreNames], "readwrite");
    for (const name of db.objectStoreNames) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
});
async function put(name: string, record: unknown) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(name, "readwrite");
    tx.objectStore(name).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function raw(name: string) {
  const db = await openDatabase();
  return new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(name, "readonly"),
      request = tx.objectStore(name).getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function seed(id = "source") {
  const run = startRun(getCourse("starter-calculation"), 1000, id);
  await commitLearning({ run });
  return run;
}

it("commits a missed attempt and its card together, and duplicate retries do not change either", async () => {
  const hint = advance(await seed(), { type: "hint" }, 2000);
  await commitLearning(hint);
  const cards = await loadReviewCards(),
    data = await loadLearning();
  expect(cards).toHaveLength(1);
  expect(cards[0].sourceAttemptIds).toEqual([hint.attempt!.id]);
  await commitLearning(hint);
  expect(await loadReviewCards()).toEqual(cards);
  expect(await loadLearning()).toEqual(data);
});
it("protects cards when a competing tab loses the revision check", async () => {
  const initial = await seed();
  const changes = [
    advance(initial, { type: "hint" }, 2000),
    advance(initial, { type: "retry" }, 2000),
  ];
  const results = await Promise.allSettled(changes.map(commitLearning));
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const data = await loadLearning(),
    cards = await loadReviewCards();
  expect(data.attempts).toHaveLength(1);
  expect(cards[0].sourceAttemptIds).toEqual([data.attempts[0].id]);
});
it("aborts all learning/card effects when persisted settings are invalid", async () => {
  const initial = await seed();
  const invalid = {
    id: "local",
    schemaVersion: 1,
    config: { ...defaultReviewConfig, newCardsPerDay: 0 },
  };
  await put("reviewSettings", invalid);
  await expect(
    commitLearning(advance(initial, { type: "hint" }, 2000)),
  ).rejects.toThrow("settings");
  expect((await loadLearning()).runs).toEqual([initial]);
  expect(await raw("attempts")).toEqual([]);
  expect(await raw("reviewCards")).toEqual([]);
  expect(await raw("reviewSettings")).toEqual([invalid]);
});
it("preserves malformed review cards and blocks new writes", async () => {
  const hint = advance(await seed(), { type: "hint" }, 2000);
  await commitLearning(hint);
  const card = (await loadReviewCards())[0];
  const malformed = { ...card, sourceAttemptIds: ["missing-attempt"] };
  await put("reviewCards", malformed);
  await expect(loadReviewCards()).rejects.toThrow("preserved");
  await expect(
    commitLearning(advance(hint.run, { type: "retry" }, 3000)),
  ).rejects.toThrow("preserved");
  expect(await raw("reviewCards")).toEqual([malformed]);
  expect((await loadLearning()).attempts).toEqual([hint.attempt]);
});
it("persists configurable review intervals and rejects invalid settings without overwriting", async () => {
  const config = {
    ...defaultReviewConfig,
    intervalDays: [2, 5, 10],
    failureDelayHours: 2,
    newCardsPerDay: 2,
  };
  await saveReviewConfig(config);
  expect(await loadReviewConfig()).toEqual(config);
  await expect(
    saveReviewConfig({ ...config, intervalDays: [2, 1] }),
  ).rejects.toThrow("settings");
  expect(await loadReviewConfig()).toEqual(config);
  const correct = advance(
    await seed(),
    { type: "move", input: { from: "a1", to: "a2" } },
    2000,
  );
  await commitLearning(correct);
  expect((await loadReviewCards())[0].dueAt).toBe(
    new Date(2000 + 2 * 86400000).toISOString(),
  );
});
it("backfills historical multi-move attempts only when the final answer was solved", async () => {
  let run = await seed();
  for (const input of [
    { from: "a1", to: "a2" },
    { from: "d2", to: "g5" },
    { from: "f7", to: "g7" },
  ]) {
    const correct = advance(
      run,
      { type: "move", input: input as { from: "a1"; to: "a2" } },
      Date.parse(run.updatedAt) + 1000,
    );
    await commitLearning(correct);
    run = correct.run;
    const next = advance(
      run,
      { type: "next" },
      Date.parse(run.updatedAt) + 1000,
    );
    await commitLearning(next);
    run = next.run;
  }
  const first = advance(
    run,
    { type: "move", input: { from: "e5", to: "f7" } },
    Date.parse(run.updatedAt) + 1000,
  );
  await commitLearning(first);
  expect(
    (await loadReviewCards()).some((card) => card.exerciseId === "knight-fork"),
  ).toBe(false);
  const last = advance(
    first.run,
    { type: "move", input: { from: "f7", to: "d8" } },
    Date.parse(first.run.updatedAt) + 1000,
  );
  await commitLearning(last);
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("reviewCards", "readwrite");
    tx.objectStore("reviewCards").clear();
    tx.oncomplete = () => resolve();
  });
  const fork = (await loadReviewCards()).find(
    (card) => card.exerciseId === "knight-fork",
  )!;
  expect(fork.sourceAttemptIds).toEqual([last.attempt!.id]);
  expect(fork.totalFailures).toBe(0);
});
it("retains active review progress through reload and advances only the solved recall", async () => {
  const initial = await seed();
  const learned = advance(
    initial,
    { type: "move", input: { from: "a1", to: "a2" } },
    2000,
  );
  await commitLearning(learned);
  const due = Date.parse((await loadReviewCards())[0].dueAt);
  const review = startRun(
    getCourse("review-loose-queen"),
    due,
    "review-session",
  );
  await commitLearning({ run: review });
  const restored = (await loadLearning()).runs.find(
    (run) => run.id === review.id,
  )!;
  expect(restored).toEqual(review);
  const recall = advance(
    restored,
    { type: "move", input: { from: "a1", to: "a2" } },
    due + 1000,
  );
  await commitLearning(recall);
  const cards = await loadReviewCards();
  expect(cards[0].intervalIndex).toBe(0);
  expect(cards[0].lastReviewedAt).toBe(recall.attempt!.at);
  const completion = advance(recall.run, { type: "next" }, due + 2000);
  await commitLearning(completion);
  await commitLearning(completion);
  expect(await loadReviewCards()).toEqual(cards);
  expect(
    (await loadLearning()).completions.filter(
      (item) => item.courseId === "review-loose-queen",
    ),
  ).toHaveLength(1);
});
it("preserves older missed history when a fresh attempt first creates its missing card", async () => {
  const initial = await seed();
  const hint = advance(initial, { type: "hint" }, 2000);
  await commitLearning(hint);
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("reviewCards", "readwrite");
    tx.objectStore("reviewCards").clear();
    tx.oncomplete = () => resolve();
  });
  const second = startRun(
    getCourse("starter-calculation"),
    3000,
    "later-source",
  );
  await commitLearning({ run: second });
  const correct = advance(
    second,
    { type: "move", input: { from: "a1", to: "a2" } },
    4000,
  );
  await commitLearning(correct);
  const cards = await loadReviewCards();
  expect(cards[0].sourceAttemptIds).toEqual([
    hint.attempt!.id,
    correct.attempt!.id,
  ]);
  expect(cards[0].createdAt).toBe(hint.attempt!.at);
  expect(cards[0].totalFailures).toBe(1);
  expect(await loadReviewCards()).toEqual(cards);
});
