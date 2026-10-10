import { useEffect, useRef, useState } from "react";
import type { Chess, PieceSymbol, Square } from "chess.js";
import { pieceNames } from "../chess/adapter";
import { Piece } from "./Piece";
interface Props {
  game: Chess;
  flipped: boolean;
  showLegal: boolean;
  disabled?: boolean;
  onMove: (from: Square, to: Square, promotion?: PieceSymbol) => void;
}
export function Chessboard({
  game,
  flipped,
  showLegal,
  disabled,
  onMove,
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [focus, setFocus] = useState<Square>("e2");
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [arrows, setArrows] = useState<[Square, Square][]>([]);
  const [notice, setNotice] = useState("");
  const arrowStart = useRef<Square | null>(null);
  const buttons = useRef(new Map<Square, HTMLButtonElement>());
  const fen = game.fen();
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    setArrows([]);
    setNotice("");
  }, [fen]);
  const files = [..."abcdefgh"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  if (flipped) {
    files.reverse();
    ranks.reverse();
  }
  const squares = ranks.flatMap((rank) =>
    files.map((file) => `${file}${rank}` as Square),
  );
  const legal = selected ? game.moves({ square: selected, verbose: true }) : [];
  const last = game.history({ verbose: true }).at(-1);
  function select(square: Square) {
    if (disabled || game.isGameOver()) return;
    const piece = game.get(square);
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (selected && legal.some((move) => move.to === square)) {
      move(selected, square);
      return;
    }
    if (piece?.color === game.turn()) {
      setSelected(square);
      setNotice("");
    } else {
      setSelected(null);
      setNotice(
        "Select a piece of the side to move, then a legal destination.",
      );
    }
  }
  function move(from: Square, to: Square) {
    if (disabled) return;
    const candidates = game
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);
    if (!candidates.length) {
      setNotice("That move is not legal. Try another square.");
      return;
    }
    if (candidates.some((move) => move.promotion)) setPromotion({ from, to });
    else {
      onMove(from, to);
      setSelected(null);
    }
  }
  function center(square: Square) {
    const index = squares.indexOf(square);
    return { x: (index % 8) * 100 + 50, y: Math.floor(index / 8) * 100 + 50 };
  }
  return (
    <div className="board-container">
      <div
        className="chessboard"
        role="group"
        aria-label="Interactive chessboard. Use arrow keys to navigate; Enter or Space selects a square."
      >
        {squares.map((square, index) => {
          const piece = game.get(square);
          const target = legal.find((move) => move.to === square);
          const dark = (square.charCodeAt(0) + Number(square[1])) % 2 === 0;
          const checked =
            piece?.type === "k" &&
            piece.color === game.turn() &&
            game.isCheck();
          return (
            <button
              key={square}
              ref={(element) => {
                if (element) buttons.current.set(square, element);
              }}
              type="button"
              data-square={square}
              className={`square ${dark ? "dark" : "light"} ${selected === square ? "selected" : ""} ${last?.from === square || last?.to === square ? "last-move" : ""} ${checked ? "checked" : ""}`}
              tabIndex={focus === square ? 0 : -1}
              aria-label={`${square}, ${piece ? `${piece.color === "w" ? "White" : "Black"} ${pieceNames[piece.type]}` : "empty"}${target ? ", legal destination" : ""}`}
              aria-pressed={selected === square}
              onFocus={() => setFocus(square)}
              onClick={() => select(square)}
              draggable={
                !disabled && !game.isGameOver() && piece?.color === game.turn()
              }
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", square);
                setSelected(square);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData("text/plain") as Square;
                if (squares.includes(from)) move(from, square);
              }}
              onContextMenu={(event) => event.preventDefault()}
              onMouseDown={(event) => {
                if (event.button === 2) {
                  arrowStart.current = square;
                  event.preventDefault();
                }
              }}
              onMouseUp={(event) => {
                if (event.button === 2 && arrowStart.current) {
                  const from = arrowStart.current;
                  if (from !== square)
                    setArrows((current) => [...current, [from, square]]);
                  else setArrows([]);
                  arrowStart.current = null;
                }
              }}
              onKeyDown={(event) => {
                const directions: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -8,
                  ArrowDown: 8,
                };
                if (event.key in directions) {
                  event.preventDefault();
                  const next = index + directions[event.key];
                  if (
                    next >= 0 &&
                    next < 64 &&
                    (!(
                      event.key === "ArrowLeft" || event.key === "ArrowRight"
                    ) ||
                      Math.floor(next / 8) === Math.floor(index / 8))
                  )
                    buttons.current.get(squares[next])?.focus();
                }
                if (event.key === "Escape") {
                  setSelected(null);
                  setArrows([]);
                }
              }}
            >
              {index % 8 === 0 && (
                <span className="rank-label">{square[1]}</span>
              )}
              {index >= 56 && <span className="file-label">{square[0]}</span>}
              {piece && <Piece type={piece.type} color={piece.color} />}
              {showLegal && target && (
                <span className={piece ? "capture-ring" : "legal-dot"} />
              )}
            </button>
          );
        })}
        <svg className="board-arrows" viewBox="0 0 800 800" aria-hidden="true">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="3"
              markerHeight="3"
              refX="2"
              refY="1.5"
              orient="auto"
            >
              <path d="M0 0 L3 1.5 L0 3Z" fill="#d49139" />
            </marker>
          </defs>
          {arrows.map(([from, to], index) => {
            const a = center(from),
              b = center(to);
            return (
              <line
                key={index}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#d49139"
                strokeWidth="14"
                opacity=".85"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </svg>
        {promotion && (
          <div className="promotion-overlay">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choose promotion piece"
              className="promotion-dialog"
              onKeyDown={(event) => {
                if (event.key === "Escape") setPromotion(null);
                if (event.key === "Tab") {
                  const elements = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button",
                    ),
                  ];
                  const first = elements[0],
                    last = elements.at(-1);
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                  } else if (
                    !event.shiftKey &&
                    document.activeElement === last
                  ) {
                    event.preventDefault();
                    first.focus();
                  }
                }
              }}
            >
              <strong>Promote your pawn</strong>
              <div>
                {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
                  <button
                    autoFocus={type === "q"}
                    key={type}
                    aria-label={`Promote to ${pieceNames[type]}`}
                    onClick={() => {
                      onMove(promotion.from, promotion.to, type);
                      setPromotion(null);
                      setSelected(null);
                    }}
                  >
                    <Piece type={type} color={game.turn()} />
                  </button>
                ))}
              </div>
              <button onClick={() => setPromotion(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </div>
  );
}
