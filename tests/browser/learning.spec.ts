import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Attempt, Completion, Run } from "../../src/learning/contracts";

const square = (page: Page, name: string) =>
  page.locator(`[data-square="${name}"]`);
const saved = (page: Page) =>
  expect(page.getByText("Progress saved", { exact: true })).toBeVisible();
async function move(page: Page, lan: string) {
  await saved(page);
  await square(page, lan.slice(0, 2)).click();
  await square(page, lan.slice(2, 4)).click();
  await saved(page);
}
async function next(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await saved(page);
}
async function start(page: Page, url: string, kind: "lesson" | "session") {
  await page.goto(url);
  await page
    .getByRole("button", { name: `Start ${kind}`, exact: true })
    .click();
  await saved(page);
}
async function records(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tempo-chess");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction(
        ["learningRuns", "attempts", "completions"],
        "readonly",
      );
      const read = <T>(name: string) =>
        new Promise<T[]>((resolve, reject) => {
          const request = transaction.objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const [runs, attempts, completions] = await Promise.all([
        read<Run>("learningRuns"),
        read<Attempt>("attempts"),
        read<Completion>("completions"),
      ]);
      return { runs, attempts, completions };
    } finally {
      db.close();
    }
  });
}

test("lesson teaches an idea, guides its example, and resumes with honest feedback", async ({
  page,
}) => {
  await start(page, "/learn/spot-threats", "lesson");
  await expect(
    page.getByRole("heading", { name: "The idea", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chessboard")).toHaveCount(0);
  await next(page);
  await expect(
    page.getByRole("heading", { name: "Walk through an example" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show next move" }).click();
  await saved(page);
  await expect(square(page, "g5")).toHaveAttribute(
    "aria-label",
    "g5, White queen",
  );
  await page.reload();
  await saved(page);
  await expect(square(page, "g5")).toHaveAttribute(
    "aria-label",
    "g5, White queen",
  );
  await next(page);
  await move(page, "d2d4");
  await expect(page.getByText(/Qd4 is legal/)).toBeVisible();
  await expect(square(page, "d2")).toHaveAttribute(
    "aria-label",
    "d2, White queen",
  );
  await move(page, "d2e4");
  await expect(
    page.getByText("That move is not legal. Try another square."),
  ).toBeVisible();
  await expect(page.getByText(/Qd4 is legal/)).toBeVisible();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await saved(page);
  await page.getByRole("button", { name: "Retry position" }).click();
  await saved(page);
  await page.reload();
  await saved(page);
  await expect(page.getByText("Hints revealed (1/2)")).toBeVisible();
  await expect(
    page.getByText(/earlier hints and tries still count/),
  ).toBeVisible();
  await move(page, "d2g5");
  await expect(page.getByText(/Correct — Qxg5/)).toBeVisible();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", {
      name: "An idea to carry into your next game.",
    }),
  ).toBeVisible();
  await expect(page.locator(".learning-metrics strong")).toHaveText([
    "0/1",
    "1",
    "1",
    "1",
  ]);
  await page.reload();
  await expect(page.locator(".learning-metrics strong")).toHaveText([
    "0/1",
    "1",
    "1",
    "1",
  ]);
  const committed = await records(page);
  expect(committed.completions).toHaveLength(1);
  expect(committed.attempts.map((attempt) => attempt.outcome)).toEqual([
    "wrong",
    "hint",
    "retry",
    "correct",
  ]);
  await page.getByRole("link", { name: "All lessons" }).click();
  await expect(
    page
      .locator(".learning-card")
      .filter({ hasText: "Spot the threat" })
      .getByText("1 practice position · 1 completed run"),
  ).toBeVisible();
});

test("a full untimed session accepts alternate mates and applies the fork reply", async ({
  page,
}) => {
  await start(page, "/train/starter-calculation", "session");
  await move(page, "a1a2");
  await next(page);
  await move(page, "d2g5");
  await next(page);
  await move(page, "f7e8");
  await expect(page.getByText(/Correct — Qe8#/)).toBeVisible();
  await next(page);
  await move(page, "e5f7");
  await expect(page.getByText(/Black replies Kg8/)).toBeVisible();
  await expect(square(page, "g8")).toHaveAttribute(
    "aria-label",
    "g8, Black king",
  );
  await expect(square(page, "f7")).toHaveAttribute(
    "aria-label",
    "f7, White knight",
  );
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await saved(page);
  await move(page, "f7d8");
  await next(page);
  await move(page, "g1f3");
  await next(page);
  await expect(page.locator(".square").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await move(page, "f2e1");
  await expect(page.getByText(/Correct — Qe1#/)).toBeVisible();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.locator(".learning-metrics strong")).toHaveText([
    "6/6",
    "0",
    "0",
    "0",
  ]);
  await page.reload();
  await expect(page.locator(".learning-metrics strong")).toHaveText([
    "6/6",
    "0",
    "0",
    "0",
  ]);
  const committed = await records(page);
  expect(committed.completions).toHaveLength(1);
  expect(
    committed.attempts.filter(
      (attempt) => attempt.exerciseId === "knight-fork",
    ),
  ).toHaveLength(2);
});

test("lesson progress and the free practice board keep separate positions", async ({
  page,
}) => {
  await page.goto("/train/free");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await page
    .locator(".learning-card")
    .filter({ hasText: "Keep your pieces safe" })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await saved(page);
  await next(page);
  await page.getByRole("button", { name: "Show next move" }).click();
  await saved(page);
  await next(page);
  await move(page, "a1a2");
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.getByRole("link", { name: "Free practice board" }).click();
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await page.reload();
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await page
    .locator(".learning-card")
    .filter({ hasText: "Keep your pieces safe" })
    .getByRole("button", { name: "Resume" })
    .click();
  await saved(page);
  await expect(square(page, "a2")).toHaveAttribute(
    "aria-label",
    "a2, White rook",
  );
  await expect(
    page.getByRole("button", { name: "Finish session" }),
  ).toBeVisible();
});

test("expired drills resume untimed after both a timer tick and a suspended refresh", async ({
  page,
}) => {
  const initial = new Date("2026-10-10T15:00:00Z");
  await page.clock.install({ time: initial });
  await start(page, "/train/quick-recognition", "session");
  await expect(page.getByRole("timer")).toContainText("30 seconds left");
  await page.clock.fastForward(31_000);
  await expect(page.getByText(/Time is up/)).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await move(page, "a1a2");
  await next(page);
  await saved(page);
  await page.clock.setSystemTime(new Date(initial.getTime() + 62_000));
  await page.reload();
  await expect(page.getByText(/Time is up/)).toBeVisible();
  await saved(page);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await move(page, "g1f3");
  await next(page);
  await move(page, "f7h7");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByText("2 time limits reached.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".learning-metrics strong")).toHaveText([
    "1/3",
    "2",
    "0",
    "0",
  ]);
  await page.reload();
  await expect(
    page.getByText("2 time limits reached.", { exact: false }),
  ).toBeVisible();
  expect(
    (await records(page)).attempts.filter(
      (attempt) => attempt.outcome === "timeout",
    ),
  ).toHaveLength(2);
});

test("failed learning writes preserve the committed position and retry once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      const stores = typeof names === "string" ? [names] : Array.from(names);
      if (
        (window as Window & { failLearningWrite?: boolean })
          .failLearningWrite &&
        mode === "readwrite" &&
        stores.includes("learningRuns")
      ) {
        throw new Error("Learning write unavailable for test");
      }
      return original.call(this, names, mode, options);
    };
  });
  await start(page, "/train/quick-recognition", "session");
  await page.evaluate(() => {
    (window as Window & { failLearningWrite?: boolean }).failLearningWrite =
      true;
  });
  await square(page, "a1").click();
  await square(page, "a2").click();
  await expect(
    page.getByText("Learning progress needs attention."),
  ).toBeVisible();
  await expect(
    page.getByText("Progress not saved", { exact: true }),
  ).toBeVisible();
  await expect(square(page, "a1")).toHaveAttribute(
    "aria-label",
    "a1, White rook",
  );
  expect((await records(page)).attempts).toHaveLength(0);
  await page.evaluate(() => {
    (window as Window & { failLearningWrite?: boolean }).failLearningWrite =
      false;
  });
  await page.getByRole("button", { name: "Retry learning storage" }).click();
  await saved(page);
  await expect(square(page, "a2")).toHaveAttribute(
    "aria-label",
    "a2, White rook",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await records(page)).attempts).toHaveLength(1);
  await page.reload();
  await saved(page);
  await expect(square(page, "a2")).toHaveAttribute(
    "aria-label",
    "a2, White rook",
  );
  expect((await records(page)).attempts).toHaveLength(1);
});

test("malformed learning progress stays preserved and blocks library writes globally", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const malformed = {
    id: "malformed-learning-run",
    schemaVersion: 1,
    courseId: "spot-threats",
    revision: -1,
  };
  await page.evaluate(async (record) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tempo-chess");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("learningRuns", "readwrite");
        transaction.objectStore("learningRuns").put(record);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }, malformed);
  await page.reload();
  await expect(
    page.getByText("Learning progress needs attention.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry learning storage" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  const starts = page.getByRole("button", {
    name: "Start lesson",
    exact: true,
  });
  await expect(starts).toHaveCount(5);
  for (const action of await starts.all()) await expect(action).toBeDisabled();
  const preserved = await records(page);
  expect(preserved.runs).toEqual([malformed]);
  expect(preserved.attempts).toHaveLength(0);
  expect(preserved.completions).toHaveLength(0);
});

test("learning boards fit a narrow screen and support keyboard exercise moves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "/learn/read-notation", "lesson");
  await next(page);
  await page.getByRole("button", { name: "Show next move" }).click();
  await saved(page);
  await next(page);
  await square(page, "g1").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await saved(page);
  await expect(page.getByText(/Correct — Nf3/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
