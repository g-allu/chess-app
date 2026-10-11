import { Chess } from "chess.js";
import { getExercise } from "../learning/content";
import type { Attempt } from "../learning/contracts";
import type { ReviewCard, ReviewConfig } from "../review/contracts";
import {
  defaultReviewConfig,
  reviewCardId,
  scheduleAttempt,
  validateReviewConfig,
} from "../review/engine";
import { openDatabase } from "./database";
import { loadLearning } from "./learning";

const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const uniqueStrings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && !!item) &&
  new Set(value).size === value.length;

export function readReviewConfig(record: unknown): ReviewConfig {
  if (record === undefined) return defaultReviewConfig;
  const saved = record as {
    id?: string;
    schemaVersion?: number;
    config?: ReviewConfig;
  };
  if (
    !saved ||
    saved.id !== "local" ||
    saved.schemaVersion !== 1 ||
    !saved.config
  )
    throw new Error(
      "Invalid saved review settings. Stored data has been preserved.",
    );
  validateReviewConfig(saved.config);
  return saved.config;
}

export function validateReviewCards(
  cards: ReviewCard[],
  attempts: Attempt[],
): void {
  if (new Set(cards.map((card) => card?.id)).size !== cards.length)
    throw new Error("Duplicate review cards");
  for (const card of cards) {
    const exercise = card && getExercise(card.exerciseId);
    if (
      !card ||
      !exercise ||
      card.schemaVersion !== 1 ||
      card.id !== reviewCardId(card.exerciseId, card.contentVersion) ||
      card.contentVersion !== exercise.version ||
      card.evidence !== "move-recall" ||
      JSON.stringify(card.skills) !== JSON.stringify(exercise.skills) ||
      !uniqueStrings(card.sourceAttemptIds) ||
      !card.sourceAttemptIds.length ||
      !uniqueStrings(card.failedRunIds) ||
      ![card.createdAt, card.admittedAt, card.updatedAt, card.dueAt].every(
        timestamp,
      ) ||
      Date.parse(card.createdAt) > Date.parse(card.updatedAt) ||
      Date.parse(card.admittedAt) > Date.parse(card.dueAt) ||
      !Number.isInteger(card.intervalIndex) ||
      card.intervalIndex < -1 ||
      !Number.isInteger(card.totalFailures) ||
      card.totalFailures !== card.failedRunIds.length ||
      !Number.isInteger(card.consecutiveFailures) ||
      card.consecutiveFailures < 0 ||
      card.consecutiveFailures > card.totalFailures ||
      typeof card.needsTeaching !== "boolean" ||
      (card.lastReviewedAt !== null && !timestamp(card.lastReviewedAt)) ||
      card.sourceAttemptIds.some(
        (id) =>
          !attempts.some(
            (attempt) =>
              attempt.id === id &&
              attempt.outcome !== "deviation" &&
              attempt.exerciseId === card.exerciseId &&
              attempt.contentVersion === card.contentVersion,
          ),
      ) ||
      card.failedRunIds.some(
        (id) =>
          !attempts.some(
            (attempt) =>
              attempt.runId === id &&
              attempt.outcome !== "deviation" &&
              card.sourceAttemptIds.includes(attempt.id) &&
              !attempt.firstUnassisted,
          ),
      )
    )
      throw new Error(
        "Invalid saved review card. Stored review data has been preserved.",
      );
  }
}

/** Historical runs retain only their latest position; verify final answer from the immutable move and FEN. */
function solvedAttempt(attempt: Attempt): boolean {
  if (attempt.outcome !== "correct") return false;
  const exercise = getExercise(attempt.exerciseId);
  return exercise.answers.some((answer) => {
    const game = new Chess(exercise.fen);
    for (let index = 0; index < answer.line.length; index++) {
      if (
        index === answer.line.length - 1 &&
        game.fen() === attempt.fen &&
        answer.line[index] === attempt.move
      )
        return true;
      game.move(answer.line[index]);
    }
    return false;
  });
}

export async function loadReviewCards(): Promise<ReviewCard[]> {
  // Validate existing progress before deriving new records from its attempts.
  await loadLearning();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["reviewCards", "reviewSettings", "attempts"],
      "readwrite",
    );
    const saved = tx.objectStore("reviewCards").getAll();
    const events = tx.objectStore("attempts").getAll();
    const settings = tx.objectStore("reviewSettings").get("local");
    let cards: ReviewCard[] = [],
      failure: Error | undefined;
    settings.onsuccess = () => {
      try {
        const config = readReviewConfig(settings.result);
        cards = saved.result;
        validateReviewCards(cards, events.result);
        const attempts = (events.result as Attempt[]).sort(
          (a, b) =>
            Date.parse(a.at) - Date.parse(b.at) ||
            a.runId.localeCompare(b.runId) ||
            Number(a.id.slice(a.runId.length + 1)) -
              Number(b.id.slice(b.runId.length + 1)),
        );
        const missing = new Set(
          attempts
            .filter(
              (attempt) =>
                attempt.outcome !== "deviation" &&
                (attempt.outcome !== "correct" || solvedAttempt(attempt)) &&
                !cards.some((card) =>
                  card.sourceAttemptIds.includes(attempt.id),
                ),
            )
            .map((attempt) =>
              reviewCardId(attempt.exerciseId, attempt.contentVersion),
            ),
        );
        if (missing.size) {
          // Reconstruct affected histories in order, including events preceding an existing card.
          // Unaffected schedules retain the settings that originally produced their due dates.
          let reconstructed: ReviewCard[] = [];
          for (const attempt of attempts)
            reconstructed = scheduleAttempt(
              reconstructed,
              attempt,
              solvedAttempt(attempt),
              config,
            );
          for (const card of reconstructed.filter((item) =>
            missing.has(item.id),
          )) {
            tx.objectStore("reviewCards").put(card);
            cards = [...cards.filter((item) => item.id !== card.id), card];
          }
        }
        validateReviewCards(cards, events.result);
      } catch (error) {
        failure =
          error instanceof Error
            ? error
            : new Error(
                "Review cards could not be loaded. Stored data has been preserved.",
              );
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(cards);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () =>
      reject(
        failure ?? tx.error ?? new Error("Review storage was interrupted."),
      );
  });
}

export async function loadReviewConfig(): Promise<ReviewConfig> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reviewSettings", "readonly");
    const request = tx.objectStore("reviewSettings").get("local");
    tx.oncomplete = () => {
      try {
        const config = readReviewConfig(request.result);
        resolve(structuredClone(config));
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Review settings could not be read."));
  });
}

export async function saveReviewConfig(input: ReviewConfig): Promise<void> {
  const config = structuredClone(input);
  validateReviewConfig(config);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reviewSettings", "readwrite");
    tx.objectStore("reviewSettings").put({
      id: "local",
      schemaVersion: 1,
      config,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Review settings were not saved."));
  });
}
