import type { Skill } from "../learning/contracts";

export interface ReviewConfig {
  intervalDays: number[];
  failureDelayHours: number;
  newCardsPerDay: number;
  maxDuePerSession: number;
  teachingAfterFailures: number;
}

/** Move recall is evidence about an answer, never inferred plan understanding. */
export interface ReviewCard {
  schemaVersion: 1;
  id: string;
  exerciseId: string;
  contentVersion: number;
  skills: Skill[];
  evidence: "move-recall";
  sourceAttemptIds: string[];
  failedRunIds: string[];
  createdAt: string;
  admittedAt: string;
  updatedAt: string;
  dueAt: string;
  intervalIndex: number;
  consecutiveFailures: number;
  totalFailures: number;
  needsTeaching: boolean;
  lastReviewedAt: string | null;
}
