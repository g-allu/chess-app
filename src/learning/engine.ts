import { Chess } from "chess.js";
import type { MoveInput } from "../chess/adapter";
import { getCourse, getExercise } from "./content";
import type { Attempt, Course, Run, Transition } from "./contracts";
export type Action =
  | { type: "move"; input: MoveInput }
  | { type: "hint" | "retry" | "next" | "example" | "timeout" };
function clock(course: Course, index: number, now: number) {
  return course.secondsPerExercise && course.steps[index]?.kind === "exercise"
    ? now + course.secondsPerExercise * 1000
    : null;
}
export function startRun(
  course: Course,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): Run {
  return {
    schemaVersion: 1,
    id,
    courseId: course.id,
    contentVersion: course.version,
    revision: 0,
    startedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    index: 0,
    moves: [],
    hints: 0,
    misses: 0,
    solved: false,
    feedback: "",
    deadline: clock(course, 0, now),
    completed: false,
  };
}
export function runBoard(run: Run): Chess | null {
  const step = getCourse(run.courseId).steps[run.index];
  if (!step || step.kind === "explanation") return null;
  const position =
    step.kind === "exercise" ? getExercise(step.exerciseId) : step;
  const game = position.history ? new Chess() : new Chess(position.fen);
  for (const move of position.history ?? []) game.move(move);
  if (game.fen() !== new Chess(position.fen).fen())
    throw new Error("Opening history does not match its position.");
  for (const move of run.moves) game.move(move);
  return game;
}
export function validateRun(run: Run): void {
  const c = getCourse(run.courseId);
  if (run.schemaVersion !== 1 || run.contentVersion !== c.version)
    throw new Error(
      "Saved content version is unavailable. Progress has been preserved.",
    );
  if (
    typeof run.id !== "string" ||
    !run.id ||
    !Number.isInteger(run.revision) ||
    run.revision < 0 ||
    !Number.isInteger(run.index) ||
    run.index < 0 ||
    run.index >= c.steps.length ||
    !Number.isInteger(run.hints) ||
    run.hints < 0 ||
    !Number.isInteger(run.misses) ||
    run.misses < 0 ||
    typeof run.solved !== "boolean" ||
    typeof run.completed !== "boolean" ||
    typeof run.feedback !== "string" ||
    !Array.isArray(run.moves) ||
    !Number.isFinite(Date.parse(run.startedAt)) ||
    !Number.isFinite(Date.parse(run.updatedAt)) ||
    (run.deadline !== null &&
      (!Number.isFinite(run.deadline) || !c.secondsPerExercise || run.solved))
  )
    throw new Error("Invalid saved learning progress");
  if (Date.parse(run.updatedAt) < Date.parse(run.startedAt))
    throw new Error("Invalid progress timestamps");
  if (
    run.revision === 0 &&
    (run.index !== 0 ||
      run.moves.length ||
      run.hints ||
      run.misses ||
      run.solved ||
      run.completed ||
      run.feedback ||
      run.deadline !== clock(c, 0, Date.parse(run.startedAt)))
  )
    throw new Error("Invalid initial learning progress");
  const step = c.steps[run.index];
  if (step.kind === "explanation") {
    if (run.moves.length || run.hints || run.solved || run.deadline !== null)
      throw new Error("Invalid explanation progress");
  } else if (step.kind === "example") {
    if (
      run.solved ||
      run.hints ||
      run.deadline !== null ||
      run.moves.length > step.line.length ||
      run.moves.some((m, i) => m !== step.line[i])
    )
      throw new Error("Invalid example progress");
  } else {
    const e = getExercise(step.exerciseId);
    const answers = e.answers.filter((a) =>
      run.moves.every((m, i) => a.line[i] === m),
    );
    if (
      run.hints > e.hints.length ||
      !answers.length ||
      run.solved !== answers.some((a) => a.line.length === run.moves.length) ||
      (!run.solved && run.moves.length % 2 !== 0)
    )
      throw new Error("Invalid exercise progress");
  }
  if (run.completed && (run.index !== c.steps.length - 1 || !run.solved))
    throw new Error("Invalid completion progress");
  runBoard(run);
}
export function advance(
  run: Run,
  action: Action,
  now = Date.now(),
): Transition {
  validateRun(run);
  if (run.completed) throw new Error("This session is complete.");
  const course = getCourse(run.courseId),
    step = course.steps[run.index];
  const next: Run = {
    ...run,
    moves: [...run.moves],
    revision: run.revision + 1,
    updatedAt: new Date(now).toISOString(),
  };
  const result: Transition = { run: next };
  const exercise =
    step.kind === "exercise" ? getExercise(step.exerciseId) : null;
  function record(outcome: Attempt["outcome"], move?: string) {
    if (!exercise) throw new Error("No exercise at this step");
    result.attempt = {
      schemaVersion: 1,
      id: `${run.id}:${next.revision}`,
      runId: run.id,
      courseId: course.id,
      exerciseId: exercise.id,
      contentVersion: exercise.version,
      stepId: step.id,
      skills: [...exercise.skills],
      at: next.updatedAt,
      outcome,
      move,
      fen: runBoard(run)!.fen(),
      hints: next.hints,
      firstUnassisted:
        outcome === "correct" &&
        next.solved &&
        next.hints === 0 &&
        next.misses === 0,
    };
  }
  // The deadline is checked on every action as well as by the UI timer, including a suspended tab.
  if (run.deadline !== null && now >= run.deadline && !run.solved) {
    next.deadline = null;
    next.misses++;
    next.feedback =
      "Time is up. Take your time now: scan threats, checks, captures, and piece safety.";
    record("timeout");
    return result;
  }
  if (action.type === "next") {
    if (step.kind === "exercise" && !run.solved)
      throw new Error("Solve the position before continuing.");
    if (step.kind === "example" && run.moves.length !== step.line.length)
      throw new Error("Finish the example before continuing.");
    if (run.index === course.steps.length - 1) {
      next.completed = true;
      result.completion = {
        schemaVersion: 1,
        id: run.id,
        runId: run.id,
        courseId: course.id,
        contentVersion: course.version,
        at: next.updatedAt,
        exerciseCount: course.steps.filter((s) => s.kind === "exercise").length,
      };
    } else {
      next.index++;
      next.moves = [];
      next.hints = 0;
      next.misses = 0;
      next.solved = false;
      next.feedback = "";
      next.deadline = clock(course, next.index, now);
    }
  } else if (action.type === "example") {
    if (step.kind !== "example" || run.moves.length >= step.line.length)
      throw new Error("Example has ended.");
    next.moves.push(step.line[run.moves.length]);
    next.feedback = step.captions[run.moves.length];
  } else {
    if (!exercise || run.solved) throw new Error("No active exercise");
    if (action.type === "hint") {
      if (run.hints >= exercise.hints.length)
        throw new Error("All hints are shown.");
      next.feedback = exercise.hints[run.hints];
      next.hints++;
      record("hint");
    } else if (action.type === "retry") {
      // Retries retain help/failure history; they cannot turn an assisted success into a first success.
      next.moves = [];
      next.misses++;
      next.feedback =
        "Position reset. Try the idea again; earlier hints and tries still count.";
      record("retry");
    } else if (action.type === "move") {
      const game = runBoard(run)!;
      const move = game.move(action.input); // Illegal input throws without a transition or attempt.
      const prefix = [...run.moves, move.lan];
      const answer = exercise.answers.find((a) =>
        prefix.every((m, i) => a.line[i] === m),
      );
      if (!answer) {
        const deviation =
          run.moves.length === 0 && exercise.deviations?.[move.lan];
        if (deviation) {
          next.feedback = `Repertoire deviation — ${move.san}. ${deviation} This is not recorded as a chess mistake. Try the chapter's choice from the same position.`;
          record("deviation", move.lan);
        } else {
          next.misses++;
          next.feedback = `${move.san} is legal. ${exercise.wrongFeedback} The position stays ready for another try.`;
          record("wrong", move.lan);
        }
      } else {
        next.moves = prefix;
        if (prefix.length === answer.line.length) {
          next.solved = true;
          next.deadline = null;
          next.feedback = `Correct — ${move.san}. ${answer.explanation}`;
        } else {
          const replyingSide = game.turn() === "b" ? "Black" : "White";
          const reply = game.move(answer.line[prefix.length]);
          next.moves.push(reply.lan);
          next.feedback = `Good — ${move.san}. ${replyingSide} replies ${reply.san}. Now find your follow-up.`;
        }
        record("correct", move.lan);
      }
    } else throw new Error("No active timer");
  }
  validateRun(next);
  return result;
}
export function summarize(run: Run, attempts: Attempt[]) {
  const own = attempts.filter((a) => a.runId === run.id);
  const exerciseCount = getCourse(run.courseId).steps.filter(
    (s) => s.kind === "exercise",
  ).length;
  const firstSuccesses = new Set(
    own.filter((a) => a.firstUnassisted).map((a) => a.stepId),
  ).size;
  return {
    exerciseCount,
    firstSuccesses,
    assisted: exerciseCount - firstSuccesses,
    hints: own.filter((a) => a.outcome === "hint").length,
    wrong: own.filter((a) => a.outcome === "wrong").length,
    timeouts: own.filter((a) => a.outcome === "timeout").length,
  };
}
