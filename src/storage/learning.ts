import { Chess, validateFen, type PieceSymbol, type Square } from "chess.js";
import { openDatabase } from "./database";
import { advance, startRun, validateRun } from "../learning/engine";
import { getCourse, getExercise } from "../learning/content";
import type {
  Attempt,
  Completion,
  LearningData,
  Run,
  Transition,
} from "../learning/contracts";
import { scheduleReviewTransition } from "../review/engine";
import { readReviewConfig, validateReviewCards } from "./reviews";
import type { ReviewCard, ReviewConfig } from "../review/contracts";

// Property order and optional undefined fields do not affect an IndexedDB retry.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim();
const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
function invalid(message: string): never {
  throw new Error(message);
}
function validateAttempt(attempt: Attempt, runs: Run[]): void {
  if (!attempt || typeof attempt !== "object") invalid("Invalid saved attempt");
  const run = runs.find((item) => item.id === attempt.runId);
  const course = run && getCourse(run.courseId);
  const step = course?.steps.find((item) => item.id === attempt.stepId);
  const exercise = step?.kind === "exercise" && getExercise(step.exerciseId);
  const revision =
    run && nonempty(attempt.id) && attempt.id.startsWith(`${run.id}:`)
      ? Number(attempt.id.slice(run.id.length + 1))
      : NaN;
  if (
    !run ||
    !exercise ||
    attempt.schemaVersion !== 1 ||
    attempt.courseId !== run.courseId ||
    attempt.exerciseId !== exercise.id ||
    attempt.contentVersion !== exercise.version ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision > run.revision ||
    attempt.id !== `${run.id}:${revision}` ||
    !equal(attempt.skills, exercise.skills) ||
    !["hint", "wrong", "correct", "retry", "timeout"].includes(
      attempt.outcome,
    ) ||
    !timestamp(attempt.at) ||
    Date.parse(attempt.at) < Date.parse(run.startedAt) ||
    Date.parse(attempt.at) > Date.parse(run.updatedAt) ||
    !Number.isInteger(attempt.hints) ||
    attempt.hints < 0 ||
    attempt.hints > exercise.hints.length ||
    typeof attempt.firstUnassisted !== "boolean" ||
    (attempt.firstUnassisted &&
      (attempt.outcome !== "correct" || attempt.hints !== 0)) ||
    typeof attempt.fen !== "string" ||
    !validateFen(attempt.fen).ok
  )
    invalid("Invalid saved attempt");
  const positions = new Set([new Chess(exercise.fen).fen()]);
  const accepted: { move: string; final: boolean }[] = [];
  for (const answer of exercise.answers) {
    const game = new Chess(exercise.fen);
    answer.line.forEach((move, index) => {
      if (index % 2 === 0 && game.fen() === attempt.fen)
        accepted.push({ move, final: index === answer.line.length - 1 });
      game.move(move);
      if (index % 2 === 1) positions.add(game.fen());
    });
  }
  if (!positions.has(attempt.fen)) invalid("Invalid saved attempt position");
  if (attempt.outcome === "correct" || attempt.outcome === "wrong") {
    if (
      typeof attempt.move !== "string" ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(attempt.move)
    )
      invalid("Invalid saved attempt move");
    new Chess(attempt.fen).move(attempt.move);
    const answer = accepted.find((item) => item.move === attempt.move);
    if (
      (attempt.outcome === "correct") !== !!answer ||
      (attempt.firstUnassisted && !answer?.final)
    )
      invalid("Invalid saved attempt outcome");
  } else if (attempt.move !== undefined)
    invalid("Unexpected saved attempt move");
  if (
    (attempt.outcome === "hint" && attempt.hints === 0) ||
    (attempt.outcome === "timeout" && !course?.secondsPerExercise)
  )
    invalid("Invalid saved attempt outcome");
}
function validateCompletion(completion: Completion, runs: Run[]): void {
  if (!completion || typeof completion !== "object")
    invalid("Invalid saved completion");
  const run = runs.find((item) => item.id === completion.runId);
  if (
    !run ||
    completion.schemaVersion !== 1 ||
    completion.id !== run.id ||
    !run.completed ||
    completion.courseId !== run.courseId ||
    completion.contentVersion !== run.contentVersion ||
    !timestamp(completion.at) ||
    completion.at !== run.updatedAt ||
    completion.exerciseCount !==
      getCourse(run.courseId).steps.filter((step) => step.kind === "exercise")
        .length
  )
    invalid("Invalid saved completion");
}
function validateData(data: LearningData): void {
  data.runs.forEach((run) => {
    validateRun(run);
    if (
      !timestamp(run.startedAt) ||
      !timestamp(run.updatedAt) ||
      Date.parse(run.updatedAt) < Date.parse(run.startedAt)
    )
      invalid("Invalid saved learning timestamps");
  });
  data.attempts.forEach((attempt) => validateAttempt(attempt, data.runs));
  data.completions.forEach((completion) =>
    validateCompletion(completion, data.runs),
  );
  if (
    data.runs.some(
      (run) =>
        run.completed &&
        !data.completions.some((completion) => completion.runId === run.id),
    )
  )
    invalid("Missing saved completion");
}
function preserved(error: unknown): Error {
  return new Error(
    `${error instanceof Error ? error.message : "Invalid saved learning data"}. Stored learning data has been preserved.`,
  );
}
export async function loadLearning(): Promise<LearningData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["learningRuns", "attempts", "completions"],
      "readonly",
    );
    const runs = tx.objectStore("learningRuns").getAll(),
      attempts = tx.objectStore("attempts").getAll(),
      completions = tx.objectStore("completions").getAll();
    tx.oncomplete = () => {
      try {
        const data: LearningData = {
          runs: runs.result,
          attempts: attempts.result,
          completions: completions.result,
        };
        validateData(data);
        resolve(data);
      } catch (error) {
        reject(preserved(error));
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Learning storage was interrupted."));
  });
}
function validateTransition(
  change: Transition,
  previous: Run | undefined,
): void {
  const now = Date.parse(change.run.updatedAt);
  if (!previous) {
    const initial = {
      run: startRun(
        getCourse(change.run.courseId),
        Date.parse(change.run.startedAt),
        change.run.id,
      ),
    };
    if (!equal(initial, change)) invalid("Invalid initial learning progress");
    return;
  }
  if (
    previous.completed ||
    now < Date.parse(previous.updatedAt) ||
    change.run.startedAt !== previous.startedAt ||
    change.run.courseId !== previous.courseId ||
    change.run.contentVersion !== previous.contentVersion
  )
    invalid("Invalid learning transition");
  const attempt = change.attempt;
  if (attempt) {
    const action =
      attempt.outcome === "correct" || attempt.outcome === "wrong"
        ? {
            type: "move" as const,
            input: {
              from: attempt.move!.slice(0, 2) as Square,
              to: attempt.move!.slice(2, 4) as Square,
              promotion: attempt.move![4] as PieceSymbol | undefined,
            },
          }
        : { type: attempt.outcome };
    if (!equal(advance(previous, action, now), change))
      invalid("Invalid learning transition event");
  } else {
    const step = getCourse(previous.courseId).steps[previous.index];
    const action =
      step.kind === "example" && previous.moves.length < step.line.length
        ? "example"
        : "next";
    if (!equal(advance(previous, { type: action }, now), change))
      invalid("Invalid learning transition");
  }
}
// Revision checks, immutable events, progress, and their review effects commit together.
export async function commitLearning(input: Transition): Promise<void> {
  // Snapshot immediately: callers may mutate their object while the database opens.
  const change = structuredClone(input);
  validateRun(change.run);
  if (change.attempt) validateAttempt(change.attempt, [change.run]);
  if (change.completion) validateCompletion(change.completion, [change.run]);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [
        "learningRuns",
        "attempts",
        "completions",
        "reviewCards",
        "reviewSettings",
      ],
      "readwrite",
    );
    let failure: Error | undefined;
    const store = tx.objectStore("learningRuns");
    const runs = store.getAll(),
      attempts = tx.objectStore("attempts").getAll(),
      completions = tx.objectStore("completions").getAll();
    const reviews = tx.objectStore("reviewCards").getAll(),
      settings = tx.objectStore("reviewSettings").get("local");
    settings.onsuccess = () => {
      try {
        const data: LearningData = {
          runs: runs.result,
          attempts: attempts.result,
          completions: completions.result,
        };
        try {
          validateData(data);
          validateReviewCards(reviews.result, data.attempts);
        } catch (error) {
          throw preserved(error);
        }
        const previous = data.runs.find((run) => run.id === change.run.id);
        if (previous && equal(previous, change.run)) {
          const attempt = data.attempts.find(
            (item) => item.id === `${previous.id}:${previous.revision}`,
          );
          const completion = data.completions.find(
            (item) => item.runId === previous.id,
          );
          if (
            !equal(attempt, change.attempt) ||
            !equal(completion, change.completion)
          )
            invalid("Saved learning events do not match this retry.");
          return;
        }
        if (
          (!previous && change.run.revision !== 0) ||
          (previous && previous.revision !== change.run.revision - 1)
        )
          invalid(
            "Progress changed in another tab. Reload to resume the latest saved step.",
          );
        validateTransition(change, previous);
        const config: ReviewConfig = readReviewConfig(settings.result);
        const cards: ReviewCard[] = reviews.result;
        const updatedCards = scheduleReviewTransition(cards, change, config);
        for (const card of updatedCards)
          if (
            !equal(
              card,
              cards.find((item) => item.id === card.id),
            )
          )
            tx.objectStore("reviewCards").put(card);
        store.put(change.run);
        if (change.attempt) tx.objectStore("attempts").add(change.attempt);
        if (change.completion)
          tx.objectStore("completions").add(change.completion);
      } catch (error) {
        failure =
          error instanceof Error
            ? error
            : new Error("Learning progress was not saved.");
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () =>
      reject(
        failure ??
          tx.error ??
          new Error("Learning progress was not saved. Try again."),
      );
  });
}
