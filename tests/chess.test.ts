import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { appendMove, replay, positionStatus } from "../src/chess/adapter";
describe("application chess adapter", () => {
  it("rejects illegal moves without changing the saved history", () => {
    const moves: string[] = [];
    expect(() => appendMove(moves, 0, { from: "e2", to: "e5" })).toThrow();
    expect(moves).toEqual([]);
  });
  it("replays full history and branches at the selected position", () => {
    const moves = ["e2e4", "e7e5", "g1f3"];
    const branch = appendMove(moves, 1, { from: "c7", to: "c5" });
    expect(branch).toEqual(["e2e4", "c7c5"]);
    expect(replay(branch).history()).toEqual(["e4", "c5"]);
  });
  it("moves the rook during castling and preserves rights", () => {
    const game = replay([
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1c4",
      "g8f6",
      "e1g1",
    ]);
    expect(game.get("f1")).toEqual({ color: "w", type: "r" });
    expect(game.get("g1")).toEqual({ color: "w", type: "k" });
    expect(game.fen().split(" ")[2]).toBe("kq");
  });
  it("captures en passant", () => {
    const game = replay(["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    expect(game.get("d5")).toBeUndefined();
    expect(game.get("d6")).toEqual({ color: "w", type: "p" });
  });
  it("supports all four promotion choices", () => {
    for (const type of ["q", "r", "b", "n"] as const) {
      const game = replay([`a7a8${type}`], 1, "7k/P7/8/8/8/8/8/7K w - - 0 1");
      expect(game.get("a8")?.type).toBe(type);
    }
  });
  it("preserves threefold repetition after restoring move history", () => {
    const game = replay([
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
    ]);
    expect(game.isThreefoldRepetition()).toBe(true);
    expect(positionStatus(game)).toBe("Draw by repetition");
  });
  it("reports checkmate and blocks further moves", () => {
    const moves = ["f2f3", "e7e5", "g2g4", "d8h4"];
    expect(positionStatus(replay(moves))).toBe("Black wins by checkmate");
    expect(() => appendMove(moves, 4, { from: "a2", to: "a3" })).toThrow();
  });
  it("distinguishes stalemate and insufficient material", () => {
    expect(positionStatus(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toBe(
      "Draw by stalemate",
    );
    expect(positionStatus(new Chess("7k/8/6K1/8/8/8/8/8 w - - 0 1"))).toBe(
      "Draw — insufficient material",
    );
  });
});
