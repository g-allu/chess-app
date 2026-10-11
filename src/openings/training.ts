import { Chess } from "chess.js";
import type { Course, Exercise } from "../learning/contracts";
import { openingChapters } from "./content";
import { openingIdentity } from "./graph";

/** Stable per-path courses let saved repertoire choices select actual recall tasks. */
export const branchCourseId = (pathId: string) => `opening-branch-${pathId}`;
export function branchTeachingCourse(exerciseId: string): string | undefined {
  const chapter = openingChapters.find((item) =>
    item.paths.some((path) => exerciseId.startsWith(`${path.id}-recall-`)),
  );
  return chapter ? `opening-${chapter.id}` : undefined;
}
export const branchExercises: Exercise[] = [];
export const branchCourses: Course[] = [];
for (const chapter of openingChapters) {
  for (const path of chapter.paths.filter((item) => item.kind !== "model")) {
    const board = new Chess();
    const steps: Course["steps"] = [];
    path.moves.forEach((move, index) => {
      if (board.turn() === chapter.color) {
        const fen = board.fen();
        const authored = chapter.exercises.find(
          (item) =>
            openingIdentity(item.fen) === openingIdentity(fen) &&
            item.answers.some((answer) => answer.line[0] === move),
        );
        const id = `${path.id}-recall-${index}`;
        const san = new Chess(fen).move(move).san;
        const deviations = authored
          ? { ...authored.deviations }
          : Object.fromEntries(
              board
                .moves({ verbose: true })
                .filter((choice) => choice.lan !== move)
                .map((choice) => [
                  choice.lan,
                  "This move is outside the selected branch. Its chess strength is unassessed in this recall task; return to the position and recall the annotated choice.",
                ]),
            );
        branchExercises.push({
          schemaVersion: 1,
          id,
          version: chapter.version,
          title: `${chapter.title} · ${path.title} · ${board.moveNumber()}${chapter.color === "w" ? "." : "..."}`,
          skills: ["openings"],
          source: chapter.source,
          fen,
          history: path.moves.slice(0, index),
          prompt:
            authored?.prompt ??
            `Recall the ${chapter.color === "w" ? "White" : "Black"} move in your selected ${path.title.toLowerCase()}. This task records branch recall; unlisted moves are not assessed as chess errors.`,
          hints: authored?.hints ?? [
            path.captions[index],
            `The branch continues with ${san}.`,
          ],
          wrongFeedback:
            authored?.wrongFeedback ?? "Recall the annotated branch choice.",
          answers: authored?.answers ?? [
            {
              id: `${id}-answer`,
              line: [move],
              explanation: path.captions[index],
            },
          ],
          deviations,
        });
        steps.push({ id: `${id}-step`, kind: "exercise", exerciseId: id });
      }
      board.move(move);
    });
    branchCourses.push({
      schemaVersion: 1,
      id: branchCourseId(path.id),
      version: chapter.version,
      kind: "session",
      title: `${chapter.title}: ${path.title}`,
      description:
        "Recall your side's choices in this saved branch. Opponent moves come from the authored line; each position preserves its full history.",
      skills: ["openings"],
      source: chapter.source,
      steps,
    });
  }
}
