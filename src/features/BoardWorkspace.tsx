import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Check,
  Flag,
  MousePointer2,
} from "lucide-react";
import type { PieceSymbol, Square } from "chess.js";
import { appendMove, positionStatus, replay } from "../chess/adapter";
import { Chessboard } from "../components/Chessboard";
import { useWorkspace } from "../app/WorkspaceContext";
function preference(key: string, fallback: boolean) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}
export function BoardWorkspace() {
  const { workspace, updateWorkspace, status } = useWorkspace();
  const [flipped, setFlipped] = useState(() =>
    preference("tempo:flipped", false),
  );
  const [showLegal, setShowLegal] = useState(() =>
    preference("tempo:legal", true),
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const game = useMemo(
    () => replay(workspace.moves, workspace.cursor),
    [workspace.moves, workspace.cursor],
  );
  const history = useMemo(
    () => replay(workspace.moves).history(),
    [workspace.moves],
  );
  function navigate(cursor: number) {
    setError("");
    updateWorkspace({
      ...workspace,
      cursor,
      updatedAt: new Date().toISOString(),
    });
  }
  function makeMove(from: Square, to: Square, promotion?: PieceSymbol) {
    try {
      const moves = appendMove(workspace.moves, workspace.cursor, {
        from,
        to,
        promotion,
      });
      updateWorkspace({
        ...workspace,
        moves,
        cursor: moves.length,
        updatedAt: new Date().toISOString(),
      });
      setError("");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Move could not be played.",
      );
    }
  }
  function toggle(
    key: string,
    next: boolean,
    setter: (value: boolean) => void,
  ) {
    setter(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      /* Preferences can remain in memory if storage is unavailable. */
    }
  }
  return (
    <div className="workspace-grid">
      <section className="board-panel" aria-label="Practice board">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FREE EXPLORATION</span>
            <h2>Your practice board</h2>
          </div>
          <span className="pill">
            <span
              className={`turn-dot ${game.turn() === "b" ? "black" : ""}`}
            />
            {positionStatus(game)}
          </span>
        </div>
        <Chessboard
          game={game}
          flipped={flipped}
          showLegal={showLegal}
          disabled={status === "loading"}
          onMove={makeMove}
        />
        <div className="board-toolbar">
          <div className="tool-group">
            <button
              className="icon-button"
              title="Flip board"
              aria-label="Flip board"
              onClick={() => toggle("tempo:flipped", !flipped, setFlipped)}
            >
              <ArrowLeftRight size={18} />
            </button>
            <button
              className={`icon-button ${showLegal ? "active" : ""}`}
              title="Show legal moves"
              aria-label="Show legal moves"
              aria-pressed={showLegal}
              onClick={() => toggle("tempo:legal", !showLegal, setShowLegal)}
            >
              <Lightbulb size={18} />
            </button>
            <span className="toolbar-divider" />
            <button
              className="icon-button"
              aria-label="Reset board"
              title="Reset board"
              onClick={() => setConfirmReset(true)}
              disabled={!workspace.moves.length}
            >
              <RotateCcw size={18} />
            </button>
          </div>
          <div className="tool-group replay-controls">
            <button
              className="icon-button"
              aria-label="First position"
              disabled={!workspace.cursor}
              onClick={() => navigate(0)}
            >
              <ChevronFirst size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Previous move"
              disabled={!workspace.cursor}
              onClick={() => navigate(workspace.cursor - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="move-count">
              {workspace.cursor} / {workspace.moves.length}
            </span>
            <button
              className="icon-button"
              aria-label="Next move"
              disabled={workspace.cursor === workspace.moves.length}
              onClick={() => navigate(workspace.cursor + 1)}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Latest position"
              disabled={workspace.cursor === workspace.moves.length}
              onClick={() => navigate(workspace.moves.length)}
            >
              <ChevronLast size={18} />
            </button>
          </div>
        </div>
        <div className="board-caption">
          <MousePointer2 size={14} />
          <span>Click or drag to move. Right-drag to draw an arrow.</span>
        </div>
        {workspace.cursor < workspace.moves.length && (
          <p className="inline-notice">
            Replaying move {workspace.cursor}. Playing here replaces the moves
            after this position.
          </p>
        )}
        {error && (
          <p className="inline-notice" role="alert">
            {error}
          </p>
        )}
        {confirmReset && (
          <div className="reset-confirm" role="alert">
            <span>Start fresh? This clears the current move history.</span>
            <button
              className="text-button"
              onClick={() => setConfirmReset(false)}
            >
              Keep board
            </button>
            <button
              className="primary small"
              onClick={() => {
                updateWorkspace({
                  ...workspace,
                  moves: [],
                  cursor: 0,
                  updatedAt: new Date().toISOString(),
                });
                setConfirmReset(false);
              }}
            >
              Reset
            </button>
          </div>
        )}
      </section>
      <aside className="practice-aside">
        <section className="guide-card">
          <div className="card-icon">
            <Flag size={21} />
          </div>
          <span className="eyebrow">A GOOD PLACE TO START</span>
          <h2>
            Small moves.
            <br /> Stronger foundations.
          </h2>
          <p>
            Get comfortable with the board. Explore a position, try an idea, and
            take it back whenever you like.
          </p>
          <div className="guide-rule" />
          <h3>Before you move</h3>
          <ol className="decision-list">
            <li>
              <span>01</span>What is my opponent threatening?
            </li>
            <li>
              <span>02</span>Do I have a check or a capture?
            </li>
            <li>
              <span>03</span>Will my piece be safe?
            </li>
          </ol>
          <div className="guide-foot">
            <Check size={15} />{" "}
            {status === "saved"
              ? "Your position is saved on this device"
              : status === "error"
                ? "Local saving is unavailable"
                : status === "loading"
                  ? "Opening your saved position…"
                  : "Saving your position…"}
          </div>
        </section>
        <section className="moves-card">
          <div className="moves-heading">
            <h3>Move history</h3>
            <span>{history.length} plies</span>
          </div>
          {!history.length ? (
            <div className="empty-moves">
              <span>♘</span>
              <p>Your first move starts here.</p>
              <small>Try moving the e2 pawn to e4.</small>
            </div>
          ) : (
            <div className="move-list" aria-label="Move history">
              {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                <div className="move-row" key={i}>
                  <span>{i + 1}.</span>
                  {history.slice(i * 2, i * 2 + 2).map((san, j) => (
                    <button
                      key={j}
                      aria-label={`Go to move ${i + 1} ${j === 0 ? "White" : "Black"} ${san}`}
                      className={
                        workspace.cursor === i * 2 + j + 1 ? "current" : ""
                      }
                      onClick={() => navigate(i * 2 + j + 1)}
                    >
                      {san}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
