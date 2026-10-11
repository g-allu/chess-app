import { expect, test, type Page } from "@playwright/test";
import {
  openingChapters,
  openingCourses,
  getOpeningChapter,
} from "../../src/openings/content";
import {
  initialOpeningProgress,
  type OpeningProgress,
} from "../../src/openings/progress";
import type { Attempt, Completion, Run } from "../../src/learning/contracts";
import type { ReviewCard } from "../../src/review/contracts";
import { replay } from "../../src/chess/adapter";
import {
  branchCourseId,
  branchCourses,
  branchExercises,
} from "../../src/openings/training";

const square = (page: Page, name: string) =>
  page.locator(`[data-square="${name}"]`);
const saved = (page: Page) =>
  expect(page.getByText("Progress saved", { exact: true })).toBeVisible();
const openingSaved = (page: Page) =>
  expect(
    page.getByText("Opening progress saved", { exact: true }),
  ).toBeVisible();
async function move(page: Page, lan: string) {
  await saved(page);
  await square(page, lan.slice(0, 2)).click();
  await square(page, lan.slice(2, 4)).click();
  await saved(page);
}
async function startPractice(page: Page, chapterId = "italian") {
  await page.goto(`/train/opening-train-${chapterId}`);
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await saved(page);
}
async function records(page: Page) {
  const data = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tempo-chess");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const names = [
        "openingProgress",
        "learningRuns",
        "attempts",
        "completions",
        "reviewCards",
        "workspaces",
      ];
      const tx = db.transaction(names, "readonly");
      const values = await Promise.all(
        names.map(
          (name) =>
            new Promise<unknown[]>((resolve, reject) => {
              const request = tx.objectStore(name).getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            }),
        ),
      );
      return Object.fromEntries(
        names.map((name, index) => [name, values[index]]),
      );
    } finally {
      db.close();
    }
  });
  return data as unknown as {
    openingProgress: OpeningProgress[];
    learningRuns: Run[];
    attempts: Attempt[];
    completions: Completion[];
    reviewCards: ReviewCard[];
    workspaces: { id: string; moves: string[]; cursor: number }[];
  };
}

for (const chapter of openingChapters) {
  test(`guided ${chapter.id} chapter teaches the main line, practical sideline and model before completion`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const course = openingCourses.find(
      (item) => item.id === `opening-${chapter.id}`,
    )!;
    await page.goto(`/openings/${chapter.id}`);
    await openingSaved(page);
    await page.getByRole("link", { name: "Complete guided chapter" }).click();
    await page.getByRole("button", { name: "Start opening chapter" }).click();
    await saved(page);
    for (const [index, step] of course.steps.entries()) {
      await expect(
        page.getByText(`Step ${index + 1} of ${course.steps.length}`, {
          exact: false,
        }),
      ).toBeVisible();
      if (step.kind === "example") {
        await expect(
          page.getByRole("heading", { name: step.title, exact: true }),
        ).toBeVisible();
        for (const _ of step.line) {
          await page.getByRole("button", { name: "Show next move" }).click();
          await saved(page);
        }
      } else if (step.kind === "exercise") {
        const exercise = chapter.exercises.find(
          (item) => item.id === step.exerciseId,
        )!;
        for (const lan of exercise.answers[0].line) await move(page, lan);
        await expect(page.getByText(/Correct —/)).toBeVisible();
      }
      await page
        .getByRole("button", {
          name:
            index === course.steps.length - 1 ? "Finish session" : "Continue",
          exact: true,
        })
        .click();
      if (index < course.steps.length - 1) await saved(page);
    }
    await expect(
      page.getByRole("heading", {
        name: "An idea to carry into your next game.",
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "An idea to carry into your next game.",
      }),
    ).toBeVisible();
    const data = await records(page);
    expect(data.completions).toHaveLength(1);
    expect(data.completions[0].courseId).toBe(course.id);
    expect(data.attempts.map((item) => item.exerciseId)).toEqual(
      chapter.exercises.map((item) => item.id),
    );
    expect(
      data.reviewCards.every((item) => item.evidence === "move-recall"),
    ).toBe(true);
    expect(data.openingProgress).toEqual([]);
  });
}

test("an accepted alternative and a concrete opening error produce distinct recall schedules", async ({
  page,
}) => {
  const initial = new Date("2026-10-11T15:00:00Z");
  await page.clock.install({ time: initial });
  await startPractice(page);
  await move(page, "d2d3");
  await expect(page.getByText(/documented sound alternative/)).toBeVisible();
  const success = await records(page);
  expect(success.attempts[0].outcome).toBe("correct");
  expect(success.attempts[0].firstUnassisted).toBe(true);
  expect(success.reviewCards[0].totalFailures).toBe(0);
  expect(Date.parse(success.reviewCards[0].dueAt)).toBe(
    Date.parse(success.attempts[0].at) + 86400000,
  );
  // A fresh Italian encounter isolates the actual losing move from the accepted one.
  await page.goto("/train/opening-mixed");
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await move(page, "f3g5");
  await expect(page.getByText(/Qxg5/)).toBeVisible();
  await move(page, "c2c3");
  const failed = await records(page);
  const italianCard = failed.reviewCards.find(
    (item) => item.exerciseId === "italian-guess",
  )!;
  const correction = failed.attempts.find(
    (item) => item.courseId === "opening-mixed" && item.outcome === "correct",
  )!;
  expect(italianCard.totalFailures).toBe(1);
  expect(Date.parse(italianCard.dueAt)).toBe(
    Date.parse(correction.at) + 4 * 3600000,
  );
  expect(
    failed.attempts
      .filter((item) => item.exerciseId === "italian-guess")
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((item) => item.outcome),
  ).toEqual(["correct", "wrong", "correct"]);
  expect(correction.firstUnassisted).toBe(false);
});

test("a sound repertoire deviation survives reload without becoming a chess error or a review failure", async ({
  page,
}) => {
  await startPractice(page);
  await move(page, "e1g1");
  await expect(
    page.getByText(/This is not recorded as a chess mistake/),
  ).toBeVisible();
  let data = await records(page);
  expect(data.attempts.map((item) => item.outcome)).toEqual(["deviation"]);
  expect(data.reviewCards).toEqual([]);
  expect(data.learningRuns[0].moves).toEqual([]);
  await page.reload();
  await saved(page);
  await expect(page.getByText(/Repertoire deviation — O-O/)).toBeVisible();
  await move(page, "c2c3");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await saved(page);
  await expect(
    page.getByRole("heading", { name: "Respond to the Two Knights" }),
  ).toBeVisible();
  await expect(square(page, "f6")).toHaveAttribute(
    "aria-label",
    "f6, Black knight",
  );
  await move(page, "d2d4");
  await expect(page.getByText(/sound active alternative/)).toBeVisible();
  data = await records(page);
  expect(data.attempts.map((item) => item.outcome)).toEqual([
    "deviation",
    "correct",
    "correct",
  ]);
  expect(data.reviewCards.every((item) => item.totalFailures === 0)).toBe(true);
});

test("move recall resumes independently of saved study branch, repertoire and plan/recognition answers", async ({
  page,
}) => {
  const chapter = getOpeningChapter("italian");
  const sideline = chapter.paths.find((item) => item.kind === "sideline")!;
  await page.goto("/train/free");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const free = (await records(page)).workspaces;
  await page.goto("/openings/italian");
  await openingSaved(page);
  await page.getByLabel("Study branch").selectOption(sideline.id);
  await openingSaved(page);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next opening move" }).click();
    await openingSaved(page);
  }
  await page
    .getByRole("button", { name: "Use this repertoire branch" })
    .click();
  await openingSaved(page);
  await page
    .getByRole("button", { name: "Plan questions", exact: true })
    .click();
  for (const choice of [...chapter.planQuestions[0].choices].reverse()) {
    await page.getByRole("button", { name: choice.text, exact: true }).click();
    await openingSaved(page);
  }
  await page
    .getByRole("button", { name: "Recognize a position", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: chapter.recognition[0].choices.find((item) => item.correct)!.text,
      exact: true,
    })
    .click();
  await openingSaved(page);
  const opening = (await records(page)).openingProgress[0];
  expect(opening).toMatchObject({
    pathId: sideline.id,
    cursor: 4,
    repertoirePathId: sideline.id,
  });
  expect(opening.answers.map((item) => [item.kind, item.correct])).toEqual([
    ["plan", false],
    ["plan", true],
    ["recognition", true],
  ]);
  await startPractice(page);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await saved(page);
  await page.reload();
  await saved(page);
  await expect(page.getByText("Hints revealed (1/2)")).toBeVisible();
  await move(page, "d2d3");
  await page.goto("/openings/italian");
  await openingSaved(page);
  await expect(page.getByLabel("Study branch")).toHaveValue(sideline.id);
  await expect(page.locator(".board-panel .pill")).toHaveText(
    `4/${sideline.moves.length}`,
  );
  await page
    .getByRole("button", { name: "Plan questions", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: chapter.planQuestions[0].choices[0].text,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Recognize a position", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: chapter.recognition[0].choices[0].text,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  const data = await records(page);
  expect(data.openingProgress).toEqual([opening]);
  expect(data.workspaces).toEqual(free);
  expect(data.reviewCards[0].totalFailures).toBe(1);
  await page.goto("/train/free");
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
});

test("invalid opening data remains intact and disables chapter writes", async ({
  page,
}) => {
  const invalid = { ...initialOpeningProgress("italian", 1000), cursor: 999 };
  await page.goto("/openings/italian");
  await openingSaved(page);
  await page.evaluate(async (record) => {
    const request = indexedDB.open("tempo-chess");
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("openingProgress", "readwrite");
        tx.objectStore("openingProgress").put(record);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      request.onerror = () => reject(request.error);
    });
  }, invalid);
  await page.reload();
  await expect(
    page.getByText("Opening progress needs attention."),
  ).toBeVisible();
  await expect(
    page.getByText(/Stored opening data has been preserved/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next opening move" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Study branch")).toBeDisabled();
  await page.getByRole("button", { name: "Retry opening storage" }).click();
  await expect(
    page.getByText("Opening progress needs attention."),
  ).toBeVisible();
  expect((await records(page)).openingProgress).toEqual([invalid]);
});

test("a saved practical sideline selects its own recall course and resumes full-position history", async ({
  page,
}) => {
  const chapter = getOpeningChapter("qgd");
  const path = chapter.paths.find((item) => item.id === "qgd-sideline")!;
  const course = branchCourses.find(
    (item) => item.id === branchCourseId(path.id),
  )!;
  await page.goto("/openings/qgd");
  await openingSaved(page);
  await page.getByLabel("Study branch").selectOption(path.id);
  await openingSaved(page);
  await page
    .getByRole("button", { name: "Use this repertoire branch" })
    .click();
  await openingSaved(page);
  const training = page.locator(".opening-repertoire-train");
  await expect(training).toHaveAttribute("href", `/train/${course.id}`);
  await training.click();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await saved(page);
  for (let index = 0; index < 3; index++) {
    const step = course.steps[index];
    if (step.kind !== "exercise")
      throw new Error("Expected a branch recall task");
    const exercise = branchExercises.find(
      (item) => item.id === step.exerciseId,
    )!;
    if (index === 2) {
      await page.reload();
      await saved(page);
      await expect(
        page.getByRole("heading", { name: exercise.title, exact: true }),
      ).toBeVisible();
    }
    // Recall the selected path's move even where the authored task also accepts alternatives.
    const recalledMove = path.moves[exercise.history!.length];
    await move(page, recalledMove);
    const data = await records(page);
    const attempt = data.attempts.find(
      (item) => item.exerciseId === exercise.id,
    )!;
    expect(attempt.fen).toBe(exercise.fen);
    expect(attempt.outcome).toBe("correct");
    await expect(page.locator(".learning-line")).toHaveText(
      `Played: ${replay([...exercise.history!, recalledMove])
        .history()
        .join(" · ")}`,
    );
    if (index < 2) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await saved(page);
    }
  }
  expect((await records(page)).learningRuns[0]).toMatchObject({
    courseId: course.id,
    index: 2,
    solved: true,
  });
  await page.goto("/openings/qgd");
  await openingSaved(page);
  await expect(page.getByLabel("Study branch")).toHaveValue(path.id);
  await expect(page.locator(".opening-repertoire-train")).toHaveAttribute(
    "href",
    `/train/${course.id}`,
  );
});

test("transposed move orders retain their histories while sharing position ideas", async ({
  page,
}) => {
  await page.goto("/openings/qgd");
  await openingSaved(page);
  for (let index = 0; index < 6; index++) {
    await page.getByRole("button", { name: "Next opening move" }).click();
    await openingSaved(page);
  }
  const mainHistory = await page.locator(".learning-line").textContent();
  const identity = await page.locator(".opening-identity code").textContent();
  const ideas = await page.locator(".opening-shared-ideas p").allTextContents();
  expect(ideas.length).toBeGreaterThan(0);
  await page.getByLabel("Study branch").selectOption("qgd-transposition");
  await openingSaved(page);
  for (let index = 0; index < 6; index++) {
    await page.getByRole("button", { name: "Next opening move" }).click();
    await openingSaved(page);
  }
  expect(await page.locator(".opening-identity code").textContent()).toBe(
    identity,
  );
  expect(
    await page.locator(".opening-shared-ideas p").allTextContents(),
  ).toEqual(ideas);
  expect(await page.locator(".learning-line").textContent()).not.toBe(
    mainHistory,
  );
  await page.reload();
  await openingSaved(page);
  await expect(page.getByLabel("Study branch")).toHaveValue(
    "qgd-transposition",
  );
  expect(await page.locator(".opening-identity code").textContent()).toBe(
    identity,
  );
  expect(
    await page.locator(".opening-shared-ideas p").allTextContents(),
  ).toEqual(ideas);
});

test("a failed opening write retries exactly once and preserves the last committed UI", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      const state = window as Window & { failOpeningWrite?: boolean };
      const stores = typeof names === "string" ? [names] : Array.from(names);
      if (
        state.failOpeningWrite &&
        mode === "readwrite" &&
        stores.includes("openingProgress")
      ) {
        state.failOpeningWrite = false;
        throw new Error("Opening write unavailable for test");
      }
      return original.call(this, names, mode, options);
    };
  });
  await page.goto("/openings/italian");
  await openingSaved(page);
  await page.getByRole("button", { name: "Next opening move" }).click();
  await openingSaved(page);
  const before = (await records(page)).openingProgress[0];
  await page.evaluate(() => {
    (window as Window & { failOpeningWrite?: boolean }).failOpeningWrite = true;
  });
  await page
    .getByRole("button", { name: "Use this repertoire branch" })
    .click();
  await expect(
    page.getByText("Opening progress needs attention."),
  ).toBeVisible();
  await expect(
    page.getByText(/Opening write unavailable for test/),
  ).toBeVisible();
  expect((await records(page)).openingProgress).toEqual([before]);
  await expect(
    page.getByText("Repertoire: Choose a studied branch"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry opening storage" }).click();
  await openingSaved(page);
  await expect(
    page.getByRole("button", { name: "Retry opening storage" }),
  ).toHaveCount(0);
  const after = (await records(page)).openingProgress[0];
  expect(after.revision).toBe(before.revision + 1);
  expect(after.repertoirePathId).toBe(before.pathId);
  await page.reload();
  await openingSaved(page);
  expect((await records(page)).openingProgress).toEqual([after]);
});

test("opening study and move practice support keyboard, narrow layout and persistent light/dark themes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/openings/italian");
  await openingSaved(page);
  await page.getByRole("button", { name: "Next opening move" }).focus();
  await page.keyboard.press("Enter");
  await openingSaved(page);
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openingSaved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await startPractice(page);
  await square(page, "d2").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await saved(page);
  await expect(page.getByText(/Correct — d3/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
