import { openDatabase } from "./database";
import {
  changeOpeningProgress,
  initialOpeningProgress,
  openingValuesEqual as equal,
  validateOpeningProgress,
  type OpeningAction,
  type OpeningProgress,
} from "../openings/progress";

function preserved(error: unknown): Error {
  return new Error(
    `${error instanceof Error ? error.message : "Invalid opening data"}. Stored opening data has been preserved.`,
  );
}
function validateRecords(records: OpeningProgress[]): void {
  records.forEach(validateOpeningProgress);
}
export async function loadOpeningProgress(): Promise<OpeningProgress[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("openingProgress", "readonly");
    const request = tx.objectStore("openingProgress").getAll();
    tx.oncomplete = () => {
      try {
        validateRecords(request.result);
        resolve(request.result);
      } catch (error) {
        reject(preserved(error));
      }
    };
    tx.onerror = () =>
      reject(tx.error ?? new Error("Opening storage was interrupted."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Opening storage was interrupted."));
  });
}
function validateTransition(
  next: OpeningProgress,
  previous: OpeningProgress | undefined,
): void {
  const now = Date.parse(next.updatedAt);
  if (!previous) {
    if (!equal(next, initialOpeningProgress(next.chapterId, now)))
      throw new Error("Invalid initial opening progress");
    return;
  }
  let action: OpeningAction;
  if (next.answers.length === previous.answers.length + 1) {
    const answer = next.answers.at(-1)!;
    action = {
      type: "answer",
      questionId: answer.questionId,
      choiceId: answer.choiceId,
      kind: answer.kind,
    };
  } else if (next.repertoirePathId !== previous.repertoirePathId) {
    if (!next.repertoirePathId) throw new Error("Invalid repertoire selection");
    action = { type: "repertoire", pathId: next.repertoirePathId };
  } else action = { type: "study", pathId: next.pathId, cursor: next.cursor };
  // Reconstruction protects historical evidence and rejects changes to multiple fields.
  if (!equal(next, changeOpeningProgress(previous, action, now)))
    throw new Error("Invalid opening transition or modified answer evidence");
}
export async function commitOpeningProgress(
  input: OpeningProgress,
): Promise<void> {
  const next = structuredClone(input);
  validateOpeningProgress(next);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("openingProgress", "readwrite");
    const store = tx.objectStore("openingProgress");
    const request = store.getAll();
    let failure: Error | undefined;
    request.onsuccess = () => {
      try {
        try {
          validateRecords(request.result);
        } catch (error) {
          throw preserved(error);
        }
        const previous = (request.result as OpeningProgress[]).find(
          (item) => item.id === next.id,
        );
        if (previous && equal(previous, next)) return;
        if (
          (!previous && next.revision !== 0) ||
          (previous && next.revision !== previous.revision + 1)
        )
          throw new Error(
            "Opening progress changed in another tab. Reload to resume the latest saved position.",
          );
        validateTransition(next, previous);
        store.put(next);
      } catch (error) {
        failure =
          error instanceof Error
            ? error
            : new Error("Opening progress was not saved.");
        tx.abort();
      }
    };
    // Only transaction completion confirms persistence, including duplicate retries.
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        failure ??
          tx.error ??
          new Error("Opening progress was not saved. Try again."),
      );
    tx.onabort = () =>
      reject(
        failure ??
          tx.error ??
          new Error("Opening progress was not saved. Try again."),
      );
  });
}
