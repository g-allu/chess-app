import { Chess } from "chess.js";
import { INITIAL_FEN, replay } from "../chess/adapter";
import type { OpeningGraph, OpeningPath } from "./contracts";

/** Opening identity excludes clocks, but preserves castling and legal en passant. */
export function openingIdentity(fen: string): string {
  const game = new Chess(fen);
  // chess.js emits the EP target only if an en-passant capture is legal.
  return game.fen().split(" ").slice(0, 4).join(" ");
}
export const openingPositionKey = openingIdentity;

/** Graph lookup never substitutes for replay: histories retain draw/repetition state. */
export function openingPosition(moves: string[], cursor = moves.length) {
  return replay(moves, cursor, INITIAL_FEN);
}

export function buildOpeningGraph(paths: OpeningPath[]): OpeningGraph {
  const nodes = new Map<string, OpeningGraph["nodes"][number]>();
  const edges = new Map<string, OpeningGraph["edges"][number]>();
  const remember = (game: Chess) => {
    const id = openingIdentity(game.fen());
    if (!nodes.has(id)) nodes.set(id, { id, fen: game.fen(), annotations: [] });
    return id;
  };
  for (const path of paths) {
    const game = new Chess();
    let from = remember(game);
    path.moves.forEach((uci, i) => {
      if (game.isGameOver())
        throw new Error("Opening path continues after game end");
      const move = game.move(uci);
      const to = remember(game);
      const id = `${from}|${move.lan}`;
      const annotation = path.captions[i];
      const existing = edges.get(id);
      if (existing) {
        if (!existing.pathIds.includes(path.id)) existing.pathIds.push(path.id);
        if (annotation && !existing.annotations.includes(annotation))
          existing.annotations.push(annotation);
        existing.repertoire ||= path.kind === "main";
      } else
        edges.set(id, {
          id,
          from,
          to,
          move: move.lan,
          san: move.san,
          annotations: annotation ? [annotation] : [],
          pathIds: [path.id],
          repertoire: path.kind === "main",
        });
      if (annotation && !nodes.get(to)!.annotations.includes(annotation))
        nodes.get(to)!.annotations.push(annotation);
      from = to;
    });
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
