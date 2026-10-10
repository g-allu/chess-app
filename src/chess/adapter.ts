import { Chess } from "chess.js";
import type { PieceSymbol, Square } from "chess.js";
export type MoveInput = { from: Square; to: Square; promotion?: PieceSymbol };
export const INITIAL_FEN = new Chess().fen();
// Rebuild from full history, not FEN alone: repetition and draw state survive reload.
export function replay(
  moves: string[],
  cursor = moves.length,
  initialFen = INITIAL_FEN,
): Chess {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > moves.length)
    throw new Error("Invalid replay position");
  const game = new Chess(initialFen);
  for (const move of moves.slice(0, cursor)) game.move(move);
  return game;
}
export function appendMove(
  moves: string[],
  cursor: number,
  input: MoveInput,
): string[] {
  const game = replay(moves, cursor);
  if (game.isGameOver())
    throw new Error("This position has ended. Start a new board to continue.");
  const move = game.move(input);
  return [...moves.slice(0, cursor), move.lan];
}
export function positionStatus(game: Chess): string {
  if (game.isCheckmate())
    return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  if (game.isStalemate()) return "Draw by stalemate";
  if (game.isThreefoldRepetition()) return "Draw by repetition";
  if (game.isInsufficientMaterial()) return "Draw — insufficient material";
  if (game.isDraw()) return "Draw by the fifty-move rule";
  return `${game.turn() === "w" ? "White" : "Black"} to move${game.isCheck() ? " · in check" : ""}`;
}
export const pieceNames: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
