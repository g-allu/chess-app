import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { INITIAL_FEN } from "../src/chess/adapter";
import {
  getOpeningChapter,
  openingChapters,
  openingCourses,
  openingExercises,
} from "../src/openings/content";
import type { OpeningChapter } from "../src/openings/contracts";
import {
  buildOpeningGraph,
  openingIdentity,
  openingPosition,
} from "../src/openings/graph";
import { parseOpeningPgn, pgnPaths } from "../src/openings/pgn";
import { validateOpeningContent } from "../src/openings/validation";
import { validateContent } from "../src/learning/validation";

describe("authored opening course contract", () => {
  it("delivers three complete legal chapter lessons and practical sidelines", () => {
    expect(openingChapters.map((chapter) => chapter.id)).toEqual([
      "italian",
      "caro-kann",
      "qgd",
    ]);
    expect(() => validateOpeningContent()).not.toThrow();
    expect(() =>
      validateContent(openingExercises, openingCourses),
    ).not.toThrow();
    for (const chapter of openingChapters) {
      expect(chapter.coverage.length).toBeGreaterThan(1);
      expect(chapter.uncovered.length).toBeGreaterThan(1);
      expect(chapter.source.license).toBe("CC0-1.0");
      expect(chapter.source.source).toContain("authored illustrative");
      expect(
        chapter.paths.some(
          (path) => path.kind === "sideline" && path.moves.length > 6,
        ),
      ).toBe(true);
      const course = openingCourses.find(
        (item) => item.id === `opening-${chapter.id}`,
      )!;
      expect(course.kind).toBe("lesson");
      expect(
        course.steps.filter((step) => step.kind === "example"),
      ).toHaveLength(3);
      expect(course.steps.at(-1)?.kind).toBe("exercise");
      expect(chapter.exercises.map((exercise) => exercise.mode)).toEqual([
        "guess",
        "unfamiliar",
        "recognition",
      ]);
      for (const exercise of chapter.exercises) {
        expect(openingPosition(exercise.history).fen()).toBe(exercise.fen);
        for (const answer of exercise.answers) {
          const game = openingPosition(exercise.history);
          for (const move of answer.line) expect(game.move(move)).toBeTruthy();
        }
      }
    }
  });
  it("rejects an unknown chapter without replacing it with another course", () => {
    expect(() => getOpeningChapter("unknown")).toThrow(
      "Unknown opening chapter",
    );
  });
  it("contains separate untimed mixed-branch and position-recognition courses", () => {
    const mixed = openingCourses.find(
      (course) => course.id === "opening-mixed",
    )!;
    const recognition = openingCourses.find(
      (course) => course.id === "opening-position-recognition",
    )!;
    expect(mixed.steps).toHaveLength(6);
    expect(recognition.steps).toHaveLength(3);
    expect(mixed.secondsPerExercise).toBeUndefined();
    expect(recognition.secondsPerExercise).toBeUndefined();
    expect(
      openingCourses.filter((course) => course.id.startsWith("opening-train-")),
    ).toHaveLength(3);
  });
});

describe("opening graph identity and legal history", () => {
  it("merges QGD move orders while retaining both sets of annotations", () => {
    const chapter = getOpeningChapter("qgd");
    const first = chapter.paths[0].moves.slice(0, 6);
    const second = chapter.paths.find(
      (path) => path.id === "qgd-transposition",
    )!.moves;
    expect(first).not.toEqual(second);
    const identity = openingIdentity(openingPosition(first).fen());
    expect(openingIdentity(openingPosition(second).fen())).toBe(identity);
    expect(openingPosition(first).history()).not.toEqual(
      openingPosition(second).history(),
    );
    const matching = chapter.graph.nodes.filter((node) => node.id === identity);
    expect(matching).toHaveLength(1);
    expect(matching[0].annotations).toContain("Develop and defend d5.");
    expect(matching[0].annotations).toContain(
      "The same position as 1.d4 d5 2.c4 e6 3.Nc3 Nf6.",
    );
    const next = chapter.graph.edges.find(
      (edge) => edge.from === identity && edge.move === "c1g5",
    )!;
    expect(next.repertoire).toBe(true);
    expect(next.pathIds).toContain("qgd-main");
  });
  it("retains annotations when the Italian quiet setup transposes", () => {
    const chapter = getOpeningChapter("italian");
    const identity = openingIdentity(
      openingPosition(chapter.paths[0].moves.slice(0, 12)).fen(),
    );
    const sides = chapter.paths.filter(
      (path) => path.kind === "sideline" && path.moves.length === 12,
    );
    expect(sides).toHaveLength(2);
    for (const path of sides)
      expect(openingIdentity(openingPosition(path.moves).fen())).toBe(identity);
    const shared = chapter.graph.nodes.find((node) => node.id === identity)!;
    expect(shared.annotations).toContain("Black does the same.");
    expect(shared.annotations).toContain(
      "This transposes to the main six-move position.",
    );
    expect(shared.annotations).toContain(
      "Both sides can now consider a central break.",
    );
  });
  it("ignores clocks but retains castling rights", () => {
    const later = INITIAL_FEN.replace("0 1", "14 22");
    expect(openingIdentity(later)).toBe(openingIdentity(INITIAL_FEN));
    expect(openingIdentity(INITIAL_FEN.replace("KQkq", "-"))).not.toBe(
      openingIdentity(INITIAL_FEN),
    );
  });
  it("retains legal en passant and drops irrelevant or pinned EP targets", () => {
    const legal = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    expect(openingIdentity(legal)).not.toBe(
      openingIdentity(legal.replace("d6", "-")),
    );
    const pinned = "k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    expect(new Chess(pinned).moves()).not.toContain("exd6");
    expect(openingIdentity(pinned)).toBe(
      openingIdentity(pinned.replace("d6", "-")),
    );
    const irrelevant = "4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1";
    expect(openingIdentity(irrelevant)).toBe(
      openingIdentity(irrelevant.replace("d6", "-")),
    );
  });
  it("preserves repetition with full replay independently of lookup identity", () => {
    const moves = [
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
    ];
    const game = openingPosition(moves);
    expect(game.isThreefoldRepetition()).toBe(true);
    expect(new Chess(game.fen()).isThreefoldRepetition()).toBe(false);
    expect(openingIdentity(game.fen())).toBe(openingIdentity(INITIAL_FEN));
    expect(game.history()).toHaveLength(8);
    expect(() => openingPosition(moves, 9)).toThrow("Invalid replay");
    expect(() =>
      buildOpeningGraph([
        {
          id: "ended",
          title: "Ended",
          kind: "main",
          moves: [...moves, "g1f3"],
          captions: Array(9).fill("Develop"),
        },
      ]),
    ).toThrow("game end");
  });
});

describe("recursive annotated course PGN", () => {
  const pgn = `[Event "An \\\"author\\\" example"]
[Result "*"]
{Introduction} 1.e4$1 {Central {nested} comment and [Event "preserve"]} e5
(1...c5 {Sicilian} 2.Nf3 (2.Nc3 {Closed plan} Nc6) d6)
2.Nf3! Nc6 ;Develop the knight
3.Bc4 *`;
  it("preserves headers, nested RAVs, nested comments, semicolon comments and NAGs", () => {
    const parsed = parseOpeningPgn(pgn);
    expect(parsed.headers.Event).toBe('An "author" example');
    expect(parsed.line.comments).toEqual(["Introduction"]);
    expect(parsed.line.moves[0].comments).toEqual([
      'Central {nested} comment and [Event "preserve"]',
    ]);
    expect(parsed.line.moves[0].nags).toEqual(["$1"]);
    expect(parsed.line.moves[2].nags).toEqual(["!"]);
    expect(parsed.line.moves[3].comments).toEqual(["Develop the knight"]);
    const variant = parsed.line.moves[1].variations[0];
    expect(variant.moves.map((move) => move.san)).toEqual(["c5", "Nf3", "d6"]);
    expect(variant.moves[1].variations[0].moves[0].comments).toEqual([
      "Closed plan",
    ]);
    const paths = pgnPaths(parsed);
    expect(paths.map((path) => path.moves)).toEqual([
      ["e2e4", "c7c5", "b1c3", "b8c6"],
      ["e2e4", "c7c5", "g1f3", "d7d6"],
      ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
    ]);
    expect(paths[0].captions[0]).toContain("Introduction $1 Central {nested}");
    expect(paths[0].captions[2]).toBe("Closed plan");
    for (const path of paths)
      expect(openingPosition(path.moves).history()).toHaveLength(
        path.moves.length,
      );
  });
  it("retains comments before the first move of a variation", () => {
    const paths = pgnPaths(
      parseOpeningPgn("1.e4 e5 ({Variation plan} 1...c5) *"),
    );
    expect(paths[0].captions[1]).toBe("Variation plan Play c5.");
  });
  it.each([
    "",
    "[Event bad] 1.e4 *",
    '[Event "a"] [Event "b"] 1.e4 *',
    "1.e4 {unclosed",
    "1.e4 e5 (1...c5",
    "1.e4)",
    "(1.e4) *",
    "1.e4 () *",
    "1.e4 e5 (1...Bh6) *",
    "1.e4 e5 2.Bh6 *",
    "1.e4 $ *",
    "1.e4 * e5",
    "1.e4 * (1.d4)",
    '[Result "1-0"] 1.e4 *',
    "1.e4 * *",
    "1.e2e4 e5 *",
  ])("rejects malformed or illegal PGN: %s", (invalid) => {
    expect(() => parseOpeningPgn(invalid)).toThrow();
  });
});

describe("instructional concrete claims", () => {
  it("verifies Italian captures without overstating the lasting material result", () => {
    const exercise = getOpeningChapter("italian").exercises[0];
    const knightLoss = openingPosition(exercise.history);
    knightLoss.move("f3e5");
    expect(knightLoss.move("c6e5").captured).toBe("n");
    expect(knightLoss.get("e5")).toMatchObject({ type: "n", color: "b" });
    knightLoss.move("d2d4");
    knightLoss.move("c5d4");
    expect(knightLoss.move("d1d4").captured).toBe("b");
    const queenCapture = openingPosition(exercise.history);
    queenCapture.move("f3g5");
    expect(queenCapture.move("d8g5").captured).toBe("n");
    expect(exercise.deviations.f3g5).toBeUndefined();
    expect(exercise.answers.map((answer) => answer.line[0])).toEqual([
      "c2c3",
      "d2d3",
    ]);
    expect(exercise.deviations.e1g1).toContain("sound");
    const sharper = getOpeningChapter("italian").exercises[1];
    const game = openingPosition(sharper.history);
    game.move("f3g5");
    expect(game.moves()).not.toContain("Qxg5");
    expect(sharper.deviations.f3g5).toContain("sound");
  });
  it("distinguishes the Advance bishop blunder from the later Exchange pin", () => {
    const exercise = getOpeningChapter("caro-kann").exercises[0];
    const game = openingPosition(exercise.history);
    game.move("c8g4");
    expect(game.move("d1g4").captured).toBe("b");
    expect(exercise.answers.map((answer) => answer.line[0])).toEqual(["c8f5"]);
    expect(exercise.deviations.c8g4).toBeUndefined();
    const exchange = getOpeningChapter("caro-kann").paths.find(
      (path) => path.kind === "sideline",
    )!;
    expect(openingPosition(exchange.moves).get("g4")).toMatchObject({
      type: "b",
      color: "b",
    });
    expect(openingPosition(exchange.moves).get("f3")).toMatchObject({
      type: "n",
      color: "w",
    });
  });
  it("verifies the QGD pin exposes the queen if the knight leaves f6", () => {
    const game = openingPosition(getOpeningChapter("qgd").exercises[0].history);
    game.move("f6e4");
    expect(game.move("g5d8").captured).toBe("q");
    expect(game.get("d8")).toMatchObject({ type: "b", color: "w" });
  });
  it("verifies the Exchange Caro-Kann queen recapture is playable, with a development tempo", () => {
    const exercise = getOpeningChapter("caro-kann").exercises[1];
    const game = openingPosition(exercise.history);
    expect(game.move("d8d5").captured).toBe("p");
    expect(game.moves()).not.toContain("Qxd5");
    game.move("b1c3");
    expect(game.isAttacked("d5", "w")).toBe(true);
    expect(exercise.deviations.d8d5).toContain("playable");
  });
  it("requires a defended b4 preparation rather than hanging a pawn to Be7", () => {
    const exercise = getOpeningChapter("qgd").exercises[2];
    const unsafe = openingPosition(exercise.history);
    unsafe.move("b2b4");
    expect(unsafe.move("e7b4").captured).toBe("p");
    expect(exercise.answers.map((answer) => answer.line[0]).sort()).toEqual([
      "a1b1",
      "a2a3",
    ]);
    for (const answer of exercise.answers) {
      const game = openingPosition(exercise.history);
      game.move(answer.line[0]);
      game.move("h7h6");
      game.move("b2b4");
      expect(game.isAttacked("b4", "w")).toBe(true);
    }
  });
});

describe("opening content rejection", () => {
  const mutations: [string, (chapters: OpeningChapter[]) => void][] = [
    [
      "chapter versions",
      (chapters) => {
        chapters[0].version = 0;
      },
    ],
    [
      "duplicate chapter IDs",
      (chapters) => {
        chapters[1].id = chapters[0].id;
      },
    ],
    [
      "source provenance",
      (chapters) => {
        chapters[0].source.source = "";
      },
    ],
    [
      "license",
      (chapters) => {
        chapters[0].source.license = "";
      },
    ],
    [
      "missing layers",
      (chapters) => {
        chapters[0].layers.practical = "";
      },
    ],
    [
      "missing coverage",
      (chapters) => {
        chapters[0].coverage = [];
      },
    ],
    [
      "missing uncovered references",
      (chapters) => {
        chapters[0].uncovered = [];
      },
    ],
    [
      "duplicate path IDs",
      (chapters) => {
        chapters[0].paths[1].id = chapters[0].paths[0].id;
      },
    ],
    [
      "illegal move path",
      (chapters) => {
        chapters[0].paths[0].moves[0] = "e2e5";
      },
    ],
    [
      "SAN in UCI path",
      (chapters) => {
        chapters[0].paths[0].moves[0] = "e4";
      },
    ],
    [
      "path captions",
      (chapters) => {
        chapters[0].paths[0].captions.pop();
      },
    ],
    [
      "graph destination",
      (chapters) => {
        chapters[0].graph.edges[0].to = "unknown";
      },
    ],
    [
      "graph move",
      (chapters) => {
        chapters[0].graph.edges[0].move = "e2e3";
      },
    ],
    [
      "duplicate graph node",
      (chapters) => {
        chapters[0].graph.nodes.push(chapters[0].graph.nodes[0]);
      },
    ],
    [
      "lost graph annotation",
      (chapters) => {
        chapters[0].graph.nodes[1].annotations = [];
      },
    ],
    [
      "lost repertoire identity",
      (chapters) => {
        chapters[0].graph.edges[0].repertoire = false;
      },
    ],
    [
      "PGN disagreement",
      (chapters) => {
        chapters[0].pgn = chapters[0].pgn.replace(
          "White takes central space and opens the bishop.",
          "Changed explanation.",
        );
      },
    ],
    [
      "missing model",
      (chapters) => {
        chapters[0].paths = chapters[0].paths.filter(
          (path) => path.kind !== "model",
        );
      },
    ],
    [
      "empty choices",
      (chapters) => {
        chapters[0].planQuestions[0].choices = [];
      },
    ],
    [
      "two correct choices",
      (chapters) => {
        chapters[0].planQuestions[0].choices[1].correct = true;
      },
    ],
    [
      "duplicate choice IDs",
      (chapters) => {
        chapters[0].planQuestions[0].choices[1].id =
          chapters[0].planQuestions[0].choices[0].id;
      },
    ],
    [
      "missing choice explanation",
      (chapters) => {
        chapters[0].planQuestions[0].choices[1].explanation = "";
      },
    ],
    [
      "duplicate question IDs",
      (chapters) => {
        chapters[0].recognition[0].id = chapters[0].planQuestions[0].id;
      },
    ],
    [
      "illegal recognition history",
      (chapters) => {
        chapters[0].recognition[0].moves[0] = "e2e5";
      },
    ],
    [
      "duplicate exercise IDs",
      (chapters) => {
        chapters[0].exercises[1].id = chapters[0].exercises[0].id;
      },
    ],
    [
      "missing exercise mode",
      (chapters) => {
        chapters[0].exercises.pop();
      },
    ],
    [
      "history-FEN mismatch",
      (chapters) => {
        chapters[0].exercises[0].history.pop();
      },
    ],
    [
      "illegal answer",
      (chapters) => {
        chapters[0].exercises[0].answers[0].line = ["c2c5"];
      },
    ],
    [
      "duplicate accepted path",
      (chapters) => {
        chapters[0].exercises[0].answers[1].line =
          chapters[0].exercises[0].answers[0].line;
      },
    ],
    [
      "even answer length",
      (chapters) => {
        chapters[0].exercises[0].answers[0].line = ["c2c3", "g8f6"];
      },
    ],
    [
      "answer also a deviation",
      (chapters) => {
        chapters[0].exercises[0].deviations.c2c3 = "Sound alternative";
      },
    ],
    [
      "illegal deviation",
      (chapters) => {
        chapters[0].exercises[0].deviations.e2e5 = "Incorrectly classified";
      },
    ],
    [
      "missing answer explanation",
      (chapters) => {
        chapters[0].exercises[0].answers[0].explanation = "";
      },
    ],
    [
      "ambiguous scripted reply",
      (chapters) => {
        chapters[0].exercises[0].answers[0].line = ["c2c3", "g8f6", "d2d3"];
        chapters[0].exercises[0].answers[1].line = ["c2c3", "d7d6", "d2d3"];
      },
    ],
  ];
  it.each(mutations)("rejects %s", (_, mutate) => {
    const chapters = structuredClone(openingChapters);
    mutate(chapters);
    expect(() => validateOpeningContent(chapters)).toThrow();
  });
});
