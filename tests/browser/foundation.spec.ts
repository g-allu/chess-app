import { test, expect } from "@playwright/test";
const square = (page: import("@playwright/test").Page, name: string) =>
  page.locator(`[data-square="${name}"]`);
test("legal moves, replay cursor, profile, and navigation survive refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await square(page, "e2").click();
  await square(page, "e5").click();
  await expect(square(page, "e2")).toHaveAttribute(
    "aria-label",
    "e2, White pawn",
  );
  await expect(
    page.getByText("That move is not legal. Try another square."),
  ).toBeVisible();
  // The selected pawn remains ready for a corrected destination.
  await square(page, "e4").click();
  await square(page, "e7").click();
  await square(page, "e5").click();
  await expect(
    page.getByRole("button", { name: "Go to move 1 Black e5" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Previous move", exact: true })
    .click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await expect(square(page, "e7")).toHaveAttribute(
    "aria-label",
    "e7, Black pawn",
  );
  await expect(
    page.getByRole("button", { name: "Next move", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Alex", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.getByRole("link", { name: "Free practice board" }).click();
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Understanding comes first." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Understanding comes first." }),
  ).toBeVisible();
});
test("keyboard, orientation, reset, and narrow layout work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/train/free");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await square(page, "e2").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(page.locator(".square").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await page.reload();
  await expect(page.locator(".square").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await page.getByRole("button", { name: "Reset board", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(square(page, "e2")).toHaveAttribute(
    "aria-label",
    "e2, White pawn",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("promotion offers a choice and persists the chosen piece", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  // A legal move sequence clears the a-file and advances a pawn to promotion.
  const moves = [
    "a2a4",
    "b7b5",
    "a4b5",
    "a7a6",
    "b5a6",
    "h7h6",
    "a6a7",
    "h6h5",
  ];
  for (const move of moves) {
    await square(page, move.slice(0, 2)).click();
    await square(page, move.slice(2, 4)).click();
  }
  await square(page, "a7").click();
  await square(page, "b8").click();
  await expect(
    page.getByRole("dialog", { name: "Choose promotion piece" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Promote to knight" }).click();
  await expect(square(page, "b8")).toHaveAttribute(
    "aria-label",
    "b8, White knight",
  );
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await expect(square(page, "b8")).toHaveAttribute(
    "aria-label",
    "b8, White knight",
  );
});
test("mouse drag and temporary arrows work", async ({ page }) => {
  await page.goto("/train/free");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await square(page, "d2").dragTo(square(page, "d4"));
  await expect(square(page, "d4")).toHaveAttribute(
    "aria-label",
    "d4, White pawn",
  );
  await square(page, "g1").scrollIntoViewIfNeeded();
  const from = await square(page, "g1").boundingBox(),
    to = await square(page, "f3").boundingBox();
  if (!from || !to) throw new Error("Squares not found");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 5,
  });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".board-arrows line")).toHaveCount(1);
  await square(page, "e4").click({ button: "right" });
  await expect(page.locator(".board-arrows line")).toHaveCount(0);
});
test("a storage failure stays visible while the board remains usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      value: {
        open: () => {
          throw new Error("Storage unavailable for test");
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("Browser storage needs attention."),
  ).toBeVisible();
  await square(page, "e2").click();
  await square(page, "e4").click();
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    "e4, White pawn",
  );
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry storage" }),
  ).toBeVisible();
});

test("dark mode persists across refresh and navigation on mobile", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".sidebar")).toHaveCSS(
    "background-color",
    "rgb(29, 40, 33)",
  );
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(page.locator(".learning-card").first()).toHaveCSS(
    "background-color",
    "rgb(29, 40, 33)",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme follows the system until an explicit choice is saved", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
