import type { Exercise, Source } from "../learning/contracts";

export const OPENING_SCHEMA = 1;
export interface OpeningExercise extends Exercise {
  history: string[];
  mode: "guess" | "unfamiliar" | "recognition";
  /** Sound legal choices outside this chapter's answer goal; never chess errors. */
  deviations: Record<string, string>;
}
export interface OpeningPath {
  id: string;
  title: string;
  moves: string[];
  kind: "main" | "sideline" | "model";
  captions: string[];
}
export interface OpeningNode {
  id: string;
  fen: string;
  annotations: string[];
}
export interface OpeningEdge {
  id: string;
  from: string;
  to: string;
  move: string;
  san: string;
  annotations: string[];
  pathIds: string[];
  repertoire: boolean;
}
export interface OpeningGraph {
  nodes: OpeningNode[];
  edges: OpeningEdge[];
}
export interface PlanQuestion {
  id: string;
  prompt: string;
  choices: {
    id: string;
    text: string;
    correct: boolean;
    explanation: string;
  }[];
}
export interface RecognitionQuestion extends PlanQuestion {
  moves: string[];
}
export interface OpeningChapter {
  schemaVersion: 1;
  id: string;
  version: number;
  title: string;
  description: string;
  color: "w" | "b";
  source: Source;
  layers: { essential: string; practical: string; advanced: string };
  coverage: string[];
  uncovered: string[];
  deviations: { reply: string; advice: string }[];
  graph: OpeningGraph;
  paths: OpeningPath[];
  exercises: OpeningExercise[];
  planQuestions: PlanQuestion[];
  recognition: RecognitionQuestion[];
  pgn: string;
}
