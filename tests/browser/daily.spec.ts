import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
test.use({ timezoneId: "America/Chicago" });

async function saved(page: Page) {
  await expect(page.getByText("Progress saved", { exact: true })).toBeVisible();
}
async function move(page: Page, lan: string) {
  await saved(page);
  await page.locator(`[data-square="${lan.slice(0, 2)}"]`).click();
  await page.locator(`[data-square="${lan.slice(2, 4)}"]`).click();
  await saved(page);
}
async function completeLesson(page: Page, lan: string) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await saved(page);
  await page.getByRole("button", { name: "Show next move" }).click();
  await saved(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await move(page, lan);
  await page.getByRole("button", { name: "Finish session" }).click();
}

test("a missed exercise returns due and a daily review, lesson and practice resume to completion", async ({
  page,
}) => {
  const initial = new Date("2026-10-10T15:00:00Z");
  await page.clock.install({ time: initial });
  await page.goto("/train/starter-calculation");
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await move(page, "a1b1");
  await expect(page.getByText(/Rb1 is legal/)).toBeVisible();
  await move(page, "a1a2");
  await page.clock.setSystemTime(new Date(initial.getTime() + 5 * 3600000));
  await page.goto("/");
  await expect(page.getByText(/1 due reviews/)).toBeVisible();
  await page.getByRole("button", { name: "Start daily session" }).click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await saved(page);
  await page.reload();
  await move(page, "a1a2");
  await page.getByRole("button", { name: "Finish session" }).click();
  await page.getByRole("button", { name: "Start daily lesson" }).click();
  await saved(page);
  await completeLesson(page, "d2g5");
  await page.getByRole("button", { name: "Start targeted practice" }).click();
  await move(page, "a1a2");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", { name: "Daily session complete" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "You completed 1 review, one lesson, and targeted practice.",
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Daily session complete" }),
  ).toBeVisible();
  await page.goto("/train/reviews");
  await expect(
    page.getByRole("heading", { name: "You're up to date." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review position" }),
  ).toHaveCount(0);
  const counts = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("tempo-chess");
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const tx = db.transaction(
        ["reviewCards", "dailySessions", "completions"],
        "readonly",
      );
      const read = (store: string) =>
        new Promise<unknown[]>((resolve) => {
          const request = tx.objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
        });
      const [cards, sessions, completions] = await Promise.all([
        read("reviewCards"),
        read("dailySessions"),
        read("completions"),
      ]);
      return {
        cards: cards.length,
        sessions: sessions.length,
        completions: completions.length,
      };
    } finally {
      db.close();
    }
  });
  expect(counts).toEqual({ cards: 2, sessions: 1, completions: 3 });
});

test("an endgame lesson creates a delayed card and its review accepts a mating alternative", async ({
  page,
}) => {
  const initial = new Date("2026-10-10T15:00:00Z");
  await page.clock.install({ time: initial });
  await page.goto("/learn/queen-endgame");
  await page.getByRole("button", { name: "Start lesson", exact: true }).click();
  await saved(page);
  await completeLesson(page, "c7b7");
  await expect(
    page.getByRole("heading", {
      name: "An idea to carry into your next game.",
    }),
  ).toBeVisible();
  await page.clock.setSystemTime(new Date(initial.getTime() + 25 * 3600000));
  await page.goto("/train/reviews");
  await page.getByRole("button", { name: "Review position" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "Resume review" }).click();
  await move(page, "c7d8");
  await expect(page.getByText(/Correct — Qd8#/)).toBeVisible();
  await page.getByRole("button", { name: "Finish session" }).click();
  await page.getByRole("button", { name: "Back to review queue" }).click();
  await expect(
    page.getByRole("heading", { name: "You're up to date." }),
  ).toBeVisible();
});

test("an empty daily plan fits mobile and persists before learning starts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/No reviews are due/)).toBeVisible();
  await page.getByRole("button", { name: "Start daily session" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start daily lesson" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(
    page.getByRole("button", { name: "Resume daily session" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a daily plan write failure stays recoverable without starting unsaved tasks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      const stores = typeof names === "string" ? [names] : Array.from(names);
      if (
        (window as Window & { failDailyWrite?: boolean }).failDailyWrite &&
        mode === "readwrite" &&
        stores.includes("dailySessions")
      )
        throw new Error("Daily write unavailable for test");
      return original.call(this, names, mode, options);
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start daily session" }),
  ).toBeEnabled();
  await page.evaluate(() => {
    (window as Window & { failDailyWrite?: boolean }).failDailyWrite = true;
  });
  await page.getByRole("button", { name: "Start daily session" }).click();
  await expect(page.getByText("Daily plan needs attention.")).toBeVisible();
  await expect(
    page.getByText("Daily write unavailable for test"),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { failDailyWrite?: boolean }).failDailyWrite = false;
  });
  await page.getByRole("button", { name: "Retry daily storage" }).click();
  await page.getByRole("button", { name: "Start daily session" }).click();
  await expect(
    page.getByRole("button", { name: "Start daily lesson" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start daily lesson" }),
  ).toBeVisible();
});

test("review settings persist and queue limits use the saved configuration", async ({
  page,
}) => {
  await page.goto("/train/reviews");
  await page.getByText("Review settings", { exact: true }).click();
  await page.getByLabel("Successful review intervals (days)").fill("2, 5, 10");
  await page.getByLabel("Return after help or a miss (hours)").fill("2");
  await page.getByLabel("New cards per day").fill("2");
  await page.getByLabel("Due cards per session").fill("1");
  await page.getByRole("button", { name: "Save review settings" }).click();
  await expect(page.getByText(/Review settings saved/)).toBeVisible();
  await expect(page.getByText(/At most 1 due cards/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(/Unassisted recall returns after 2, 5, 10 days/),
  ).toBeVisible();
  await page.getByText("Review settings", { exact: true }).click();
  await expect(page.getByLabel("New cards per day")).toHaveValue("2");
});

test("an active daily exercise resumes after local midnight", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-11T04:50:00Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "Start daily session" }).click();
  await page.getByRole("button", { name: "Start daily lesson" }).click();
  await saved(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Show next move" }).click();
  await saved(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await move(page, "d2d4");
  await page.clock.setSystemTime(new Date("2026-10-11T05:10:00Z"));
  await page.reload();
  await saved(page);
  await expect(
    page.getByText("Resuming your session from 2026-10-10."),
  ).toBeVisible();
  await expect(page.getByText(/Qd4 is legal/)).toBeVisible();
  await move(page, "d2g5");
});
