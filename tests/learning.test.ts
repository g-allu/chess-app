import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  courses,
  exercises,
  getCourse,
  getExercise,
} from "../src/learning/content";
import { validateContent } from "../src/learning/validation";
import {
  advance,
  runBoard,
  startRun,
  summarize,
  validateRun,
} from "../src/learning/engine";
import type { Attempt } from "../src/learning/contracts";
const move = (lan: string) => ({
  type: "move" as const,
  input: {
    from: lan.slice(0, 2) as "a1",
    to: lan.slice(2, 4) as "a2",
    promotion: lan[4] as "q" | undefined,
  },
});
describe("authored content", () => {
  it("validates every FEN, continuation, answer set, and content reference", () => {
    expect(() => validateContent(exercises, courses)).not.toThrow();
    for (const e of exercises.filter((e) => e.skills.includes("check-mate"))) {
      const game = new Chess(e.fen);
      const mates = game
        .moves({ verbose: true })
        .filter((m) => m.san.endsWith("#"))
        .map((m) => m.lan)
        .sort();
      expect(e.answers.map((a) => a.line[0]).sort()).toEqual(mates);
    }
  });
  it.each([
    "fen",
    "line",
    "duplicate",
    "explanation",
    "license",
    "reference",
    "reply",
  ])("rejects invalid %s content", (kind) => {
    const es = structuredClone(exercises),
      cs = structuredClone(courses);
    if (kind === "fen") es[0].fen = "invalid";
    if (kind === "line") es[0].answers[0].line = ["a1a8"];
    if (kind === "duplicate") es[1].id = es[0].id;
    if (kind === "explanation") es[0].answers[0].explanation = "";
    if (kind === "license") es[0].source.license = "";
    if (kind === "reference")
      cs[0].steps = [
        { id: "missing", kind: "exercise", exerciseId: "unknown" },
      ];
    if (kind === "reply")
      es[3].answers.push({
        id: "ambiguous-reply",
        line: ["e5f7", "h8h7", "f7d8"],
        explanation: "Ambiguous reply",
      });
    expect(() => validateContent(es, cs)).toThrow();
  });
});
describe("lesson and exercise transitions", () => {
  it("completes all authored courses, including guided steps and opponent replies", () => {
    for (const c of courses) {
      let run = startRun(c, 1000, c.id);
      const attempts: Attempt[] = [];
      while (!run.completed) {
        const s = c.steps[run.index];
        const action =
          s.kind === "explanation" ||
          run.solved ||
          (s.kind === "example" && run.moves.length === s.line.length)
            ? { type: "next" as const }
            : s.kind === "example"
              ? { type: "example" as const }
              : move(
                  getExercise(s.exerciseId).answers[0].line[run.moves.length],
                );
        const result = advance(run, action, 2000);
        run = result.run;
        if (result.attempt) attempts.push(result.attempt);
        if (run.completed) expect(result.completion?.runId).toBe(run.id);
      }
      expect(summarize(run, attempts).firstSuccesses).toBe(
        c.steps.filter((s) => s.kind === "exercise").length,
      );
      expect(() => advance(run, { type: "next" })).toThrow("complete");
    }
  });
  it("rejects illegal input and gives feedback without moving for a wrong legal answer", () => {
    const original = startRun(getCourse("starter-calculation"));
    expect(() => advance(original, move("a1b3"))).toThrow();
    const result = advance(original, move("a1b1"));
    expect(result.run.moves).toEqual([]);
    expect(result.run.feedback).toContain("is legal");
    expect(result.attempt?.outcome).toBe("wrong");
    expect(original.misses).toBe(0);
    expect(runBoard(result.run)?.fen()).toBe(runBoard(original)?.fen());
    expect(() => advance(original, { type: "next" })).toThrow("Solve");
  });
  it("counts hints, wrong answers, and retries as assistance without erasing evidence", () => {
    let run = startRun(getCourse("starter-calculation"));
    const hinted = advance(run, { type: "hint" });
    expect(hinted.attempt?.hints).toBe(1);
    run = hinted.run;
    run = advance(run, { type: "retry" }).run;
    const success = advance(run, move("a1a2"));
    expect(success.attempt).toMatchObject({
      outcome: "correct",
      hints: 1,
      firstUnassisted: false,
    });
    expect(success.run.misses).toBe(1);
    run = advance(success.run, { type: "next" }).run;
    expect(run).toMatchObject({
      hints: 0,
      misses: 0,
      solved: false,
      moves: [],
    });
  });
  it("accepts every documented mating alternative", () => {
    const course = getCourse("check-and-mate");
    let run = startRun(course);
    run = advance(run, { type: "next" }).run;
    run = advance(run, { type: "example" }).run;
    run = advance(run, { type: "next" }).run;
    for (const answer of getExercise("queen-mate").answers) {
      const result = advance(run, move(answer.line[0]));
      expect(result.run.solved).toBe(true);
      expect(runBoard(result.run)?.isCheckmate()).toBe(true);
    }
  });
  it("rebuilds a multi-move puzzle after an opponent reply", () => {
    let run = {
      ...startRun(getCourse("starter-calculation")),
      index: 3,
      revision: 1,
    };
    run = advance(run, move("e5f7")).run;
    expect(run.moves).toEqual(["e5f7", "h8g8"]);
    const restored = JSON.parse(JSON.stringify(run));
    validateRun(restored);
    expect(runBoard(restored)?.turn()).toBe("w");
    const wrong = advance(restored, move("f7h6"));
    expect(wrong.run.moves).toEqual(run.moves);
    expect(advance(wrong.run, move("f7d8")).run.solved).toBe(true);
  });
  it("records a timeout once after suspension and allows untimed learning", () => {
    let run = startRun(getCourse("quick-recognition"), 1000);
    expect(run.deadline).toBe(31000);
    const expired = advance(run, move("a1a2"), 31000);
    expect(expired.attempt?.outcome).toBe("timeout");
    expect(expired.run).toMatchObject({ deadline: null, moves: [], misses: 1 });
    expect(() => advance(expired.run, { type: "timeout" }, 32000)).toThrow(
      "timer",
    );
    const success = advance(expired.run, move("a1a2"), 50000);
    expect(success.attempt?.firstUnassisted).toBe(false);
    run = advance(success.run, { type: "next" }, 60000).run;
    expect(run.deadline).toBe(90000);
  });
  it("does not count an intermediate correct move as a completed exercise", () => {
    const run = {
      ...startRun(getCourse("starter-calculation")),
      index: 3,
      revision: 1,
    };
    const first = advance(run, move("e5f7"));
    expect(first.attempt?.firstUnassisted).toBe(false);
    expect(summarize(first.run, [first.attempt!]).firstSuccesses).toBe(0);
    const final = advance(first.run, move("f7d8"));
    expect(final.attempt?.firstUnassisted).toBe(true);
  });
  it("rejects corrupt or unavailable-version progress", () => {
    const run = startRun(getCourse("starter-calculation"));
    expect(() => validateRun({ ...run, moves: ["a1b1"] })).toThrow();
    expect(() => validateRun({ ...run, contentVersion: 99 })).toThrow(
      "preserved",
    );
    expect(() => validateRun({ ...run, completed: true })).toThrow();
  });
});
