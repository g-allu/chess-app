import type { Course, Exercise, Source } from "./contracts";

const source: Source = {
  author: "Tempo",
  source:
    "Original endgame teaching positions and explanations authored for Tempo",
  license: "CC0-1.0",
};
const base = { schemaVersion: 1 as const, version: 1, source };

export const endgameExercises: Exercise[] = [
  {
    ...base,
    id: "queen-box-mate",
    title: "Finish the queen's box",
    skills: ["endgames", "check-mate"],
    fen: "k7/2Q5/1K6/8/8/8/8/8 w - - 0 1",
    prompt:
      "White to move. Give checkmate in one with your queen. More than one move works.",
    hints: [
      "Your king on b6 controls a7 and b7. Check which queen moves cover a8 and b8.",
      "Qb7#, Qa7#, Qc8#, and Qd8# all work.",
    ],
    wrongFeedback:
      "A queen can restrict the king without checking it. For this finish, give check and cover every escape square; avoid stalemate.",
    answers: ["c7b7", "c7a7", "c7c8", "c7d8"].map((move, i) => ({
      id: `queen-finish-${i + 1}`,
      line: [move],
      explanation:
        "The queen checks a8 and covers b8. The White king covers a7 and b7. Black cannot escape or capture the queen: checkmate. All four mating moves are accepted.",
    })),
  },
  {
    ...base,
    id: "rook-edge-mate",
    title: "Mate along the edge",
    skills: ["endgames", "check-mate"],
    fen: "k7/7R/1K6/8/8/8/8/8 w - - 0 1",
    prompt:
      "White to move. The king is already at the edge. Finish with checkmate in one.",
    hints: [
      "The White king covers a7 and b7. Your rook must check along rank 8.",
      "Move the rook from h7 to h8: Rh8#.",
    ],
    wrongFeedback:
      "Check which escape squares your king covers. A rook check alone may let the king escape; use both pieces together.",
    answers: [
      {
        id: "rook-finish",
        line: ["h7h8"],
        explanation:
          "Rh8# checks along rank 8 and covers b8. The king on b6 controls a7 and b7, so Black has no legal reply.",
      },
    ],
  },
  {
    ...base,
    id: "active-king",
    title: "Support the next pawn square",
    skills: ["endgames"],
    fen: "7k/7p/8/8/3P4/4K3/8/8 w - - 0 1",
    prompt:
      "White to move. Activate your king: move it forward so it protects your pawn's next square, d5.",
    hints: [
      "A king protects the eight adjacent squares. Which forward king move will put d5 within reach?",
      "Ke4 brings the king next to d5 while still protecting the pawn on d4.",
    ],
    wrongFeedback:
      "This exercise asks for king support of d5. A pawn push or a king move away from d5 does not practice that goal.",
    answers: [
      {
        id: "support-d5",
        line: ["e3e4"],
        explanation:
          "Ke4 activates the king and protects both d4 and d5. With fewer pieces on the board, the king can help a pawn advance. This support exercise does not claim a forced win.",
      },
    ],
  },
  {
    ...base,
    id: "distant-opposition",
    title: "Take distant opposition",
    skills: ["endgames"],
    fen: "8/7p/3k4/8/8/8/4K2P/8 w - - 0 1",
    prompt:
      "White to move. Take distant opposition: put your king on Black's file with three empty squares between the kings, leaving Black to move.",
    hints: [
      "Black's king is on d6. Your target should be on the d-file, four ranks away.",
      "Kd2 leaves d3, d4, and d5 between the kings.",
    ],
    wrongFeedback:
      "Count the empty squares between the kings. For this exercise, line them up on the d-file with three empty squares and Black to move.",
    answers: [
      {
        id: "d-file-opposition",
        line: ["e2d2"],
        explanation:
          "Kd2 takes distant opposition: the kings share a file with three empty squares between, and Black moves next. Opposition helps with king maneuvering, but pawn moves and the rest of the position decide whether it produces an advantage.",
      },
    ],
  },
  {
    ...base,
    id: "promotion-choice",
    title: "Promote into a mating endgame",
    skills: ["endgames"],
    fen: "7k/1P6/2K5/8/8/8/8/8 w - - 0 1",
    prompt:
      "White to move. Promote with check and enough material for a basic mating endgame. Both a queen and a rook meet this goal.",
    hints: [
      "A pawn on b7 can promote on b8. Choose the new piece after moving it.",
      "b8=Q+ is the usual powerful choice; b8=R+ also works here.",
    ],
    wrongFeedback:
      "Promote on b8 to a queen or rook. A lone bishop or knight with a king cannot mate a bare king; choose enough material for this goal.",
    answers: ["b7b8q", "b7b8r"].map((move, i) => ({
      id: `major-promotion-${i + 1}`,
      line: [move],
      explanation:
        i === 0
          ? "b8=Q+ promotes with check. The queen is usually the strongest choice; this position is not stalemate. You still need to coordinate queen and king to finish."
          : "b8=R+ also promotes with check and keeps sufficient mating material. A rook can mate with its king's help, though a queen is usually the simpler promotion here.",
    })),
  },
];

function endgameLesson(
  id: string,
  exercise: Exercise,
  title: string,
  description: string,
  text: string,
  exampleText: string,
): Course {
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
        title: "See the idea on the board",
        text: exampleText,
        fen: exercise.fen,
        line: exercise.answers[0].line,
        captions: [exercise.answers[0].explanation],
      },
      { id: `${id}-try`, kind: "exercise", exerciseId: exercise.id },
    ],
  };
}

export const endgameLessons: Course[] = [
  endgameLesson(
    "queen-endgame",
    endgameExercises[0],
    "King and queen: finish safely",
    "Restrict the bare king, bring your king closer, and check the finish.",
    "A queen can shrink the opposing king's space by controlling ranks and files. Bring your king close enough to cover escape squares. Before every move, distinguish checkmate from stalemate: a king with no legal move must be in check for it to be mate. This lesson practices a final mating position, not the whole conversion.",
    "The Black king is already in a corner. White's king covers a7 and b7; Qb7# completes the net. Three other queen moves also mate.",
  ),
  endgameLesson(
    "rook-endgame",
    endgameExercises[1],
    "King and rook: work together",
    "Use your king to cover escapes while the rook checks along the edge.",
    "A rook cuts the board along a rank or file. To mate a bare king, use your king to cover escape squares and the rook to check along the edge. Keep the rook out of capture range. This lesson starts at the final setup; it does not teach a complete forced sequence from any position.",
    "The king on b6 covers a7 and b7. The rook moves to h8, checks a8, and covers b8. Each piece has a distinct job.",
  ),
  endgameLesson(
    "king-activity",
    endgameExercises[2],
    "Let your king help",
    "Bring the king forward to support a pawn's next step.",
    "In an endgame, the king can defend pawns, attack targets, and support promotion. Before advancing it, check the opponent's attacks and your pawn's needs. A useful square often protects both the pawn and the square it wants to reach. King activity is a principle, not a guarantee that every forward move wins.",
    "White's pawn wants to reach d5. Ke4 keeps d4 defended and also protects d5, so the king can support that advance.",
  ),
  endgameLesson(
    "opposition",
    endgameExercises[3],
    "Understand opposition",
    "Recognize direct and distant opposition without assuming a forced win.",
    "Direct opposition means the kings face each other on a rank or file with one empty square between. The side whose opponent must move has the opposition. With three empty squares between on the same rank or file, the analogous arrangement is distant opposition. It can help a king gain ground, but pawn moves can change the move order and the result depends on the position.",
    "Kd2 lines up the kings on d2 and d6 with d3, d4, and d5 between. It is now Black's move. This illustrates distant opposition, without prescribing Black's reply.",
  ),
  endgameLesson(
    "pawn-promotion",
    endgameExercises[4],
    "Choose your promotion",
    "Select a piece, check for stalemate, and plan the next endgame.",
    "A pawn reaching the last rank must become a queen, rook, bishop, or knight. A queen is usually strongest, but always inspect the resulting position: stalemate or a particular threat can make a different piece useful. Against a bare king, king and queen or king and rook have enough material to mate; king and one bishop or knight do not.",
    "On b8, both queen and rook give check, so neither promotion is stalemate here. Both keep mating material. A queen is the usual choice, and the rook alternative is accepted for this exercise's goal.",
  ),
];

export const endgameSession: Course = {
  ...base,
  id: "endgame-practice",
  kind: "session",
  title: "Endgame essentials",
  description:
    "Five untimed positions: queen and rook finishes, king activity, opposition, and promotion.",
  skills: ["endgames", "check-mate"],
  steps: endgameExercises.map((exercise) => ({
    id: `endgame-practice-${exercise.id}-try`,
    kind: "exercise",
    exerciseId: exercise.id,
  })),
};
