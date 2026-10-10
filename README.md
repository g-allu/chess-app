# Tempo — personal chess workspace

Week 1 implementation of the roadmap in `BUILD_PLAN.md`: React/TypeScript, five-area navigation, a reusable legal chessboard, and browser persistence. Later areas show their planned scope; lessons, puzzles, imports, engine analysis, and backups are not implemented yet.

## Run locally

Requires Node.js 22.12+ (developed using Node 24).

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Keep this address, port, and browser profile consistent: browser storage is tied to the origin. `127.0.0.1:5173` has separate storage from `localhost:5173`. Vite fails if port 5173 is occupied rather than silently moving your data to another origin.

```sh
npm run build
npm run preview
```

Preview also uses port 5173; stop the dev server before starting it. No backend, account, cloud service, or paid API is required. All assets are local, including original SVG piece artwork.

## Appearance

Use the moon/sun button in the top bar to switch between light and dark mode. The initial theme follows your system preference; an explicit choice is saved locally and applied before the next page paint. Both desktop and mobile layouts support the toggle.

## Board controls

- Click a piece and a destination, or drag a piece with a mouse. Touch users can tap.
- Arrow keys move keyboard focus. Enter/Space selects a piece or destination; Escape clears selection and arrows.
- Promotion offers queen, rook, bishop, or knight.
- Use the toolbar to flip, toggle legal destinations, reset, or replay. Clicking a history move jumps to that position.
- Right-drag draws an arrow; right-click a square or press Escape to clear arrows. Arrows are temporary annotations.
- Moving from an earlier position creates a new branch and replaces the later continuation.

The practice board is for user-entered continuations, with no bot or in-app competitive play. Game-over positions require a reset or replay to an earlier position.

## Persistence

IndexedDB schema v1 stores the full move history, replay cursor, timestamp, and local profile. Full history preserves castling rights, en passant, move counters, and repetition. Commits are serialized; “Saved locally” appears only after a transaction completes. Small board preferences use localStorage. Storage failure leaves the current board usable and displays a retry notice.

The profile button (or top-right information button on mobile) lets you edit your name and self-reported blitz rating/target and request persistent storage. Normal saving does not depend on the browser granting that request. Clearing browser data removes progress. Backups and offline reload are future milestones.

## Verify

```sh
npm test
npx playwright install chromium webkit
npm run test:e2e
```

Unit tests cover legality, branching, castling, en passant, promotion, checkmate, draws, and IndexedDB restoration. Browser tests cover actual board input, refresh, profile persistence, navigation, mobile layout, and promotion in Chromium and WebKit. WebKit tests provide engine coverage; manual Safari and real touch-device checks remain part of release hardening.

## Repository hygiene

The repository includes app source, tests, configuration, the dependency lockfile, and project documentation. `.gitignore` excludes local AI assistant state/instructions, environment secrets, private keys, dependencies, build output, test artifacts, and editor/runtime files. Use sanitized `.env.example` files for any future documented environment settings.
