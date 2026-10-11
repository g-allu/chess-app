import { INITIAL_FEN } from "../chess/adapter";
import type { Course, Exercise, Source } from "./contracts";
const source: Source = {
  author: "Tempo",
  source:
    "Original instructional positions and explanations authored for Tempo",
  license: "CC0-1.0",
};
const base = { schemaVersion: 1 as const, version: 1, source };
export const exercises: Exercise[] = [
  {
    ...base,
    id: "loose-queen",
    title: "Take the hanging queen",
    skills: ["piece-safety"],
    fen: "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1",
    prompt:
      "White to move. The queen is undefended. Win it without losing your king's safety.",
    hints: [
      "Scan captures: which White piece attacks a2?",
      "Move the rook from a1 to a2: Rxa2.",
    ],
    wrongFeedback:
      "The queen is still on a2. Look at your rook's captures before moving your king or rook away.",
    answers: [
      {
        id: "capture",
        line: ["a1a2"],
        explanation:
          "Rxa2 wins an undefended queen. A hanging piece can be captured without a recapture. Always check your own king first.",
      },
    ],
  },
  {
    ...base,
    id: "bishop-threat",
    title: "Answer the threat",
    skills: ["threats", "piece-safety"],
    fen: "4k3/8/8/6b1/8/8/3Q4/4K3 w - - 0 1",
    prompt:
      "White to move. The bishop attacks your queen along g5–f4–e3–d2. Remove the attacker.",
    hints: [
      "Your queen can travel along the same diagonal.",
      "Capture the bishop with Qxg5: d2 to g5.",
    ],
    wrongFeedback:
      "That move does not remove the attacker. Follow the bishop's diagonal and look for a capture by your queen.",
    answers: [
      {
        id: "remove-attacker",
        line: ["d2g5"],
        explanation:
          "Qxg5 removes the bishop that attacked your queen. Answering a threat can mean capturing the attacker, moving away, or defending; this exercise practices the capture.",
      },
    ],
  },
  {
    ...base,
    id: "queen-mate",
    title: "Close the escape squares",
    skills: ["check-mate"],
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    prompt:
      "White to move. Give checkmate in one. Check the king's captures and escape squares.",
    hints: [
      "The White king protects g7 and h7. The queen can also give mate along rank 8.",
      "Qg7# works: move f7 to g7. Qh7#, Qf8#, and Qe8# also mate.",
    ],
    wrongFeedback:
      "That is legal, but it is not checkmate. Check must be given, and the king must have no legal escape or capture.",
    answers: ["f7g7", "f7h7", "f7f8", "f7e8"].map((move, i) => ({
      id: `mate-${i + 1}`,
      line: [move],
      explanation:
        "Checkmate: the queen checks the king, all escape squares are covered, and the king cannot capture the queen. All four mating moves are accepted.",
    })),
  },
  {
    ...base,
    id: "knight-fork",
    title: "Check, then win the queen",
    skills: ["tactics"],
    fen: "3q3k/8/8/4N3/8/8/8/4K3 w - - 0 1",
    prompt:
      "White to move. Find a knight check that also attacks the queen. After the king replies, take the queen.",
    hints: [
      "A knight on f7 attacks h8 and d8 at the same time.",
      "Play Nf7+, then after ...Kg8 play Nxd8.",
    ],
    wrongFeedback:
      "Look for a knight move that attacks both king and queen. After the check, remember to collect the queen.",
    answers: [
      {
        id: "fork",
        line: ["e5f7", "h8g8", "f7d8"],
        explanation:
          "Nf7+ forks king and queen. The forced check makes Black move the king; after the illustrated ...Kg8, Nxd8 wins the queen. Calculate the follow-up before starting.",
      },
    ],
  },
  {
    ...base,
    id: "knight-notation",
    title: "Read Nf3",
    skills: ["notation"],
    fen: INITIAL_FEN,
    prompt: "White to move. Play Nf3: move the knight to file f, rank 3.",
    hints: [
      "N means knight. f3 is the destination; pawns have no letter.",
      "Move the knight from g1 to f3.",
    ],
    wrongFeedback:
      "Nf3 means a knight ends on f3. Find the White knight that can reach that square.",
    answers: [
      {
        id: "nf3",
        line: ["g1f3"],
        explanation:
          "Nf3 develops the g1 knight. In notation, N is knight, B bishop, R rook, Q queen, K king, x capture, + check, and # checkmate.",
      },
    ],
  },
  {
    ...base,
    id: "black-mate",
    title: "See it from Black's side",
    skills: ["check-mate"],
    fen: "8/8/8/8/8/6k1/5q2/7K b - - 0 1",
    prompt:
      "Black to move. Give checkmate in one. The board is shown from Black's side.",
    hints: [
      "The Black king protects g2 and h2.",
      "Move the queen from f2 to g2: ...Qg2#.",
    ],
    wrongFeedback:
      "Look for a check that covers the White king's escape squares. The Black king can protect your queen.",
    answers: ["f2g2", "f2h2", "f2f1", "f2e1"].map((move, i) => ({
      id: `black-mate-${i + 1}`,
      line: [move],
      explanation:
        "The queen gives check and covers the escape squares, supported by the Black king. Checking the opponent's legal replies works from either side.",
    })),
  },
];
function lesson(
  id: string,
  title: string,
  description: string,
  exerciseId: string,
  text: string,
  exampleText: string,
): Course {
  const exercise = exercises.find((e) => e.id === exerciseId)!;
  const line = exercise.answers[0].line;
  return {
    ...base,
    id,
    kind: "lesson",
    title,
    description,
    skills: exercise.skills,
    steps: [
      { id: `${id}-idea`, kind: "explanation", title: "The idea", text },
      {
        id: `${id}-example`,
        kind: "example",
        title: "Walk through an example",
        text: exampleText,
        fen: exercise.fen,
        line,
        captions: line.map((_, i) =>
          i === line.length - 1
            ? exercise.answers[0].explanation
            : i % 2 === 0
              ? "The knight checks the king and attacks the queen. Black must answer the check."
              : "Black moves the king to safety. Now collect the queen.",
        ),
      },
      { id: `${id}-try`, kind: "exercise", exerciseId },
    ],
  };
}
export const lessons: Course[] = [
  lesson(
    "spot-threats",
    "Spot the threat",
    "Read your opponent's intention before choosing a move.",
    "bishop-threat",
    "Before every move, ask: what did my opponent just attack? Then scan checks, captures, and threats for both sides. Finally, check whether your intended move leaves a piece unprotected. In this position, Black's bishop attacks White's queen.",
    "Trace the bishop's diagonal to the queen. White can capture the attacker because no piece protects it.",
  ),
  lesson(
    "hanging-pieces",
    "Keep your pieces safe",
    "Recognize an undefended piece and check the recapture.",
    "loose-queen",
    "A hanging piece is attacked and undefended. Before a capture, check whether your king stays safe and whether the opponent can recapture. Before your own move, look at every piece you leave behind.",
    "The queen is undefended on a2. White's rook can capture it along the a-file while the king on e1 stays safe.",
  ),
  lesson(
    "check-and-mate",
    "Check is a question. Mate is the answer.",
    "Distinguish a check, checkmate, and stalemate.",
    "queen-mate",
    "Check attacks the king. To escape, the defender may move the king, capture the checking piece, or block a sliding check. Checkmate means there is no legal reply. Stalemate means there is no legal move but the king is not in check: it is a draw.",
    "The White king covers nearby escape squares. Use the queen to give check while covering the rest.",
  ),
  lesson(
    "read-notation",
    "Read the board's language",
    "Files, ranks, and the symbols you'll see in lessons.",
    "knight-notation",
    "Files run a–h and ranks run 1–8, regardless of board orientation. Nf3 means a knight moves to f3. B, R, Q, and K name the other pieces; pawns use just their destination. x means capture, + check, # checkmate, and O-O kingside castling.",
    "Read the destination first, then find the piece that can legally reach it. From the initial position, the g1 knight can move to f3.",
  ),
  lesson(
    "simple-forks",
    "One move, two threats",
    "Calculate a knight fork and its follow-up.",
    "knight-fork",
    "A fork attacks two targets at once. A check is especially useful because the opponent must answer it before saving another piece. Calculate both your first move and the capture after the reply; don't stop at spotting a check.",
    "The knight jumps to f7, attacking king and queen. This example illustrates ...Kg8; after that reply, the knight takes the queen.",
  ),
];
export const sessions: Course[] = [
  {
    ...base,
    id: "starter-calculation",
    kind: "session",
    title: "Pause. Scan. Calculate.",
    description:
      "Six positions, no clock. Check threats, checks, captures, and piece safety before moving.",
    skills: ["threats", "piece-safety", "check-mate", "notation", "tactics"],
    steps: exercises.map((e) => ({
      id: `practice-${e.id}`,
      kind: "exercise" as const,
      exerciseId: e.id,
    })),
  },
  {
    ...base,
    id: "quick-recognition",
    kind: "session",
    title: "Short recognition drill",
    description:
      "Optional: 30 seconds per position. After time expires, keep learning at your own pace. Start with untimed practice first.",
    skills: ["piece-safety", "check-mate", "notation"],
    secondsPerExercise: 30,
    steps: ["loose-queen", "knight-notation", "queen-mate"].map((id) => ({
      id: `quick-${id}`,
      kind: "exercise" as const,
      exerciseId: id,
    })),
  },
];
export const courses = [...lessons, ...sessions];
export function getExercise(id: string): Exercise {
  const exercise = exercises.find((e) => e.id === id);
  if (!exercise) throw new Error(`Exercise unavailable: ${id}`);
  return exercise;
}
export function getCourse(id: string): Course {
  const course = courses.find((c) => c.id === id);
  if (!course) throw new Error(`Content unavailable: ${id}`);
  return course;
}
