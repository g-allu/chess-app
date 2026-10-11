import { Chess } from "chess.js";
import { INITIAL_FEN } from "../chess/adapter";

export interface PgnMove {
  san: string;
  uci: string;
  comments: string[];
  nags: string[];
  /** Each variation replaces this move, recursively. */
  variations: PgnLine[];
}
export interface PgnLine {
  comments: string[];
  moves: PgnMove[];
  result?: string;
}
export interface OpeningPgn {
  headers: Record<string, string>;
  initialFen: string;
  line: PgnLine;
}

/** Course PGN reader: retains nested RAVs, comments, NAGs and authored headers. */
export function parseOpeningPgn(pgn: string): OpeningPgn {
  if (typeof pgn !== "string" || !pgn.trim())
    throw new Error("Missing opening PGN");
  const headers: Record<string, string> = {};
  let body = pgn.trimStart();
  // Headers belong before movetext. Bracket text inside comments stays intact.
  while (body.startsWith("[")) {
    const header = body.match(/^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]/);
    if (!header || Object.hasOwn(headers, header[1]))
      throw new Error("Invalid or duplicate PGN header");
    headers[header[1]] = header[2].replace(/\\(["\\])/g, "$1");
    body = body.slice(header[0].length).trimStart();
  }
  const tokens: string[] = [];
  for (let i = 0; i < body.length;) {
    if (/\s/.test(body[i])) {
      i++;
      continue;
    }
    if (body[i] === "{") {
      const start = ++i;
      let depth = 1;
      while (i < body.length && depth) {
        if (body[i] === "{") depth++;
        if (body[i] === "}") depth--;
        i++;
      }
      if (depth) throw new Error("Unclosed PGN comment");
      tokens.push(`{${body.slice(start, i - 1)}}`);
    } else if (body[i] === ";") {
      const start = ++i;
      while (i < body.length && body[i] !== "\n") i++;
      tokens.push(`{${body.slice(start, i)}}`);
    } else if (body[i] === "(" || body[i] === ")") tokens.push(body[i++]);
    else if (body[i] === "$") {
      const start = i++;
      while (i < body.length && /\d/.test(body[i])) i++;
      if (i === start + 1) throw new Error("Invalid PGN NAG");
      tokens.push(body.slice(start, i));
    } else {
      const start = i;
      while (i < body.length && !/[\s{}();$]/.test(body[i])) i++;
      if (start === i) throw new Error("Unexpected PGN token");
      tokens.push(body.slice(start, i));
    }
  }
  const initialFen = headers.FEN ?? INITIAL_FEN;
  new Chess(initialFen);
  let cursor = 0;
  function readLine(fen: string, nested: boolean): PgnLine {
    const game = new Chess(fen);
    const line: PgnLine = { comments: [], moves: [] };
    let beforeLast = fen;
    while (cursor < tokens.length) {
      let token = tokens[cursor++];
      const last = line.moves.at(-1);
      if (token === ")") {
        if (!nested) throw new Error("Unexpected PGN variation close");
        return line;
      }
      if (token === "(") {
        if (line.result) throw new Error("PGN variation after result");
        if (!last) throw new Error("PGN variation needs a preceding move");
        const variation = readLine(beforeLast, true);
        if (!variation.moves.length) throw new Error("Empty PGN variation");
        last.variations.push(variation);
        continue;
      }
      if (token.startsWith("{")) {
        (last ? last.comments : line.comments).push(token.slice(1, -1).trim());
        continue;
      }
      if (/^\$\d+$/.test(token)) {
        if (!last) throw new Error("PGN annotation needs a move");
        last.nags.push(token);
        continue;
      }
      token = token.replace(/^\d+\.(?:\.\.)?/, "");
      if (!token || token === "...") continue;
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
        if (line.result) throw new Error("Repeated PGN result");
        line.result = token;
        continue;
      }
      if (line.result) throw new Error("PGN move after result");
      if (game.isGameOver()) throw new Error("PGN continues after game end");
      const suffix = token.match(/[!?]+$/)?.[0];
      beforeLast = game.fen();
      const move = game.move(token.replace(/[!?]+$/, ""), { strict: true });
      line.moves.push({
        san: move.san,
        uci: move.lan,
        comments: [],
        nags: suffix ? [suffix] : [],
        variations: [],
      });
    }
    if (nested) throw new Error("Unclosed PGN variation");
    return line;
  }
  const line = readLine(initialFen, false);
  if (!line.moves.length) throw new Error("PGN has no moves");
  if (headers.Result && line.result && headers.Result !== line.result)
    throw new Error("PGN header and movetext results disagree");
  return { headers, initialFen, line };
}

export function pgnPaths(
  parsed: OpeningPgn,
): { moves: string[]; captions: string[] }[] {
  const paths: { moves: string[]; captions: string[] }[] = [];
  function walk(line: PgnLine, prefix: string[], captions: string[]) {
    const moves = [...prefix];
    const notes = [...captions];
    for (const [index, move] of line.moves.entries()) {
      for (const variation of move.variations) walk(variation, moves, notes);
      moves.push(move.uci);
      notes.push(
        [
          ...(index === 0 ? line.comments : []),
          ...move.nags,
          ...(move.comments.length ? move.comments : [`Play ${move.san}.`]),
        ].join(" "),
      );
    }
    if (line.moves.length) paths.push({ moves, captions: notes });
  }
  walk(parsed.line, [], []);
  return paths;
}
