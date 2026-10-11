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
    "learningRuns",
    "profiles",
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
