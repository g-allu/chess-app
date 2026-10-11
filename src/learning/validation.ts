import { Chess, validateFen } from "chess.js";
import type { Course, Exercise, Source } from "./contracts";
function required(value: unknown, name: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Missing ${name}`);
}
function metadata(item: {
  schemaVersion: number;
  id: string;
  version: number;
  title: string;
  skills: string[];
  source: Source;
}) {
  if (!item || typeof item !== "object")
    throw new Error("Invalid content metadata");
  if (
    item.schemaVersion !== 1 ||
    !Number.isInteger(item.version) ||
    item.version < 1
  )
    throw new Error("Unsupported content version");
  required(item.id, "ID");
  required(item.title, "title");
  if (
    !Array.isArray(item.skills) ||
    !item.skills.length ||
    new Set(item.skills).size !== item.skills.length ||
    item.skills.some(
      (s) =>
        ![
          "threats",
          "piece-safety",
          "check-mate",
          "notation",
          "tactics",
          "endgames",
          "openings",
        ].includes(s),
    )
  )
    throw new Error("Invalid skills");
  required(item.source?.author, "author");
  required(item.source?.source, "source");
  required(item.source?.license, "license");
}
function line(fen: string, moves: string[]) {
  if (typeof fen !== "string" || !validateFen(fen).ok)
    throw new Error("Invalid FEN");
  const game = new Chess(fen);
  if (!Array.isArray(moves) || !moves.length || game.isGameOver())
    throw new Error("Empty or ended example");
  for (const move of moves) {
    if (
      typeof move !== "string" ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ||
      game.isGameOver()
    )
      throw new Error("Invalid continuation");
    game.move(move);
  }
}
function history(position: { fen: string; history?: string[] }) {
  if (position.history === undefined) return;
  if (!Array.isArray(position.history))
    throw new Error("Invalid opening history");
  const game = new Chess();
  for (const move of position.history) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) || game.isGameOver())
      throw new Error("Invalid opening history");
    game.move(move);
  }
  if (game.fen() !== new Chess(position.fen).fen())
    throw new Error("Opening history does not match FEN");
}
export function validateContent(
  exercises: Exercise[],
  courses: Course[],
): void {
  if (
    !Array.isArray(exercises) ||
    !exercises.length ||
    !Array.isArray(courses) ||
    !courses.length
  )
    throw new Error("Missing learning content");
  const ids = new Set<string>();
  const unique = (id: string) => {
    if (ids.has(id)) throw new Error(`Duplicate ID: ${id}`);
    ids.add(id);
  };
  for (const e of exercises) {
    metadata(e);
    unique(e.id);
    required(e.prompt, "prompt");
    required(e.wrongFeedback, "feedback");
    history(e);
    if (e.deviations !== undefined) {
      if (
        !e.deviations ||
        typeof e.deviations !== "object" ||
        Array.isArray(e.deviations)
      )
        throw new Error("Invalid repertoire deviations");
      for (const [move, explanation] of Object.entries(e.deviations)) {
        required(explanation, "deviation explanation");
        line(e.fen, [move]);
        if (e.answers.some((answer) => answer.line[0] === move))
          throw new Error("Accepted answer also marked as deviation");
      }
    }
    if (
      !Array.isArray(e.hints) ||
      !e.hints.length ||
      !Array.isArray(e.answers) ||
      !e.answers.length
    )
      throw new Error("Missing hints or answers");
    e.hints.forEach((h) => required(h, "hint"));
    const answerIds = new Set<string>();
    const paths: string[][] = [];
    for (const a of e.answers) {
      if (!a || typeof a !== "object" || !Array.isArray(a.line))
        throw new Error("Invalid answer");
      required(a.id, "answer ID");
      required(a.explanation, "answer explanation");
      if (answerIds.has(a.id) || a.line.length % 2 !== 1)
        throw new Error("Invalid answer");
      answerIds.add(a.id);
      line(e.fen, a.line);
      // A reply must be deterministic for a given user prefix; short answers cannot shadow longer ones.
      for (const previous of paths) {
        const shared = Math.min(previous.length, a.line.length);
        let divergence = 0;
        while (
          divergence < shared &&
          previous[divergence] === a.line[divergence]
        )
          divergence++;
        if (divergence === shared || divergence % 2 === 1)
          throw new Error("Ambiguous answer branches");
      }
      paths.push(a.line);
    }
  }
  // Course IDs and step IDs are separate reference namespaces. A focused
  // practice course may share its ID with a step in an older session.
  const stepIds = new Set<string>();
  for (const c of courses) {
    metadata(c);
    unique(c.id);
    required(c.description, "description");
    if (
      !["lesson", "session"].includes(c.kind) ||
      !Array.isArray(c.steps) ||
      !c.steps.length ||
      c.steps[c.steps.length - 1]?.kind !== "exercise"
    )
      throw new Error("Invalid course");
    if (
      c.secondsPerExercise !== undefined &&
      (!Number.isInteger(c.secondsPerExercise) ||
        c.secondsPerExercise < 1 ||
        c.kind !== "session")
    )
      throw new Error("Invalid time limit");
    for (const s of c.steps) {
      if (
        !s ||
        typeof s !== "object" ||
        (c.kind === "session" && s.kind !== "exercise")
      )
        throw new Error("Invalid course step");
      required(s.id, "step ID");
      if (stepIds.has(s.id)) throw new Error(`Duplicate step ID: ${s.id}`);
      stepIds.add(s.id);
      if (s.kind === "exercise") {
        if (!exercises.some((e) => e.id === s.exerciseId))
          throw new Error("Missing exercise reference");
      } else {
        required(s.title, "step title");
        required(s.text, "step explanation");
        if (s.kind === "example") {
          history(s);
          line(s.fen, s.line);
          if (!Array.isArray(s.captions) || s.captions.length !== s.line.length)
            throw new Error("Missing example captions");
          s.captions.forEach((t) => required(t, "caption"));
        } else if (s.kind !== "explanation")
          throw new Error("Unknown step kind");
      }
    }
  }
}
