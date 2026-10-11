import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  DATABASE_NAME,
  loadLocalData,
  openDatabase,
  SCHEMA_VERSION,
} from "../src/storage/database";
import { commitLearning, loadLearning } from "../src/storage/learning";
import { getCourse } from "../src/learning/content";
import { startRun } from "../src/learning/engine";
import { advance } from "../src/learning/engine";
import { loadReviewCards } from "../src/storage/reviews";
import {
  commitOpeningProgress,
  loadOpeningProgress,
} from "../src/storage/openings";
import { initialOpeningProgress } from "../src/openings/progress";
import { openingChapters } from "../src/openings/content";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
async function seedV1(workspace: unknown, profile: unknown) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore("workspaces", { keyPath: "id" })
        .put(workspace);
      request.result
        .createObjectStore("profiles", { keyPath: "id" })
        .put(profile);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
it("upgrades a populated v1 database without resetting history or profile", async () => {
  const workspace = {
    id: "practice",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6"],
    cursor: 1,
    updatedAt: "2026-10-10T00:00:00.000Z",
  };
  const profile = {
    id: "local",
    name: "Existing learner",
    rating: 640,
    target: 1500,
  };
  await seedV1(workspace, profile);
  const db = await openDatabase();
  expect(db.version).toBe(SCHEMA_VERSION);
  expect([...db.objectStoreNames].sort()).toEqual([
    "attempts",
    "completions",
    "dailySessions",
    "learningRuns",
    "openingProgress",
    "profiles",
    "reviewCards",
    "reviewSettings",
    "workspaces",
  ]);
  expect(await loadLearning()).toEqual({
    runs: [],
    attempts: [],
    completions: [],
  });
  expect(await loadLocalData()).toEqual({ workspace, profile });
  await commitLearning({
    run: startRun(getCourse("starter-calculation"), 1000, "upgraded-run"),
  });
  expect(await loadLocalData()).toEqual({ workspace, profile });
  expect(await openDatabase()).toBe(db);
  expect((await loadLearning()).runs[0].id).toBe("upgraded-run");
});
it("upgrades populated v2 progress and backfills missed cards without changing immutable attempts", async () => {
  const initial = startRun(
    getCourse("starter-calculation"),
    1000,
    "v2-session",
  );
  const hint = advance(initial, { type: "hint" }, 2000);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      for (const name of [
        "workspaces",
        "profiles",
        "learningRuns",
        "attempts",
        "completions",
      ])
        request.result.createObjectStore(name, { keyPath: "id" });
      request.transaction!.objectStore("learningRuns").put(hint.run);
      request.transaction!.objectStore("attempts").put(hint.attempt!);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  const before = {
    runs: [hint.run],
    attempts: [hint.attempt],
    completions: [],
  };
  expect(await loadLearning()).toEqual(before);
  const cards = await loadReviewCards();
  expect(cards).toHaveLength(1);
  expect(cards[0].sourceAttemptIds).toEqual([hint.attempt!.id]);
  expect(cards[0].exerciseId).toBe("loose-queen");
  expect(await loadReviewCards()).toEqual(cards);
  expect(await loadLearning()).toEqual(before);
  expect((await openDatabase()).version).toBe(SCHEMA_VERSION);
});
it("preserves unreadable v1 history during the additive migration", async () => {
  const workspace = {
    id: "practice",
    moves: ["illegal"],
    cursor: 1,
    updatedAt: "2026-10-10T00:00:00.000Z",
  };
  const profile = {
    id: "local",
    name: "Existing learner",
    rating: 640,
    target: 1500,
  };
  await seedV1(workspace, profile);
  const db = await openDatabase();
  await expect(loadLocalData()).rejects.toThrow("preserved");
  const raw = await new Promise((resolve, reject) => {
    const tx = db.transaction(["workspaces", "profiles"], "readonly");
    const savedWorkspace = tx.objectStore("workspaces").get("practice"),
      savedProfile = tx.objectStore("profiles").get("local");
    tx.oncomplete = () =>
      resolve({
        workspace: savedWorkspace.result,
        profile: savedProfile.result,
      });
    tx.onerror = () => reject(tx.error);
  });
  expect(raw).toEqual({ workspace, profile });
  expect(db.version).toBe(SCHEMA_VERSION);
  expect(await loadLearning()).toEqual({
    runs: [],
    attempts: [],
    completions: [],
  });
});

it.each([1, 2, 3])(
  "adds opening progress to schema %s while preserving every existing store record",
  async (version) => {
    const storeNames = ["workspaces", "profiles"];
    if (version >= 2)
      storeNames.push("learningRuns", "attempts", "completions");
    if (version >= 3)
      storeNames.push("reviewCards", "reviewSettings", "dailySessions");
    const records = storeNames.map((name) => ({
      id: `retained-${name}`,
      originalSchema: version,
      payload: { untouched: true },
    }));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, version);
      request.onupgradeneeded = () => {
        storeNames.forEach((name, index) => {
          request.result
            .createObjectStore(name, { keyPath: "id" })
            .put(records[index]);
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const db = await openDatabase();
    expect(db.version).toBe(4);
    const opening = initialOpeningProgress(openingChapters[0].id, 1000);
    await commitOpeningProgress(opening);
    expect(await loadOpeningProgress()).toEqual([opening]);
    const retained = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(storeNames, "readonly");
      const requests = storeNames.map((name, index) =>
        tx.objectStore(name).get(records[index].id),
      );
      tx.oncomplete = () => resolve(requests.map((request) => request.result));
      tx.onerror = () => reject(tx.error);
    });
    expect(retained).toEqual(records);
  },
);
