// Offline editorial aid. The engine is supplied by the reviewer and is not bundled with Tempo.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { Chess } from "chess.js";
import { format } from "prettier";

const binary = process.argv[2];
const output = process.argv[3] ?? "planning/opening-engine-review.json";
if (!binary)
  throw new Error(
    "Usage: node scripts/check-opening-content.mjs /absolute/path/to/stockfish [output.json]",
  );
const server = await createServer({
  server: { watch: null },
  logLevel: "error",
});
const { openingChapters } = await server.ssrLoadModule(
  "/src/openings/content.ts",
);
await server.close();
const engine = spawn(binary, [], { stdio: ["pipe", "pipe", "inherit"] });
const lines = createInterface({ input: engine.stdout });
let receiver;
let latest;
let engineName;
lines.on("line", (line) => receiver?.(line));
engine.on("error", (error) => {
  throw error;
});
function command(text, until) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      receiver = undefined;
      engine.kill();
      reject(new Error(`Engine timeout: ${text}`));
    }, 30000);
    receiver = (line) => {
      if (line.startsWith("id name ")) engineName = line.slice(8);
      if (line.startsWith("info depth") && line.includes(" score "))
        latest = line;
      if (line.startsWith(until)) {
        clearTimeout(timer);
        receiver = undefined;
        resolve(line);
      }
    };
    engine.stdin.write(`${text}\n`);
  });
}
const init = [];
receiver = (line) => init.push(line);
await command("uci", "uciok");
if (engineName !== "Stockfish 18")
  throw new Error(`Expected Stockfish 18; got ${engineName}`);
engine.stdin.write(
  "setoption name Threads value 1\nsetoption name Hash value 32\n",
);
await command("isready", "readyok");
async function evaluate(history, move) {
  engine.stdin.write("ucinewgame\n");
  await command("isready", "readyok");
  engine.stdin.write(`position startpos moves ${history.join(" ")}\n`);
  latest = null;
  const best = await command(
    `go nodes 150000${move ? ` searchmoves ${move}` : ""}`,
    "bestmove",
  );
  if (!latest) throw new Error("Engine supplied no score");
  const score = latest.match(/score (cp|mate) (-?\d+)/);
  return {
    type: score[1],
    score: Number(score[2]),
    depth: Number(latest.match(/depth (\d+)/)[1]),
    nodes: Number(latest.match(/nodes (\d+)/)[1]),
    pv: latest.split(" pv ")[1]?.split(" ") ?? [],
    bestmove: best.split(" ")[1],
  };
}
const cases = new Map();
const add = (history, move, reference, kind) => {
  const key = `${history.join(" ")}|${move}`;
  if (cases.has(key)) {
    cases.get(key).references.push(reference);
    return;
  }
  cases.set(key, {
    history: [...history],
    move,
    references: [reference],
    kind,
  });
};
for (const chapter of openingChapters) {
  for (const path of chapter.paths)
    path.moves.forEach((move, index) =>
      add(
        path.moves.slice(0, index),
        move,
        `${chapter.id}/${path.id}/${index}`,
        path.kind,
      ),
    );
  for (const exercise of chapter.exercises) {
    for (const answer of exercise.answers)
      add(
        exercise.history,
        answer.line[0],
        `${exercise.id}/${answer.id}`,
        "accepted-answer",
      );
    for (const move of Object.keys(exercise.deviations))
      add(
        exercise.history,
        move,
        `${exercise.id}/deviation/${move}`,
        "documented-deviation",
      );
  }
}
const records = [];
const exercise = (id) =>
  openingChapters
    .flatMap((chapter) => chapter.exercises)
    .find((item) => item.id === id);
add(
  exercise("italian-guess").history,
  "f3g5",
  "italian-guess/Ng5-Qxg5",
  "verified-error",
);
add(
  exercise("caro-kann-guess").history,
  "c8g4",
  "caro-kann-guess/Bg4-Qxg4",
  "verified-error",
);
add(
  exercise("qgd-guess").history,
  "f6e4",
  "qgd-guess/Ne4-Bxd8",
  "verified-error",
);
add(
  exercise("italian-guess").history,
  "f3e5",
  "italian-guess/Nxe5-d4-fork",
  "editorial-reference",
);
const cache = new Map();
try {
  for (const item of cases.values()) {
    const key = item.history.join(" ");
    let baseline = cache.get(key);
    if (!baseline) {
      baseline = await evaluate(item.history);
      cache.set(key, baseline);
    }
    const candidate = await evaluate(item.history, item.move);
    const game = new Chess();
    for (const move of item.history) game.move(move);
    records.push({
      ...item,
      fen: game.fen(),
      san: game.move(item.move).san,
      baseline,
      candidate,
      lossCp:
        baseline.type === "cp" && candidate.type === "cp"
          ? baseline.score - candidate.score
          : null,
    });
    if (records.length % 20 === 0)
      console.log(`Checked ${records.length}/${cases.size} authored choices`);
  }
  const report = {
    schemaVersion: 1,
    engine: "Stockfish 18",
    release:
      "https://github.com/official-stockfish/Stockfish/releases/tag/sf_18",
    binaryArchiveSha256:
      "4d77c4aa3ad9bd1ea8111f2ac5a4620fe7ebf998d6893bf828d49ccd579c8cb0",
    checkedAt: new Date().toISOString(),
    settings: { threads: 1, hashMb: 32, nodesPerSearch: 150000 },
    scorePerspective:
      "side to move at the original position; centipawn scores are Stockfish normalized estimates",
    contentSha256: createHash("sha256")
      .update(JSON.stringify(openingChapters))
      .digest("hex"),
    limits:
      "Finite node-budget checks of authored choices and annotated excerpts. These do not prove optimal play, plans, or a complete repertoire. Separate editorial review is required.",
    records,
  };
  await writeFile(
    output,
    await format(JSON.stringify(report), { parser: "json" }),
  );
  const flagged = records.filter(
    (item) => item.lossCp > 100 || item.candidate.type === "mate",
  );
  console.log(
    JSON.stringify(
      {
        checked: records.length,
        output,
        flagged: flagged.map((item) => ({
          references: item.references,
          move: item.san,
          lossCp: item.lossCp,
          baseline: item.baseline,
          candidate: item.candidate,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  receiver = undefined;
  engine.stdin.end("quit\n");
}
