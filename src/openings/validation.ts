import { Chess } from "chess.js";
import { INITIAL_FEN } from "../chess/adapter";
import { validateContent } from "../learning/validation";
import type { OpeningChapter, OpeningGraph, PlanQuestion } from "./contracts";
import { openingChapters } from "./content";
import { buildOpeningGraph, openingIdentity } from "./graph";
import { parseOpeningPgn, pgnPaths } from "./pgn";

function required(value: unknown, name: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Missing opening ${name}`);
}
function nonempty<T>(value: T[], name: string): void {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`Missing opening ${name}`);
}
function strings(value: string[], name: string): void {
  nonempty(value, name);
  value.forEach((text) => required(text, name));
}
function legalHistory(moves: string[]): void {
  nonempty(moves, "moves");
  const game = new Chess();
  for (const move of moves) {
    if (
      typeof move !== "string" ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ||
      game.isGameOver()
    )
      throw new Error("Invalid opening continuation");
    game.move(move);
  }
}
function question(value: PlanQuestion): void {
  required(value.prompt, "question prompt");
  nonempty(value.choices, "question choices");
  if (
    value.choices.length < 2 ||
    value.choices.filter((choice) => choice.correct === true).length !== 1
  )
    throw new Error(
      "Opening question needs one correct choice and a distractor",
    );
  const ids = new Set<string>();
  for (const choice of value.choices) {
    required(choice.id, "choice ID");
    required(choice.text, "choice text");
    required(choice.explanation, "choice explanation");
    if (typeof choice.correct !== "boolean" || ids.has(choice.id))
      throw new Error("Invalid opening choice");
    ids.add(choice.id);
  }
}
function canonicalGraph(graph: OpeningGraph): string {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
    throw new Error("Missing opening graph");
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const nodes = graph.nodes
    .map((node) => {
      if (
        !node ||
        nodeIds.has(node.id) ||
        openingIdentity(node.fen) !== node.id
      )
        throw new Error("Invalid opening graph node");
      nodeIds.add(node.id);
      if (
        !Array.isArray(node.annotations) ||
        new Set(node.annotations).size !== node.annotations.length
      )
        throw new Error("Invalid node annotations");
      node.annotations.forEach((annotation) =>
        required(annotation, "node annotation"),
      );
      return { ...node, annotations: [...node.annotations].sort() };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges = graph.edges
    .map((edge) => {
      if (
        !edge ||
        edgeIds.has(edge.id) ||
        !nodeIds.has(edge.from) ||
        !nodeIds.has(edge.to)
      )
        throw new Error("Invalid opening graph edge");
      edgeIds.add(edge.id);
      strings(edge.annotations, "edge annotations");
      strings(edge.pathIds, "edge path IDs");
      if (
        new Set(edge.annotations).size !== edge.annotations.length ||
        new Set(edge.pathIds).size !== edge.pathIds.length
      )
        throw new Error("Duplicate graph annotation or path reference");
      return {
        ...edge,
        annotations: [...edge.annotations].sort(),
        pathIds: [...edge.pathIds].sort(),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ nodes, edges });
}

/** Validate structure, all replay paths, RAV/graph correspondence and learning answers. */
export function validateOpeningContent(
  chapters: OpeningChapter[] = openingChapters,
): void {
  nonempty(chapters, "chapters");
  const ids = new Set<string>();
  const unique = (id: string) => {
    required(id, "ID");
    if (ids.has(id)) throw new Error(`Duplicate opening ID: ${id}`);
    ids.add(id);
  };
  for (const chapter of chapters) {
    if (
      !chapter ||
      chapter.schemaVersion !== 1 ||
      !Number.isInteger(chapter.version) ||
      chapter.version < 1
    )
      throw new Error("Unsupported opening content version");
    unique(chapter.id);
    required(chapter.title, "title");
    required(chapter.description, "description");
    if (chapter.color !== "w" && chapter.color !== "b")
      throw new Error("Invalid repertoire color");
    required(chapter.source?.author, "author");
    required(chapter.source?.source, "source");
    required(chapter.source?.license, "license");
    for (const layer of ["essential", "practical", "advanced"] as const)
      required(chapter.layers?.[layer], `${layer} layer`);
    strings(chapter.coverage, "coverage");
    strings(chapter.uncovered, "uncovered replies");
    nonempty(chapter.deviations, "deviation references");
    for (const deviation of chapter.deviations) {
      required(deviation.reply, "deviation reply");
      required(deviation.advice, "deviation advice");
    }
    nonempty(chapter.paths, "paths");
    if (
      !chapter.paths.some((path) => path.kind === "main") ||
      !chapter.paths.some((path) => path.kind === "sideline") ||
      !chapter.paths.some((path) => path.kind === "model")
    )
      throw new Error("Chapter needs main, sideline and model paths");
    for (const path of chapter.paths) {
      unique(path.id);
      required(path.title, "path title");
      if (!["main", "sideline", "model"].includes(path.kind))
        throw new Error("Invalid opening path kind");
      legalHistory(path.moves);
      strings(path.captions, "path captions");
      if (path.captions.length !== path.moves.length)
        throw new Error("Missing opening path captions");
    }
    const expectedGraph = buildOpeningGraph(chapter.paths);
    if (canonicalGraph(chapter.graph) !== canonicalGraph(expectedGraph))
      throw new Error("Opening graph disagrees with annotated paths");
    required(chapter.pgn, "PGN");
    const parsed = parseOpeningPgn(chapter.pgn);
    if (parsed.initialFen !== INITIAL_FEN)
      throw new Error("Opening chapters must start from the initial position");
    const importedPaths = pgnPaths(parsed);
    const authoredPaths = chapter.paths.filter((path) => path.kind !== "model");
    const signatures = (paths: { moves: string[]; captions: string[] }[]) =>
      paths
        .map((path) =>
          JSON.stringify({ moves: path.moves, captions: path.captions }),
        )
        .sort();
    if (
      JSON.stringify(signatures(importedPaths)) !==
      JSON.stringify(signatures(authoredPaths))
    )
      throw new Error("PGN variations or comments disagree with opening paths");
    nonempty(chapter.exercises, "exercises");
    for (const exercise of chapter.exercises) {
      unique(exercise.id);
      if (
        !["guess", "unfamiliar", "recognition"].includes(exercise.mode) ||
        !exercise.skills.includes("openings")
      )
        throw new Error("Invalid opening exercise mode or skill");
      if (
        !Array.isArray(exercise.history) ||
        !exercise.deviations ||
        typeof exercise.deviations !== "object"
      )
        throw new Error(
          "Missing opening exercise history or deviation classification",
        );
    }
    if (
      ["guess", "unfamiliar", "recognition"].some(
        (mode) => !chapter.exercises.some((exercise) => exercise.mode === mode),
      )
    )
      throw new Error("Missing opening exercise mode");
    nonempty(chapter.planQuestions, "plan questions");
    nonempty(chapter.recognition, "recognition questions");
    for (const item of [...chapter.planQuestions, ...chapter.recognition]) {
      unique(item.id);
      question(item);
    }
    for (const item of chapter.recognition) legalHistory(item.moves);
  }
  const exercises = chapters.flatMap((chapter) => chapter.exercises);
  validateContent(exercises, [
    {
      schemaVersion: 1,
      id: "opening-validation-session",
      version: 1,
      kind: "session",
      title: "Opening validation",
      description: "Internal validation of all opening answer contracts.",
      skills: ["openings"],
      source: chapters[0].source,
      steps: exercises.map((exercise) => ({
        id: `validate-${exercise.id}`,
        kind: "exercise",
        exerciseId: exercise.id,
      })),
    },
  ]);
}
