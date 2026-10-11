import { Chess } from "chess.js";
import { INITIAL_FEN, replay } from "../chess/adapter";
import type { Course, Source } from "../learning/contracts";
import type {
  OpeningChapter,
  OpeningExercise,
  OpeningPath,
  PlanQuestion,
} from "./contracts";
import { buildOpeningGraph } from "./graph";
import { parseOpeningPgn, pgnPaths } from "./pgn";

const source: Source = {
  author: "Tempo",
  source:
    "Original Tempo opening lessons and authored illustrative model-game excerpts. Legal replay and concrete capture claims checked with chess.js; separate AI editorial review and finite offline Stockfish 18 checks at 150,000 nodes per search, Threads 1, Hash 32 MiB. Reproducible results and engine provenance: src/openings/engine-review.json. These checks do not establish best play or complete coverage; no independent human review is claimed.",
  license: "CC0-1.0",
};
const base = { schemaVersion: 1 as const, version: 1, source };
function uci(san: string): string[] {
  const game = new Chess();
  return san
    .split(/\s+/)
    .filter(Boolean)
    .map((move) => game.move(move).lan);
}
function paths(
  id: string,
  pgn: string,
  model: string,
  modelNotes: string[],
): OpeningPath[] {
  const parsed = pgnPaths(parseOpeningPgn(pgn));
  // The PGN main line is last; variations are emitted first and keep all comments.
  const main = parsed.pop()!;
  return [
    { id: `${id}-main`, title: "Main branch", kind: "main", ...main },
    ...parsed.map((path, i) => ({
      id: `${id}-sideline${i ? `-${i + 1}` : ""}`,
      title: `Practical sideline ${i + 1}`,
      kind: "sideline" as const,
      ...path,
    })),
    {
      id: `${id}-model`,
      title: "Authored illustrative model-game excerpt",
      kind: "model",
      moves: uci(model),
      captions: uci(model).map(
        (_, i) =>
          modelNotes[i] ??
          "Complete development while keeping the pawn structure in view. Original illustrative continuation; no forced advantage claimed.",
      ),
    },
  ];
}
function exercise(
  id: string,
  title: string,
  position: string,
  prompt: string,
  moves: [string, string][],
  deviations: Record<string, string>,
  wrongFeedback: string,
  mode: OpeningExercise["mode"],
): OpeningExercise {
  const history = uci(position);
  const game = replay(history);
  return {
    ...base,
    id,
    title,
    skills: ["openings"],
    history,
    fen: game.fen(),
    mode,
    prompt,
    hints: [
      "Inspect the changed reply, then look for the central break and a useful developing move.",
      `${moves.map(([move]) => new Chess(game.fen()).move(move).san).join(" or ")} follows this exercise's goal.`,
    ],
    wrongFeedback,
    deviations,
    answers: moves.map(([move, explanation], i) => ({
      id: `${id}-answer-${i + 1}`,
      line: [move],
      explanation,
    })),
  };
}
function question(
  id: string,
  prompt: string,
  correct: string,
  wrong: string,
  explanation: string,
): PlanQuestion {
  return {
    id,
    prompt,
    choices: [
      { id: "plan", text: correct, correct: true, explanation },
      {
        id: "rush",
        text: wrong,
        correct: false,
        explanation: `Reconsider the pawn structure and development. ${explanation}`,
      },
    ],
  };
}

const italianPgn = `[Event "Tempo authored Italian course"]
[Annotator "Tempo; original CC0 commentary; separate AI editorial and finite Stockfish 18 review; see src/openings/engine-review.json"]
[Result "*"]
1.e4 {White takes central space and opens the bishop.} e5 {Black contests the same space.}
2.Nf3 {Develop and attack e5.} Nc6 {Defend e5 while developing.}
3.Bc4 {Aim at f7 without assuming an immediate attack wins.} Bc5 {Black develops toward f2.}
(3...Nf6 {The Two Knights attacks e4; reassess the threat.} 4.d3 {Support e4 and free the c1 bishop.}
 (4.Ng5 {A sharper sound option targeting f7: exact play matters.} d5 {Black challenges the center immediately.} 5.exd5 {Open the center.} Na5 {Attack the c4 bishop; this sharp branch ends here.})
 Bc5 {Black develops.} 5.O-O {Safeguard the king.} d6 {Support e5.} 6.c3 {Prepare d4.} O-O {Both sides can now consider a central break.})
4.c3 {Prepare d4; the d-pawn can instead advance one step first.}
(4.d3 {A documented slower alternative supports e4.} Nf6 {Attack e4.} 5.O-O {King safety before a central fight.} d6 {Support e5.} 6.c3 {The same c3/d3 setup can arise in another order.} O-O {This transposes to the main six-move position.})
Nf6 {Develop and attack e4.} 5.d3 {Keep e4 defended before opening the center.} d6 {Black supports e5 and frees the c8 bishop.}
6.O-O {Move the king away from the center.} O-O {Black does the same.}
7.Re1 {Support e4 before d4.} a6 {Give the bishop a retreat on a7.} 8.Bb3 {Keep the diagonal while avoiding exchanges.} Ba7 {Preserve the bishop.} *`;
const caroPgn = `[Event "Tempo authored Caro-Kann course"]
[Annotator "Tempo; original CC0 commentary; separate AI editorial and finite Stockfish 18 review; see src/openings/engine-review.json"]
[Result "*"]
1.e4 {White claims central space.} c6 {Prepare d5 with a pawn recapture available.}
2.d4 {Build the pawn center.} d5 {Challenge e4.}
3.e5 {The Advance gains space but leaves a fixed central chain.}
(3.exd5 {The Exchange removes the e-pawn tension.} cxd5 {Recapture toward the center.} 4.Bd3 {White develops toward h7.} Nc6 {Develop and pressure d4.} 5.c3 {Support d4.} Nf6 {Develop.} 6.Nf3 {White develops.} Bg4 {Activate the bishop before e6.} 7.O-O {White protects the king.} e6 {Black supports d5 and prepares the other bishop.})
Bf5 {Get the light bishop outside the chain before e6.} 4.Nf3 {Support d4 and develop.} e6 {Secure d5; the bishop is already active.}
5.Be2 {Prepare castling.} c5 {Challenge the base of the chain on d4.} 6.O-O {White completes king safety.} Nc6 {Add pressure to d4.}
7.c3 {White reinforces the chain.} cxd4 {An illustrative release of tension, not a forced best move.} 8.cxd4 {White recaptures and keeps two central pawns.} *`;
const qgdPgn = `[Event "Tempo authored Queen's Gambit Declined course"]
[Annotator "Tempo; original CC0 commentary; separate AI editorial and finite Stockfish 18 review; see src/openings/engine-review.json"]
[Result "*"]
1.d4 {White occupies the center.} d5 {Black meets it directly.}
(1...Nf6 {Develop first: a valid move-order choice.} 2.c4 {White offers the gambit.} e6 {Prepare d5.} 3.Nc3 {Develop.} d5 {The same position as 1.d4 d5 2.c4 e6 3.Nc3 Nf6.})
2.c4 {Pressure d5.}
(2.Bf4 {The London develops without an early c4 challenge.} Nf6 {Develop before committing the c-pawn.} 3.e3 {Support d4.} e6 {Free the f8 bishop.} 4.Nf3 {White develops.} Bd6 {Contest the active London bishop.} 5.Bg3 {Preserve it.} O-O {Black completes king safety.} 6.Bd3 {White develops.} c5 {Challenge d4 rather than copy the main line blindly.} 7.O-O {White castles.} Nc6 {Black adds central pressure.})
e6 {Support d5; the c8 bishop needs a later solution.} 3.Nc3 {White develops.} Nf6 {Develop and defend d5.}
4.Bg5 {Pin the knight along the queen's diagonal.} Be7 {Break the pin and prepare castling.} 5.e3 {White opens the f1 bishop.} O-O {Black protects the king.}
6.Nf3 {White develops.} h6 {Ask the bishop to decide; this is not required in every QGD.} 7.Bh4 {White keeps the bishop.} b6 {Prepare Bb7 for the c8 bishop.}
8.cxd5 {White releases the c-pawn tension.} exd5 {Black retains a d5 pawn.} 9.Bd3 {Develop toward h7.} Bb7 {Activate the bishop.} 10.O-O {White castles.} Nbd7 {Black connects development with support for a future c5 break.} *`;

const italianExercises = [
  exercise(
    "italian-guess",
    "Prepare the Italian center",
    "e4 e5 Nf3 Nc6 Bc4 Bc5",
    "White to move. Choose the taught pawn preparation: prepare d4 or first support e4.",
    [
      [
        "c2c3",
        "c3 prepares d4. Inspect Black's pressure on e4 before pushing d4; here d3 is a useful next step.",
      ],
      [
        "d2d3",
        "d3 is a documented sound alternative: defend e4, open the c1 bishop, then prepare c3 and d4.",
      ],
    ],
    {
      e1g1: "O-O is a sound developing move outside this pawn-preparation goal. It is a repertoire deviation, not a chess mistake.",
    },
    "This goal is central preparation. Ng5? allows ...Qxg5 and drops the knight. Nxe5 requires calculation of ...Nxe5 and the d4 fork; do not judge that line from the first capture alone.",
    "guess",
  ),
  exercise(
    "italian-unfamiliar",
    "Respond to the Two Knights",
    "e4 e5 Nf3 Nc6 Bc4 Nf6",
    "Black changed the reply to ...Nf6 and attacks e4. Protect or support your center with a d-pawn move.",
    [
      [
        "d2d3",
        "d3 directly supports e4 and opens the c1 bishop; keep developing before choosing d4.",
      ],
      [
        "d2d4",
        "d4 is a sound active alternative: challenge e5 and open the c1 bishop. The knight on f6 still attacks e4; captures such as ...exd4 require concrete calculation rather than quiet-system memorization.",
      ],
    ],
    {
      f3g5: "Ng5 is a sound sharp deviation targeting f7. Black's ...d5 changes the center; this chapter shows a compact branch but does not promise full tactical coverage.",
    },
    "...Nf6 attacks e4. Pick the taught d-pawn response. Unlisted moves are outside the task, not automatically losing; compare them before drawing a chess conclusion.",
    "unfamiliar",
  ),
  exercise(
    "italian-recognition",
    "Recognize the prepared central break",
    "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7",
    "Recognize the c3/d3 structure with king safety and e4 support. Play the thematic central pawn break.",
    [
      [
        "d3d4",
        "d4 is now supported by c3 and opens the center with the king castled. Black can answer ...exd4; after cxd4 the c-pawn replaces the center pawn.",
      ],
    ],
    {
      b1d2: "Nbd2 is a sound slower developing option, a deviation from this immediate-break exercise.",
    },
    "The structure points to d4. This task teaches a plan, not a claim that every other legal move is a mistake.",
    "recognition",
  ),
];
const caroExercises = [
  exercise(
    "caro-kann-guess",
    "Free the Caro-Kann bishop",
    "e4 c6 d4 d5 e5",
    "Black to move in the Advance. Develop the light bishop outside the pawn chain before ...e6.",
    [
      [
        "c8f5",
        "...Bf5 activates the light bishop before ...e6. Black then develops and challenges d4 with ...c5.",
      ],
    ],
    {
      c6c5: "An immediate ...c5 is a sound alternative Caro-Kann system; it is outside this bishop-first repertoire, not a chess error.",
      e7e6: "...e6 is a playable quieter structure that keeps the bishop inside the chain. Treat it as a repertoire deviation, not an automatic chess mistake.",
    },
    "Free the bishop with ...Bf5. Here ...Bg4? leaves the bishop undefended and White can play Qxg4 along the open d1-e2-f3-g4 diagonal.",
    "guess",
  ),
  exercise(
    "caro-kann-unfamiliar",
    "Meet an unfamiliar Exchange",
    "e4 c6 d4 d5 exd5",
    "White exchanges rather than advancing. Black to move: recapture with the pawn toward the center.",
    [
      [
        "c6d5",
        "...cxd5 restores the pawn count and occupies d5. Develop ...Nc6 and ...Nf6; the closed Advance-chain script no longer applies.",
      ],
    ],
    {
      d8d5: "...Qxd5 is a playable queen recapture outside this pawn-structure repertoire. White can develop Nc3 with tempo against the queen; it is not automatically a chess mistake.",
    },
    "The requested pawn recapture is ...cxd5. An early queen recapture is a repertoire deviation; compare its lost development tempo rather than calling every legal alternative a blunder.",
    "unfamiliar",
  ),
  exercise(
    "caro-kann-recognition",
    "Challenge the pawn-chain base",
    "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2",
    "Black to move. Recognize the fixed d4/e5 chain and play the thematic c-pawn break.",
    [
      [
        "c6c5",
        "...c5 attacks the base on d4. Follow with development such as ...Nc6; do not assume this move wins a pawn.",
      ],
    ],
    {
      g8e7: "...Ne7 is a sound developing deviation, but this task asks for the thematic pawn break.",
    },
    "Challenge d4 with ...c5. White's e5 pawn limits your space, so waiting without central counterplay can make development harder.",
    "recognition",
  ),
];
const qgdExercises = [
  exercise(
    "qgd-guess",
    "Resolve the QGD pin",
    "d4 d5 c4 e6 Nc3 Nf6 Bg5",
    "Black to move. Develop the f8 bishop so you can castle and remove the queen pin on the knight.",
    [
      [
        "f8e7",
        "...Be7 interposes the bishop on the g5-d8 diagonal and prepares O-O.",
      ],
    ],
    {
      b8d7: "...Nbd7 is a sound QGD move-order deviation. It develops and supports f6, but does not meet this bishop-development goal.",
      h7h6: "...h6 is a sound move-order choice asking the bishop to decide; development and king safety still need attention.",
    },
    "Develop ...Be7 for this goal. In particular, ...Ne4? leaves the diagonal g5-f6-e7-d8 open and allows Bxd8, losing the queen.",
    "guess",
  ),
  exercise(
    "qgd-unfamiliar",
    "Meet the London without copying",
    "d4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Bd3",
    "White chose the London instead of c4. Black to move: use the thematic c-pawn challenge to d4.",
    [
      [
        "c7c5",
        "...c5 challenges White's center even without a gambit. Finish ...Nc6 and compare central exchanges before choosing an attack.",
      ],
    ],
    {
      b8c6: "...Nc6 is a sound developing deviation. This question specifically asks for the c-pawn break.",
    },
    "The taught idea transfers to the London: pressure d4 with ...c5. A kingside attack is not justified merely because White moved a bishop several times.",
    "unfamiliar",
  ),
  exercise(
    "qgd-recognition",
    "Prepare the Exchange-structure minority attack",
    "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 c6 Qc2 Nbd7 Nf3 Re8 O-O Nf8",
    "White to move in the Exchange structure. Prepare b4 safely: move the a-pawn one square or put a rook on the b-file to support b4.",
    [
      [
        "a2a3",
        "a3 supports b4 so the bishop on e7 cannot simply win that pawn. White can later aim b5 at c6; Black seeks central activity with ...Ne4 or ...c5.",
      ],
      [
        "a1b1",
        "Rb1 puts a rook behind the future b4 pawn. Immediate b4? would be undefended along the bishop's e7-d6-c5-b4 diagonal; prepare the break rather than copy it blindly.",
      ],
    ],
    {
      f1e1: "Re1 is sound central preparation outside this queenside-plan exercise.",
    },
    "Prepare b4 with a3 or Rb1. Immediate b4? permits ...Bxb4 and drops an undefended pawn. The structure suggests a plan, but tactics determine the move order.",
    "recognition",
  ),
];

const italianPaths = paths(
  "italian",
  italianPgn,
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 d4 exd4 cxd4 Bg4 Be3",
  [
    "Original authored model excerpt: illustrate development and a prepared central break; not a historical game or engine-verified best line.",
  ],
);
const caroPaths = paths(
  "caro-kann",
  caroPgn,
  "e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6",
  [
    "Original authored model excerpt: demonstrate light-bishop development, a tempo-gaining pawn chase, and a safe bishop retreat. This classical branch is reference coverage only.",
  ],
);
const qgdPaths = paths(
  "qgd",
  qgdPgn,
  "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 c6 Qc2 Nbd7 Nf3 Re8 O-O Nf8",
  [
    "Original authored model excerpt: illustrate the Exchange pawn structure, ...c6 support, and knight rerouting. No result or engine superiority is claimed.",
  ],
);
// Make model commentary useful at concrete structural turning points.
italianPaths.at(-1)!.captions[16] =
  "d4 opens the center after castling and Re1; c3 enables a pawn recapture on d4.";
italianPaths.at(-1)!.captions[18] =
  "cxd4 restores White's central pawn. Black can develop ...Bg4; White can meet it with Be3. This is an illustration, not a forced sequence.";
caroPaths.at(-1)!.captions[7] =
  "...Bf5 develops with tempo against Ne4; White's Ng3 then attacks the bishop.";
caroPaths.at(-1)!.captions[11] =
  "...h6 gives the bishop h7 when h5 attacks it. Check actual retreat squares before chasing pieces.";
qgdPaths.at(-1)!.captions[7] =
  "...exd5 creates the Exchange structure: White has a queenside pawn minority; Black has central/kingside space.";
qgdPaths.at(-1)!.captions[13] =
  "...c6 supports d5 but gives White a target for b4-b5. Black should also prepare central counterplay.";
const transposition = qgdPaths.find(
  (path) => path.moves.length === 6 && path.kind === "sideline",
)!;
transposition.id = "qgd-transposition";
transposition.title = "Same position through ...Nf6 first";
qgdPaths.find(
  (path) => path.kind === "sideline" && path !== transposition,
)!.id = "qgd-sideline";

export const openingChapters: OpeningChapter[] = [
  {
    ...base,
    id: "italian",
    title: "Italian: build the center safely",
    color: "w",
    description:
      "A first White chapter after 1.e4 e5: quiet Italian development, Two Knights adaptation, and the prepared d4 break.",
    layers: {
      essential:
        "White develops Nf3 and Bc4, protects the king, and chooses c3/d3 before d4. The bishop points at f7, but this is not a license to sacrifice. Black develops ...Nc6 and ...Bc5 or ...Nf6, supports e5 with ...d6, and can later challenge with ...d5. Inspect e4 after ...Nf6 and f2 after ...Bc5.",
      practical:
        "Against ...Bc5, c3 prepares d4 and d3 directly protects e4; both are accepted. Against ...Nf6, d3 meets the threat, while d4 is an active alternative requiring calculations of ...exd4. Put the rook on e1 and retain c3 support before the model d4 break. Black can meet d4 with ...exd4 or central counterplay. c3 and d3 move orders transpose without changing the plan.",
      advanced:
        "Precision matters when a knight jumps to g5: after ...Bc5, Ng5? permits ...Qxg5; after ...Nf6, Ng5 is a legitimate sharp branch and ...d5 is the key reply. Nxe5 is outside this quiet repertoire: calculate ...Nxe5 and the d4 fork rather than judging a single capture. Quiet positions allow several moves; exact attack lines demand calculation. The model excerpt stops in the middlegame with an open center and active bishops; it does not establish an advantage or cover every defense.",
    },
    coverage: [
      "3...Bc5 with c3/d3 preparation",
      "3...Nf6 with d3 and compact Ng5/d5 reference",
      "c3/d3 move-order transposition",
      "Prepared d4 middlegame excerpt",
    ],
    uncovered: [
      "Sicilian 1...c5",
      "French 1...e6",
      "Caro-Kann 1...c6",
      "Scandinavian 1...d5",
      "Petroff 2...Nf6 and sharp Two Knights continuations beyond this tree",
    ],
    deviations: [
      {
        reply: "1...c5 / 1...e6 / 1...c6",
        advice:
          "The Italian requires ...e5. Develop and inspect central pawn tension; do not copy Bc4 and c3 automatically. These defenses need separate chapters.",
      },
      {
        reply: "1...d5",
        advice:
          "Consider exd5 and develop against the exposed queen if ...Qxd5. This is a compact reference, not a full Scandinavian repertoire.",
      },
      {
        reply: "2...Nf6",
        advice:
          "The Petroff attacks e4 before ...Nc6. Check the e4/e5 tension and develop; this chapter does not supply a full Petroff line.",
      },
    ],
    paths: italianPaths,
    graph: buildOpeningGraph(italianPaths),
    exercises: italianExercises,
    planQuestions: [
      question(
        "italian-plan",
        "Why combine c3, d3, king safety, and Re1?",
        "Support e4 and prepare a well-supported d4 break.",
        "Sacrifice on f7 immediately regardless of defenders.",
        "c3 supports a pawn on d4, d3 supports e4, and king safety makes opening the center less risky. Black wants active development and a timely central challenge.",
      ),
    ],
    recognition: [
      {
        ...question(
          "italian-recognize",
          "Which plan fits this c3/d3 position?",
          "Finish development and prepare d4 while checking e4.",
          "The f7 bishop target guarantees a winning attack.",
          "This is a quiet Italian structure. The d4 break needs preparation; Black has the same right to contest the center.",
        ),
        moves: uci("e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O d6 c3 O-O"),
      },
    ],
    pgn: italianPgn,
  },
  {
    ...base,
    id: "caro-kann",
    title: "Caro-Kann: bishop first, then counterplay",
    color: "b",
    description:
      "A first Black chapter against 1.e4: Advance development, Exchange adaptation, and pressure on the pawn-chain base.",
    layers: {
      essential:
        "Black uses ...c6 and ...d5 to contest e4. In the Advance, free the c8 bishop with ...Bf5 before ...e6, then develop and challenge d4 with ...c5. White has more space and wants smooth development, king safety, and useful kingside pressure. Black should attack the chain's base rather than remain cramped.",
      practical:
        "After e5, ...Bf5 is the teaching repertoire. ...Bg4? is different here: White's queen can take the undefended bishop on g4 because e2 and f3 are empty. ...e6 supports d5 and frees the f8 bishop, but first notice the c8 bishop. In the Exchange, ...cxd5 restores material and ...Nc6/...Nf6 pressure d4; only after Nf3 does the shown ...Bg4 safely pin the knight. White's Bd3 points at h7, so complete king safety and contest active pieces. The model classical excerpt demonstrates bishop retreats after Ng3 and h4/h5.",
      advanced:
        "...c5 can be played immediately in the Advance as a separate sound system; the course does not label it a mistake. Precision matters when White chases Bf5: verify ...Bg6 and the h7 escape, and avoid walking into a trapped bishop. In the Exchange position after exd5, ...Qxd5 is playable but White can gain a development tempo with Nc3 against the queen. Structural pawn breaks alter the middlegame; the included exchange of c-pawns is illustrative, not a required engine-best sequence.",
    },
    coverage: [
      "Advance 3.e5 with ...Bf5 development",
      "Exchange 3.exd5 and ...cxd5",
      "Thematic ...c5 pawn-chain challenge",
      "Classical 3.Nd2 illustrative bishop-chase excerpt",
    ],
    uncovered: [
      "Panov-Botvinnik with an early c4",
      "Fantasy 3.f3",
      "Two Knights with 2.Nc3/3.Nf3",
      "Complete classical knight/queen middlegames",
    ],
    deviations: [
      {
        reply: "3.f3",
        advice:
          "The Fantasy supports e4 with a pawn and opens king diagonals. Inspect central captures and develop before choosing a setup; this tree does not prescribe a complete answer.",
      },
      {
        reply: "Exchange followed by c4",
        advice:
          "The Panov can create an isolated d-pawn after exchanges. Pressure the center and finish development; do not apply a closed Advance-chain plan.",
      },
      {
        reply: "2.Nc3 / 3.Nf3",
        advice:
          "Check the e4 pawn tension and develop. White has delayed d4; avoid assuming the main Advance structure is already present.",
      },
    ],
    paths: caroPaths,
    graph: buildOpeningGraph(caroPaths),
    exercises: caroExercises,
    planQuestions: [
      question(
        "caro-kann-plan",
        "What is Black's recurring Advance plan?",
        "Free the light bishop, develop, and attack d4 with ...c5.",
        "Keep every pawn fixed and wait for White's attack.",
        "The bishop is easier to develop before ...e6. Pressure on d4 gives Black counterplay against White's space; White wants to protect the chain and develop.",
      ),
    ],
    recognition: [
      {
        ...question(
          "caro-kann-recognize",
          "What has changed after the Exchange?",
          "There is no White e5 chain: develop and pressure the d4 pawn.",
          "Play the same bishop chase as in every Advance game.",
          "Pawn structure, not the opening name alone, determines the plan. The c-pawn recapture makes ...Nc6 available.",
        ),
        moves: uci("e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6"),
      },
    ],
    pgn: caroPgn,
  },
  {
    ...base,
    id: "qgd",
    title: "Queen's Gambit Declined: develop and challenge d4",
    color: "b",
    description:
      "A first Black chapter against 1.d4: sound development, a London sideline, transpositions, and Exchange-structure plans.",
    layers: {
      essential:
        "Black supports d5 with ...e6, develops ...Nf6 and ...Be7, and castles. The c8 bishop needs a plan such as ...b6/...Bb7; prepare a timely ...c5 central break. White pressures d5 with c4, develops actively, and may pin Nf6 with Bg5. Avoid moving the pinned knight if doing so exposes the queen.",
      practical:
        "...Nf6 before ...d5 reaches the same position after c4/e6/Nc3. Against Bg5, ...Be7 breaks the queen pin and prepares castling. In the London sideline, White has no c4 pawn: develop, contest Bf4 with ...Bd6, and challenge d4 with ...c5. After cxd5 exd5, White can pursue a b4-b5 minority attack; Black seeks central activity and can prepare ...c5 or ...Ne4.",
      advanced:
        "Precision matters on the g5-d8 diagonal: in the exercise position, ...Ne4? permits Bxd8 and loses the queen. ...Nbd7 and ...h6 are sound alternative move orders, not errors. In the model Exchange structure, ...c6 supports d5 but becomes a queenside target. ...Nf8 illustrates knight rerouting; it is not forced. Later ...c5 needs concrete preparation because exchanges can expose the center or leave an isolated pawn. Endgame prospects depend on actual exchanges, not a memorized opening label.",
    },
    coverage: [
      "QGD development against c4/Nc3/Bg5",
      "...Nf6-first transposition",
      "London Bf4 practical sideline with ...c5",
      "Exchange structure and minority-attack model excerpt",
    ],
    uncovered: [
      "Catalan with g3/Bg2",
      "Trompowsky 2.Bg5 against ...Nf6",
      "Torre/Colle full branches",
      "Complete QGD tactical theory beyond the shown development",
    ],
    deviations: [
      {
        reply: "g3 and Bg2",
        advice:
          "The Catalan puts a bishop on the long diagonal. Develop and inspect d5/c4 tension; taking c4 requires concrete pawn-recovery calculations not covered here.",
      },
      {
        reply: "2.Bg5 after ...Nf6",
        advice:
          "The Trompowsky may exchange on f6. Check doubled-pawn recaptures and central development; a full response is outside this chapter.",
      },
      {
        reply: "e3 without c4",
        advice:
          "Colle/Torre setups develop before challenging the center. ...c5 remains a useful idea, but compare the actual bishop placement and tactics.",
      },
    ],
    paths: qgdPaths,
    graph: buildOpeningGraph(qgdPaths),
    exercises: qgdExercises,
    planQuestions: [
      question(
        "qgd-plan",
        "Why does Black need a central break and a c8-bishop plan?",
        "...e6 supports d5 but restricts the c8 bishop; development and ...c5 provide counterplay.",
        "The pawn chain automatically wins so Black can ignore development.",
        "Black gains a solid center at a cost in bishop mobility. White wants active pieces and central/queenside pressure, so Black needs piece activity and central challenges.",
      ),
    ],
    recognition: [
      {
        ...question(
          "qgd-recognize",
          "Which structure and plans fit this position?",
          "Exchange QGD: White can prepare b4-b5; Black seeks central counterplay.",
          "White still has a c4 pawn and must attack d5 with it.",
          "cxd5 exd5 removed White's c-pawn and Black's e-pawn. Recognize the structure before choosing a minority attack or a central plan.",
        ),
        moves: uci("d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 c6"),
      },
    ],
    pgn: qgdPgn,
  },
];

export function getOpeningChapter(id: string): OpeningChapter {
  const chapter = openingChapters.find((item) => item.id === id);
  if (!chapter) throw new Error(`Unknown opening chapter: ${id}`);
  return chapter;
}
export const openingExercises = openingChapters.flatMap(
  (chapter) => chapter.exercises,
);
export function openingDeviation(
  exerciseId: string,
  move: string,
): string | undefined {
  return openingExercises.find((exercise) => exercise.id === exerciseId)
    ?.deviations[move];
}
export const openingCourses: Course[] = [
  ...openingChapters.map((chapter): Course => ({
    ...base,
    id: `opening-${chapter.id}`,
    kind: "lesson",
    title: chapter.title,
    description: chapter.description,
    skills: ["openings"],
    steps: [
      {
        id: `${chapter.id}-lesson-plan`,
        kind: "explanation",
        title: "Essential plans for both sides",
        text: chapter.layers.essential,
      },
      {
        id: `${chapter.id}-lesson-main`,
        kind: "example",
        title: "Guided main branch",
        text: chapter.layers.practical,
        fen: INITIAL_FEN,
        history: [],
        line: chapter.paths[0].moves,
        captions: chapter.paths[0].captions,
      },
      {
        id: `${chapter.id}-lesson-guess`,
        kind: "exercise",
        exerciseId: chapter.exercises[0].id,
      },
      {
        id: `${chapter.id}-lesson-side`,
        kind: "example",
        title: "Adapt to a practical sideline",
        text: "Apply the plan to a changed reply; compare the position instead of copying the move list.",
        fen: INITIAL_FEN,
        history: [],
        line: chapter.paths.find(
          (path) => path.kind === "sideline" && path.moves.length > 6,
        )!.moves,
        captions: chapter.paths.find(
          (path) => path.kind === "sideline" && path.moves.length > 6,
        )!.captions,
      },
      {
        id: `${chapter.id}-lesson-unfamiliar`,
        kind: "exercise",
        exerciseId: chapter.exercises[1].id,
      },
      {
        id: `${chapter.id}-lesson-reference`,
        kind: "explanation",
        title: "Precision and reference limits",
        text: `${chapter.layers.advanced} Covered: ${chapter.coverage.join("; ")}. Uncovered: ${chapter.uncovered.join("; ")}.`,
      },
      {
        id: `${chapter.id}-lesson-model`,
        kind: "example",
        title: "Original illustrative model-game excerpt",
        text: chapter.source.source,
        fen: INITIAL_FEN,
        history: [],
        line: chapter.paths.at(-1)!.moves,
        captions: chapter.paths.at(-1)!.captions,
      },
      {
        id: `${chapter.id}-lesson-recognition`,
        kind: "exercise",
        exerciseId: chapter.exercises[2].id,
      },
    ],
  })),
  ...openingChapters.map((chapter): Course => ({
    ...base,
    id: `opening-train-${chapter.id}`,
    kind: "session",
    title: `${chapter.title}: branch practice`,
    description:
      "Untimed main-branch recall, unfamiliar reply, and structure recognition.",
    skills: ["openings"],
    steps: chapter.exercises.map((item) => ({
      id: `branch-practice-${item.id}`,
      kind: "exercise",
      exerciseId: item.id,
    })),
  })),
  {
    ...base,
    id: "opening-mixed",
    kind: "session",
    title: "Mixed opening branches",
    description:
      "Compare changed replies across the Italian, Caro-Kann, and QGD.",
    skills: ["openings"],
    steps: openingChapters
      .flatMap((chapter) => chapter.exercises.slice(0, 2))
      .map((item) => ({
        id: `mixed-${item.id}`,
        kind: "exercise",
        exerciseId: item.id,
      })),
  },
  {
    ...base,
    id: "opening-position-recognition",
    kind: "session",
    title: "Opening position recognition",
    description: "Recognize the pawn structure and execute its thematic plan.",
    skills: ["openings"],
    steps: openingChapters.map((chapter) => ({
      id: `recognition-practice-${chapter.id}`,
      kind: "exercise",
      exerciseId: chapter.exercises[2].id,
    })),
  },
];
