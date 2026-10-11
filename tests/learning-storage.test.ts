import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  loadLocalData,
  saveLocalData,
  newWorkspace,
  defaultProfile,
} from "../src/storage/database";
import { commitLearning, loadLearning } from "../src/storage/learning";
import { courses, exercises, getCourse } from "../src/learning/content";
import { startRun, advance } from "../src/learning/engine";
import { validateContent } from "../src/learning/validation";
import type { Attempt, Course, Run } from "../src/learning/contracts";

beforeEach(async () => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...db.objectStoreNames], "readwrite");
    for (const name of db.objectStoreNames) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
});
async function seed() {
  const run = startRun(getCourse("starter-calculation"), 1000, "saved-session");
  await commitLearning({ run });
  return run;
}
async function put(name: string, record: unknown) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(name, "readwrite");
    tx.objectStore(name).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function raw(name: string, id: string) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, "readonly");
    const request = tx.objectStore(name).get(id);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}
it("persists progress and immutable attempts separately from free practice", async () => {
  const workspace = { ...newWorkspace(), moves: ["e2e4", "e7e5"], cursor: 1 };
  await saveLocalData(workspace, defaultProfile);
  const run = await seed();
  const hint = advance(run, { type: "hint" }, 2000);
  await commitLearning(hint);
  await commitLearning(hint);
  const restored = await loadLearning();
  expect(restored).toEqual({
    runs: [hint.run],
    attempts: [hint.attempt],
    completions: [],
  });
  expect((await loadLocalData()).workspace).toEqual(workspace);
  await expect(
    commitLearning(advance(run, { type: "retry" }, 3000)),
  ).rejects.toThrow("another tab");
  expect(await loadLearning()).toEqual(restored);
});
it("accepts reordered retry fields but rejects omitted or modified immutable events", async () => {
  const hint = advance(await seed(), { type: "hint" }, 2000);
  await commitLearning(hint);
  const reordered = {
    ...hint,
    run: Object.fromEntries(
      Object.entries(hint.run).reverse(),
    ) as unknown as Run,
  };
  await expect(commitLearning(reordered)).resolves.toBeUndefined();
  await expect(commitLearning({ run: hint.run })).rejects.toThrow("retry");
  await expect(
    commitLearning({ ...hint, attempt: { ...hint.attempt!, hints: 2 } }),
  ).rejects.toThrow("retry");
  expect((await loadLearning()).attempts).toEqual([hint.attempt]);
});
it("allows one concurrent revision and preserves the winning event atomically", async () => {
  const run = await seed();
  const changes = [
    advance(run, { type: "hint" }, 2000),
    advance(run, { type: "retry" }, 2000),
  ];
  const results = await Promise.allSettled(changes.map(commitLearning));
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  const winning =
    changes[results.findIndex((result) => result.status === "fulfilled")];
  expect(await loadLearning()).toEqual({
    runs: [winning.run],
    attempts: [winning.attempt],
    completions: [],
  });
});
it("rejects forged transitions and initial progress without inserting records", async () => {
  const run = await seed();
  const hint = advance(run, { type: "hint" }, 2000);
  await expect(commitLearning({ run: hint.run })).rejects.toThrow();
  await expect(
    commitLearning({
      ...hint,
      attempt: { ...hint.attempt!, stepId: "unknown-step" },
    }),
  ).rejects.toThrow("attempt");
  await expect(
    commitLearning({
      ...hint,
      attempt: { ...hint.attempt!, firstUnassisted: true },
    }),
  ).rejects.toThrow("attempt");
  await expect(
    commitLearning({ run: { ...run, id: "fake-start", hints: 1 } }),
  ).rejects.toThrow();
  expect(await loadLearning()).toEqual({
    runs: [run],
    attempts: [],
    completions: [],
  });
});
it("snapshots caller input before awaiting database access", async () => {
  const run = startRun(getCourse("starter-calculation"), 1000, "original-id");
  const saving = commitLearning({ run });
  run.id = "mutated-id";
  await saving;
  expect((await loadLearning()).runs[0].id).toBe("original-id");
});
it("saves completion once, protects terminal progress, and validates the completion", async () => {
  let run = startRun(getCourse("read-notation"), 1000, "saved-lesson");
  await commitLearning({ run });
  for (const type of ["next", "example", "next"] as const) {
    const change = advance(run, { type }, 2000);
    await commitLearning(change);
    run = change.run;
  }
  const correct = advance(
    run,
    { type: "move", input: { from: "g1", to: "f3" } },
    3000,
  );
  await commitLearning(correct);
  run = correct.run;
  const done = advance(run, { type: "next" }, 4000);
  await expect(
    commitLearning({
      ...done,
      completion: { ...done.completion!, exerciseCount: 2 },
    }),
  ).rejects.toThrow("completion");
  await commitLearning(done);
  await commitLearning(done);
  const data = await loadLearning();
  expect(data.completions).toEqual([done.completion]);
  expect(data.runs[0].completed).toBe(true);
  await expect(
    commitLearning({
      run: {
        ...done.run,
        revision: done.run.revision + 1,
        updatedAt: new Date(5000).toISOString(),
      },
    }),
  ).rejects.toThrow("transition");
  expect(await loadLearning()).toEqual(data);
});
it("keeps historical attempts valid after moving to another exercise", async () => {
  let run = await seed();
  const correct = advance(
    run,
    { type: "move", input: { from: "a1", to: "a2" } },
    2000,
  );
  await commitLearning(correct);
  run = correct.run;
  const next = advance(run, { type: "next" }, 3000);
  await commitLearning(next);
  expect((await loadLearning()).attempts).toEqual([correct.attempt]);
});
it("preserves malformed saved progress and prevents an overwrite", async () => {
  const run = await seed();
  const malformed = { ...run, revision: 100, index: 99 };
  await put("learningRuns", malformed);
  await expect(loadLearning()).rejects.toThrow("preserved");
  await expect(
    commitLearning(advance(run, { type: "hint" }, 2000)),
  ).rejects.toThrow("preserved");
  expect(await raw("learningRuns", run.id)).toEqual(malformed);
});
it.each(["fen", "version", "skills", "id", "move", "timestamp", "outcome"])(
  "preserves malformed saved attempt %s",
  async (kind) => {
    const hint = advance(await seed(), { type: "hint" }, 2000);
    await commitLearning(hint);
    const malformed: Attempt = structuredClone(hint.attempt!);
    if (kind === "fen") malformed.fen = exercises[1].fen;
    if (kind === "version") malformed.contentVersion = 99;
    if (kind === "skills") malformed.skills = ["notation"];
    if (kind === "id") malformed.id = "saved-session:999";
    if (kind === "move") malformed.move = "a1a2";
    if (kind === "timestamp") malformed.at = new Date(0).toISOString();
    if (kind === "outcome") {
      malformed.outcome = "wrong";
      malformed.move = "a1a2";
    }
    await put("attempts", malformed);
    await expect(loadLearning()).rejects.toThrow("preserved");
    await expect(
      commitLearning(advance(hint.run, { type: "retry" }, 3000)),
    ).rejects.toThrow("preserved");
    expect(await raw("attempts", malformed.id)).toEqual(malformed);
    expect(await raw("learningRuns", hint.run.id)).toEqual(hint.run);
  },
);
describe("content shape and course structure", () => {
  it.each(["skills", "hint", "answer", "captions", "terminal", "session"])(
    "rejects invalid %s content",
    (kind) => {
      const es = structuredClone(exercises),
        cs = structuredClone(courses);
      if (kind === "skills") es[0].skills = ["piece-safety", "piece-safety"];
      if (kind === "hint") es[0].hints = [" "];
      if (kind === "answer") es[0].answers[0].line = [];
      if (kind === "captions") {
        const example = cs[0].steps.find((step) => step.kind === "example")!;
        if (example.kind === "example") example.captions = [];
      }
      if (kind === "terminal")
        cs[0].steps.push({
          id: "invalid-last",
          kind: "explanation",
          title: "End",
          text: "End",
        });
      if (kind === "session") cs[0].kind = "session";
      expect(() => validateContent(es, cs)).toThrow();
    },
  );
  it("rejects malformed array fields with useful validation errors", () => {
    const cs = structuredClone(courses);
    (cs[0] as unknown as { steps: null }).steps = null;
    expect(() => validateContent(exercises, cs)).toThrow("Invalid course");
    expect(() => validateContent(exercises, [] as Course[])).toThrow(
      "Missing learning content",
    );
  });
});
