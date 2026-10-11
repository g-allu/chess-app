import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  courses,
  exercises,
  focusedPracticeCourses,
  getCourse,
  getExercise,
  lessons,
  reviewCourses,
  sessions,
} from "../src/learning/content";
import { endgameExercises, endgameLessons } from "../src/learning/endgames";
import { advance, startRun } from "../src/learning/engine";
import { validateContent } from "../src/learning/validation";

describe("starter endgame content", () => {
  it("adds five complete original lessons and legal exercises", () => {
    expect(endgameExercises).toHaveLength(5);
    expect(endgameLessons).toHaveLength(5);
    expect(() => validateContent(exercises, courses)).not.toThrow();
    for (const exercise of endgameExercises) {
      expect(exercise.skills).toContain("endgames");
      expect(exercise.source.license).toBe("CC0-1.0");
      for (const answer of exercise.answers) {
        const game = new Chess(exercise.fen);
        expect(game.turn()).toBe("w");
        expect(game.isGameOver()).toBe(false);
        for (const move of answer.line) expect(game.move(move)).toBeTruthy();
      }
    }
  });

  it.each(["queen-box-mate", "rook-edge-mate"])(
    "%s accepts exactly every legal mating finish",
    (id) => {
      const exercise = getExercise(id);
      const game = new Chess(exercise.fen);
      const matingMoves = game
        .moves({ verbose: true })
        .filter((move) => move.san.endsWith("#"))
        .map((move) => move.lan)
        .sort();
      expect(exercise.answers.map((answer) => answer.line[0]).sort()).toEqual(
        matingMoves,
      );
      for (const answer of exercise.answers) {
        const final = new Chess(exercise.fen);
        final.move(answer.line[0]);
        expect(final.isCheckmate()).toBe(true);
        expect(final.isStalemate()).toBe(false);
        expect(final.moves()).toHaveLength(0);
      }
    },
  );

  it("makes the active king protect both the pawn and its next square", () => {
    const exercise = getExercise("active-king");
    const game = new Chess(exercise.fen);
    expect(game.isAttacked("d5", "w")).toBe(false);
    game.move(exercise.answers[0].line[0]);
    expect(game.get("e4")).toMatchObject({ type: "k", color: "w" });
    expect(game.get("d4")).toMatchObject({ type: "p", color: "w" });
    expect(game.isAttacked("d4", "w")).toBe(true);
    expect(game.isAttacked("d5", "w")).toBe(true);
    expect(game.isGameOver()).toBe(false);
  });

  it("teaches distant opposition with three empty intervening squares and no scripted reply", () => {
    const exercise = getExercise("distant-opposition");
    const game = new Chess(exercise.fen);
    expect(exercise.answers[0].line).toEqual(["e2d2"]);
    game.move(exercise.answers[0].line[0]);
    expect(game.get("d2")).toMatchObject({ type: "k", color: "w" });
    expect(game.get("d6")).toMatchObject({ type: "k", color: "b" });
    for (const square of ["d3", "d4", "d5"] as const)
      expect(game.get(square)).toBeUndefined();
    expect(game.turn()).toBe("b");
    expect(game.moves().length).toBeGreaterThan(1);
  });

  it("accepts both major-piece promotions and verifies the minor-piece material contrast", () => {
    const exercise = getExercise("promotion-choice");
    expect(exercise.answers.map((answer) => answer.line[0]).sort()).toEqual([
      "b7b8q",
      "b7b8r",
    ]);
    for (const answer of exercise.answers) {
      const game = new Chess(exercise.fen);
      expect(game.move(answer.line[0]).san).toContain("+");
      expect(game.isCheck()).toBe(true);
      expect(game.isStalemate()).toBe(false);
      expect(game.isInsufficientMaterial()).toBe(false);
    }
    for (const promotion of ["b", "n"]) {
      const game = new Chess(exercise.fen);
      game.move(`b7b8${promotion}`);
      expect(game.isInsufficientMaterial()).toBe(true);
    }
  });

  it("preserves the original six-position starter course and content versions", () => {
    const starter = getCourse("starter-calculation");
    expect(starter.version).toBe(1);
    expect(starter.steps).toEqual(
      [
        "loose-queen",
        "bishop-threat",
        "queen-mate",
        "knight-fork",
        "knight-notation",
        "black-mate",
      ].map((id) => ({
        id: `practice-${id}`,
        kind: "exercise",
        exerciseId: id,
      })),
    );
    const endgame = getCourse("endgame-practice");
    expect(
      endgame.steps.map((step) => step.kind === "exercise" && step.exerciseId),
    ).toEqual(endgameExercises.map((exercise) => exercise.id));
    expect(endgame.secondsPerExercise).toBeUndefined();
    expect(lessons).toHaveLength(10);
  });
});

describe("exercise review and focused practice courses", () => {
  it.each(["review", "practice"])(
    "registers one untimed %s course for every exercise",
    (prefix) => {
      const registry =
        prefix === "review" ? reviewCourses : focusedPracticeCourses;
      expect(registry).toHaveLength(exercises.length);
      for (const exercise of exercises) {
        const course = getCourse(`${prefix}-${exercise.id}`);
        expect(course.kind).toBe("session");
        expect(course.secondsPerExercise).toBeUndefined();
        expect(course.steps).toEqual([
          {
            id: `${prefix}-${exercise.id}-try`,
            kind: "exercise",
            exerciseId: exercise.id,
          },
        ]);
        expect(sessions.some((session) => session.id === course.id)).toBe(
          false,
        );
        for (const answer of exercise.answers) {
          let run = startRun(course);
          while (!run.solved) {
            const lan = answer.line[run.moves.length];
            run = advance(run, {
              type: "move",
              input: {
                from: lan.slice(0, 2) as "a1",
                to: lan.slice(2, 4) as "a2",
                promotion: lan[4] as "q" | undefined,
              },
            }).run;
          }
          expect(advance(run, { type: "next" }).run.completed).toBe(true);
        }
      }
    },
  );

  it("allows an older step ID to match a new course ID while rejecting duplicate step IDs", () => {
    expect(() => validateContent(exercises, courses)).not.toThrow();
    const copied = structuredClone(courses);
    copied[1].steps[0].id = copied[0].steps[0].id;
    expect(() => validateContent(exercises, copied)).toThrow(
      "Duplicate step ID",
    );
  });
});
