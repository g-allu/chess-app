import { replay } from "../chess/adapter";
import { getOpeningChapter } from "./content";

export type OpeningQuestionKind = "plan" | "recognition";
export interface OpeningAnswer {
  id: string;
  questionId: string;
  choiceId: string;
  kind: OpeningQuestionKind;
  correct: boolean;
  at: string;
}
export interface OpeningProgress {
  schemaVersion: 1;
  id: string;
  chapterId: string;
  contentVersion: number;
  revision: number;
  updatedAt: string;
  pathId: string;
  cursor: number;
  repertoirePathId: string | null;
  // Reading a line, choosing a repertoire, and answering a question are distinct evidence.
  // Every submission is retained; these records do not declare opening mastery.
  answers: OpeningAnswer[];
}
export type OpeningAction =
  | { type: "study"; pathId: string; cursor: number }
  | { type: "repertoire"; pathId: string }
  | {
      type: "answer";
      questionId: string;
      choiceId: string;
      kind: OpeningQuestionKind;
    };

export function openingValuesEqual(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown) =>
    JSON.stringify(value, (_, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, item[key]]),
          )
        : item,
    );
  return canonical(a) === canonical(b);
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}
function invalid(message: string): never {
  throw new Error(message);
}
export function validateOpeningProgress(progress: OpeningProgress): void {
  if (!progress || typeof progress !== "object")
    invalid("Invalid opening progress");
  const chapter = getOpeningChapter(progress.chapterId);
  const path = chapter.paths.find((item) => item.id === progress.pathId);
  if (
    progress.schemaVersion !== 1 ||
    progress.id !== chapter.id ||
    progress.chapterId !== chapter.id ||
    progress.contentVersion !== chapter.version ||
    !Number.isSafeInteger(progress.revision) ||
    progress.revision < 0 ||
    !timestamp(progress.updatedAt) ||
    !path ||
    !Number.isInteger(progress.cursor) ||
    progress.cursor < 0 ||
    progress.cursor > path.moves.length ||
    (progress.repertoirePathId !== null &&
      !chapter.paths.some(
        (item) =>
          item.id === progress.repertoirePathId && item.kind !== "model",
      )) ||
    !Array.isArray(progress.answers)
  )
    invalid("Invalid opening progress or content version");
  if (
    progress.revision === 0 &&
    (progress.pathId !== chapter.paths[0].id ||
      progress.cursor !== 0 ||
      progress.repertoirePathId !== null ||
      progress.answers.length !== 0)
  )
    invalid("Invalid initial opening progress");
  // Validate the full path, including moves beyond the saved cursor.
  replay(path.moves);
  if (progress.repertoirePathId)
    replay(
      chapter.paths.find((item) => item.id === progress.repertoirePathId)!
        .moves,
    );
  let previousRevision = 0;
  let previousAt = -Infinity;
  for (const answer of progress.answers) {
    if (!answer || typeof answer !== "object")
      invalid("Invalid opening answer evidence");
    const questions =
      answer.kind === "plan"
        ? chapter.planQuestions
        : answer.kind === "recognition"
          ? chapter.recognition
          : [];
    const question = questions.find((item) => item.id === answer.questionId);
    const choice = question?.choices.find(
      (item) => item.id === answer.choiceId,
    );
    const revision =
      typeof answer.id === "string" && answer.id.startsWith(`${chapter.id}:`)
        ? Number(answer.id.slice(chapter.id.length + 1))
        : NaN;
    if (
      !choice ||
      answer.correct !== choice.correct ||
      !Number.isSafeInteger(revision) ||
      revision <= previousRevision ||
      revision > progress.revision ||
      answer.id !== `${chapter.id}:${revision}` ||
      !timestamp(answer.at) ||
      Date.parse(answer.at) < previousAt ||
      Date.parse(answer.at) > Date.parse(progress.updatedAt)
    )
      invalid("Invalid opening answer evidence");
    previousRevision = revision;
    previousAt = Date.parse(answer.at);
  }
}
export function initialOpeningProgress(
  chapterId: string,
  now = Date.now(),
): OpeningProgress {
  const chapter = getOpeningChapter(chapterId);
  const initial: OpeningProgress = {
    schemaVersion: 1,
    id: chapter.id,
    chapterId: chapter.id,
    contentVersion: chapter.version,
    revision: 0,
    updatedAt: new Date(now).toISOString(),
    pathId: chapter.paths[0].id,
    cursor: 0,
    repertoirePathId: null,
    answers: [],
  };
  validateOpeningProgress(initial);
  return initial;
}
export function changeOpeningProgress(
  previous: OpeningProgress,
  action: OpeningAction,
  now = Date.now(),
): OpeningProgress {
  validateOpeningProgress(previous);
  if (!Number.isFinite(now) || now < Date.parse(previous.updatedAt))
    invalid("Opening progress time cannot move backwards");
  const next = structuredClone(previous);
  next.revision++;
  next.updatedAt = new Date(now).toISOString();
  switch (action.type) {
    case "study":
      next.pathId = action.pathId;
      next.cursor = action.cursor;
      break;
    case "repertoire":
      next.repertoirePathId = action.pathId;
      break;
    case "answer": {
      const chapter = getOpeningChapter(previous.chapterId);
      const questions =
        action.kind === "plan"
          ? chapter.planQuestions
          : action.kind === "recognition"
            ? chapter.recognition
            : [];
      const choice = questions
        .find((item) => item.id === action.questionId)
        ?.choices.find((item) => item.id === action.choiceId);
      if (!choice) invalid("Unknown opening question or choice");
      next.answers.push({
        id: `${next.chapterId}:${next.revision}`,
        questionId: action.questionId,
        choiceId: action.choiceId,
        kind: action.kind,
        correct: choice.correct,
        at: next.updatedAt,
      });
      break;
    }
    default:
      invalid("Unknown opening progress action");
  }
  validateOpeningProgress(next);
  return next;
}
