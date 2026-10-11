export const CONTENT_SCHEMA = 1;
export const PROGRESS_SCHEMA = 1;
export type Skill =
  | "threats"
  | "piece-safety"
  | "check-mate"
  | "notation"
  | "tactics"
  | "endgames";
export interface Source {
  author: string;
  source: string;
  license: string;
}
export interface AcceptedAnswer {
  id: string;
  line: string[];
  explanation: string;
}
export interface Exercise {
  schemaVersion: 1;
  id: string;
  version: number;
  title: string;
  skills: Skill[];
  source: Source;
  fen: string;
  prompt: string;
  hints: string[];
  wrongFeedback: string;
  answers: AcceptedAnswer[];
}
export type LessonStep =
  | { id: string; kind: "explanation"; title: string; text: string }
  | {
      id: string;
      kind: "example";
      title: string;
      text: string;
      fen: string;
      line: string[];
      captions: string[];
    }
  | { id: string; kind: "exercise"; exerciseId: string };
export interface Course {
  schemaVersion: 1;
  id: string;
  version: number;
  kind: "lesson" | "session";
  title: string;
  description: string;
  skills: Skill[];
  source: Source;
  steps: LessonStep[];
  secondsPerExercise?: number;
}
export interface Run {
  schemaVersion: 1;
  id: string;
  courseId: string;
  contentVersion: number;
  revision: number;
  startedAt: string;
  updatedAt: string;
  index: number;
  moves: string[];
  hints: number;
  misses: number;
  solved: boolean;
  feedback: string;
  deadline: number | null;
  completed: boolean;
}
export type Outcome = "hint" | "wrong" | "correct" | "retry" | "timeout";
export interface Attempt {
  schemaVersion: 1;
  id: string;
  runId: string;
  courseId: string;
  exerciseId: string;
  contentVersion: number;
  stepId: string;
  skills: Skill[];
  at: string;
  outcome: Outcome;
  move?: string;
  fen: string;
  hints: number;
  firstUnassisted: boolean;
}
export interface Completion {
  schemaVersion: 1;
  id: string;
  runId: string;
  courseId: string;
  contentVersion: number;
  at: string;
  exerciseCount: number;
}
export interface LearningData {
  runs: Run[];
  attempts: Attempt[];
  completions: Completion[];
}
export interface Transition {
  run: Run;
  attempt?: Attempt;
  completion?: Completion;
}
