import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import {
  DATABASE_NAME,
  SCHEMA_VERSION,
  defaultProfile,
  loadLocalData,
  newWorkspace,
  openDatabase,
  saveLocalData,
} from "../src/storage/database";
it("initializes a versioned database without requiring an account", async () => {
  const db = await openDatabase();
  expect(db.name).toBe(DATABASE_NAME);
  expect(db.version).toBe(SCHEMA_VERSION);
  expect(await loadLocalData()).toMatchObject({
    workspace: { moves: [], cursor: 0 },
    profile: defaultProfile,
  });
});
it("restores full move history, replay cursor, and local profile after a committed save", async () => {
  const workspace = {
    ...newWorkspace(),
    moves: ["e2e4", "e7e5", "g1f3"],
    cursor: 1,
  };
  const profile = { ...defaultProfile, name: "Alex", rating: 650 };
  await saveLocalData(workspace, profile);
  expect(await loadLocalData()).toEqual({ workspace, profile });
});
it("keeps existing records when opening the same schema", async () => {
  const before = await loadLocalData();
  await openDatabase();
  expect(await loadLocalData()).toEqual(before);
});
