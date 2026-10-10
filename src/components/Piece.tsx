import type { PieceSymbol } from "chess.js";
// Original SVG silhouettes, drawn on a shared 45 × 45 grid.
export function Piece({
  type,
  color,
}: {
  type: PieceSymbol;
  color: "w" | "b";
}) {
  const shapes: Record<PieceSymbol, React.ReactNode> = {
    p: (
      <>
        <circle cx="22.5" cy="11" r="5.5" />
        <path d="M18 17 Q15 21 18 24 L15 33 H30 L27 24 Q30 21 27 17Z" />
        <path d="M13 34 H32 L34 39 H11Z" />
      </>
    ),
    r: (
      <>
        <path d="M12 6 V16 L16 19 V32 H29 V19 L33 16 V6 H27 V11 H25 V6 H20 V11 H18 V6Z" />
        <path d="M13 33 H32 L34 39 H11Z" />
        <path d="M16 19 H29" fill="none" />
      </>
    ),
    n: (
      <>
        <path d="M11 33 Q11 23 18 19 L12 22 L8 19 L15 9 L22 6 L26 3 L27 9 Q36 17 32 33Z" />
        <path d="M12 34 H33 L35 39 H10Z" />
        <path d="M22 13 L23 13 M16 9 L18 12 M17 29 Q25 24 26 18" fill="none" />
      </>
    ),
    b: (
      <>
        <path d="M22.5 6 Q9 16 19 23 L16 32 H29 L26 23 Q36 16 22.5 6Z" />
        <circle cx="22.5" cy="5" r="2" />
        <path d="M23 11 L19 18" fill="none" />
        <path d="M12 34 Q22.5 30 33 34 L35 39 H10Z" />
      </>
    ),
    q: (
      <>
        <path d="M10 12 L16 18 L19 9 L23 18 L27 9 L30 18 L36 12 L30 29 H16Z" />
        <circle cx="10" cy="9" r="2.5" />
        <circle cx="19" cy="6" r="2.5" />
        <circle cx="27" cy="6" r="2.5" />
        <circle cx="36" cy="9" r="2.5" />
        <path d="M16 30 H30 L32 34 H14Z M12 35 H34 L35 39 H10Z" />
      </>
    ),
    k: (
      <>
        <path d="M20 4 H25 V8 H29 V12 H25 V17 H20 V12 H16 V8 H20Z" />
        <path d="M22.5 20 Q13 12 10 21 Q9 27 16 30 H29 Q36 27 35 21 Q32 12 22.5 20Z" />
        <path d="M16 30 H29 L31 34 H14Z M12 35 H33 L35 39 H10Z" />
        <path d="M17 25 Q22 22 28 25" fill="none" />
      </>
    ),
  };
  return (
    <svg
      className={`piece piece-${color}`}
      viewBox="0 0 45 45"
      aria-hidden="true"
    >
      <g
        fill={color === "w" ? "#fff9ec" : "#283a33"}
        stroke={color === "w" ? "#4a554a" : "#13271e"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shapes[type]}
      </g>
    </svg>
  );
}
