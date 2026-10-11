import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { openingChapters } from "../src/openings/content";
import {
  changeOpeningProgress,
  initialOpeningProgress,
  type OpeningProgress,
} from "../src/openings/progress";
import {
  commitOpeningProgress,
  loadOpeningProgress,
} from "../src/storage/openings";
import {
  defaultProfile,
  loadLocalData,
  newWorkspace,
  openDatabase,
  saveLocalData,
} from "../src/storage/database";

const chapter = openingChapters[0];
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
  const initial = initialOpeningProgress(chapter.id, 1000);
  await commitOpeningProgress(initial);
  return initial;
}
async function raw() {
  const db = await openDatabase();
  return new Promise<OpeningProgress[]>((resolve, reject) => {
    const tx = db.transaction("openingProgress", "readonly");
    const request = tx.objectStore("openingProgress").getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function put(record: unknown) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("openingProgress", "readwrite");
    tx.objectStore("openingProgress").put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function answer(
  previous: OpeningProgress,
  kind: "plan" | "recognition",
  correct: boolean,
  now: number,
) {
  const question = (
    kind === "plan" ? chapter.planQuestions : chapter.recognition
  )[0];
  return changeOpeningProgress(
    previous,
    {
      type: "answer",
      kind,
      questionId: question.id,
      choiceId: question.choices.find((choice) => choice.correct === correct)!
        .id,
    },
    now,
  );
}

it("restores study position and repertoire separately from free practice", async () => {
  const workspace = { ...newWorkspace(), moves: ["e2e4"], cursor: 1 };
  await saveLocalData(workspace, defaultProfile);
  let progress = await seed();
  progress = changeOpeningProgress(
    progress,
    { type: "study", pathId: chapter.paths[1].id, cursor: 3 },
    2000,
  );
  await commitOpeningProgress(progress);
  progress = changeOpeningProgress(
    progress,
    { type: "repertoire", pathId: chapter.paths[0].id },
    3000,
  );
  await commitOpeningProgress(progress);
  expect(await loadOpeningProgress()).toEqual([progress]);
  expect(progress.pathId).toBe(chapter.paths[1].id);
  expect(progress.cursor).toBe(3);
  expect(progress.repertoirePathId).toBe(chapter.paths[0].id);
  expect(progress.answers).toEqual([]);
  expect((await loadLocalData()).workspace).toEqual(workspace);
});
it("records every wrong and correct plan/recognition submission without inferring mastery", async () => {
  let progress = await seed();
  for (const [kind, correct] of [
    ["plan", false],
    ["plan", true],
    ["recognition", false],
    ["recognition", true],
  ] as const) {
    progress = answer(
      progress,
      kind,
      correct,
      Date.parse(progress.updatedAt) + 1000,
    );
    await commitOpeningProgress(progress);
    await commitOpeningProgress(progress);
  }
  expect(
    (await loadOpeningProgress())[0].answers.map((entry) => [
      entry.kind,
      entry.correct,
    ]),
  ).toEqual([
    ["plan", false],
    ["plan", true],
    ["recognition", false],
    ["recognition", true],
  ]);
  expect(progress.cursor).toBe(0);
  expect(progress.repertoirePathId).toBeNull();
  expect(progress).not.toHaveProperty("mastered");
});
it("accepts reordered retries and rejects stale competing revisions", async () => {
  const initial = await seed();
  const changes = [
    changeOpeningProgress(
      initial,
      { type: "study", pathId: chapter.paths[0].id, cursor: 1 },
      2000,
    ),
    answer(initial, "plan", true, 2000),
  ];
  const results = await Promise.allSettled(changes.map(commitOpeningProgress));
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  const winning =
    changes[results.findIndex((result) => result.status === "fulfilled")];
  const reordered = Object.fromEntries(
    Object.entries(winning).reverse(),
  ) as unknown as OpeningProgress;
  await expect(commitOpeningProgress(reordered)).resolves.toBeUndefined();
  expect(await loadOpeningProgress()).toEqual([winning]);
});
it("rejects forged initial records, combined transitions, and edited historical evidence", async () => {
  const initial = await seed();
  const answered = answer(initial, "plan", false, 2000);
  await commitOpeningProgress(answered);
  const correct = answer(answered, "plan", true, 3000);
  const modified = structuredClone(correct);
  modified.answers[0] = {
    ...correct.answers[1],
    id: correct.answers[0].id,
    at: correct.answers[0].at,
  };
  await expect(commitOpeningProgress(modified)).rejects.toThrow(
    "modified answer evidence",
  );
  await expect(
    commitOpeningProgress({ ...correct, cursor: 1 }),
  ).rejects.toThrow("transition");
  await expect(
    commitOpeningProgress({ ...initial, cursor: 1 }),
  ).rejects.toThrow("initial");
  expect(await loadOpeningProgress()).toEqual([answered]);
});
it("snapshots input before awaiting storage and keeps pure helper evidence isolated", async () => {
  const initial = initialOpeningProgress(chapter.id, 1000);
  const saving = commitOpeningProgress(initial);
  initial.chapterId = "changed-by-caller";
  await saving;
  expect((await loadOpeningProgress())[0].chapterId).toBe(chapter.id);
  const before = answer((await loadOpeningProgress())[0], "plan", false, 2000);
  const after = answer(before, "recognition", true, 3000);
  after.answers[0].choiceId = "mutated";
  expect(before.answers[0].choiceId).not.toBe("mutated");
});
it("rejects an interrupted transaction without reporting or retaining a successful save", async () => {
  const previous = await seed();
  const next = answer(previous, "plan", true, 2000);
  const originalPut = IDBObjectStore.prototype.put;
  const spy = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const request = originalPut.call(this, value, key);
      this.transaction.abort();
      return request;
    });
  try {
    await expect(commitOpeningProgress(next)).rejects.toThrow("not saved");
  } finally {
    spy.mockRestore();
  }
  expect(await loadOpeningProgress()).toEqual([previous]);
});
it.each([
  "chapter",
  "schema",
  "version",
  "path",
  "cursor",
  "repertoire",
  "model-repertoire",
  "revision",
  "timestamp",
  "question",
  "choice",
  "kind",
  "correct",
  "answer-id",
  "answer-time",
])(
  "preserves invalid stored %s and blocks all opening writes",
  async (kind) => {
    const previous = answer(await seed(), "plan", false, 2000);
    await commitOpeningProgress(previous);
    const malformed = structuredClone(previous);
    if (kind === "chapter") malformed.chapterId = "unknown";
    if (kind === "schema")
      (malformed as unknown as { schemaVersion: number }).schemaVersion = 99;
    if (kind === "version") malformed.contentVersion = 99;
    if (kind === "path") malformed.pathId = "unknown";
    if (kind === "cursor") malformed.cursor = 10000;
    if (kind === "repertoire") malformed.repertoirePathId = "unknown";
    if (kind === "model-repertoire")
      malformed.repertoirePathId = chapter.paths.find(
        (path) => path.kind === "model",
      )!.id;
    if (kind === "revision") malformed.revision = -1;
    if (kind === "timestamp") malformed.updatedAt = "invalid";
    if (kind === "question") malformed.answers[0].questionId = "unknown";
    if (kind === "choice") malformed.answers[0].choiceId = "unknown";
    if (kind === "kind") malformed.answers[0].kind = "recognition";
    if (kind === "correct") malformed.answers[0].correct = true;
    if (kind === "answer-id") malformed.answers[0].id = `${chapter.id}:100`;
    if (kind === "answer-time")
      malformed.answers[0].at = new Date(3000).toISOString();
    await put(malformed);
    await expect(loadOpeningProgress()).rejects.toThrow("preserved");
    await expect(
      commitOpeningProgress(answer(previous, "recognition", true, 3000)),
    ).rejects.toThrow("preserved");
    await expect(
      commitOpeningProgress(
        initialOpeningProgress(openingChapters[1].id, 3000),
      ),
    ).rejects.toThrow("preserved");
    expect(await raw()).toEqual([malformed]);
  },
);
it("rejects unknown questions, paths, backwards time and out-of-range study positions", async () => {
  const initial = await seed();
  expect(() =>
    changeOpeningProgress(
      initial,
      {
        type: "answer",
        kind: "plan",
        questionId: "unknown",
        choiceId: "unknown",
      },
      2000,
    ),
  ).toThrow("Unknown");
  expect(() =>
    changeOpeningProgress(
      initial,
      { type: "study", pathId: "unknown", cursor: 0 },
      2000,
    ),
  ).toThrow();
  expect(() =>
    changeOpeningProgress(
      initial,
      {
        type: "study",
        pathId: initial.pathId,
        cursor: chapter.paths[0].moves.length + 1,
      },
      2000,
    ),
  ).toThrow();
  expect(() =>
    changeOpeningProgress(
      initial,
      { type: "study", pathId: initial.pathId, cursor: 1 },
      0,
    ),
  ).toThrow("backwards");
  expect(await loadOpeningProgress()).toEqual([initial]);
});

it("allows studying a model excerpt but rejects saving it as a repertoire branch", async () => {
  const initial = await seed();
  const model = chapter.paths.find((path) => path.kind === "model")!;
  const study = changeOpeningProgress(
    initial,
    { type: "study", pathId: model.id, cursor: 1 },
    2000,
  );
  await commitOpeningProgress(study);
  expect(() =>
    changeOpeningProgress(
      study,
      { type: "repertoire", pathId: model.id },
      3000,
    ),
  ).toThrow("Invalid opening progress");
  await expect(
    commitOpeningProgress({
      ...study,
      revision: study.revision + 1,
      updatedAt: new Date(3000).toISOString(),
      repertoirePathId: model.id,
    }),
  ).rejects.toThrow("Invalid opening progress");
  expect(await loadOpeningProgress()).toEqual([study]);
});
