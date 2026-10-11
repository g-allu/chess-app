import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { expect, it } from "vitest";
import { openingChapters } from "../src/openings/content";

const report = JSON.parse(
  readFileSync(
    new URL("../src/openings/engine-review.json", import.meta.url),
    "utf8",
  ),
) as {
  engine: string;
  contentSha256: string;
  settings: { nodesPerSearch: number };
  records: {
    history: string[];
    move: string;
    references: string[];
    kind: string;
    lossCp: number | null;
    candidate: { type: string; depth: number; pv: string[] };
  }[];
};
it("retains engine provenance for exactly the current authored content", () => {
  expect(report.engine).toBe("Stockfish 18");
  expect(report.settings.nodesPerSearch).toBe(150000);
  expect(report.contentSha256).toBe(
    createHash("sha256").update(JSON.stringify(openingChapters)).digest("hex"),
  );
  const references = new Set(
    report.records.flatMap((record) => record.references),
  );
  for (const chapter of openingChapters) {
    for (const path of chapter.paths)
      path.moves.forEach((_, index) =>
        expect(references.has(`${chapter.id}/${path.id}/${index}`)).toBe(true),
      );
    for (const exercise of chapter.exercises) {
      for (const answer of exercise.answers)
        expect(references.has(`${exercise.id}/${answer.id}`)).toBe(true);
      for (const move of Object.keys(exercise.deviations))
        expect(references.has(`${exercise.id}/deviation/${move}`)).toBe(true);
    }
  }
});
it("reviewed choices avoid flagged losses and concrete error examples have legal punishments", () => {
  for (const record of report.records) {
    const game = new Chess();
    for (const move of record.history) game.move(move);
    expect(record.candidate.depth).toBeGreaterThanOrEqual(10);
    expect(record.candidate.pv[0]).toBe(record.move);
    for (const move of record.candidate.pv)
      expect(game.move(move)).toBeTruthy();
    if (["verified-error", "editorial-reference"].includes(record.kind))
      continue;
    expect(record.candidate.type).toBe("cp");
    expect(record.lossCp).not.toBeNull();
    expect(record.lossCp!).toBeLessThanOrEqual(100);
  }
  const errors = report.records.filter(
    (record) => record.kind === "verified-error",
  );
  expect(errors).toHaveLength(3);
  for (const record of errors) expect(record.lossCp!).toBeGreaterThan(200);
  expect(errors.map((record) => record.candidate.pv[1])).toEqual([
    "d8g5",
    "d1g4",
    "g5d8",
  ]);
});
