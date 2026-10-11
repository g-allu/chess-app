# Tempo — personal chess workspace

Tempo is a local chess learning workspace with a legal practice board, five interactive starter lessons, and saved puzzle sessions. Learn covers threats, hanging pieces, checkmate, notation, and forks. Train offers six untimed positions and an optional short recognition drill. Openings, game imports, analysis, and backups remain planned.

For future development, follow [STAGES.md](STAGES.md) for stage order, scope, and completion gates, and [BUILD_PLAN.md](BUILD_PLAN.md) for the detailed product specification. Stage 2 implementation details and data contracts are in [STAGE_2.md](STAGE_2.md). The historical foundation verification record is in [WEEK_1.md](WEEK_1.md).

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

## Learn and Train

Open **Learn**, choose a lesson, read the idea, advance its guided example, and solve the position. **Train** offers untimed calculation first and optional 30-second recognition positions. Use hints or retry when needed; feedback explains the idea. Accepted mating alternatives count as correct. The knight fork includes an opponent reply and a follow-up move.

Refresh or return from the library to resume your saved step. Completion summaries distinguish first unassisted success from success after hints or another try. A timer expiry is recorded once, then you can continue untimed. These are practice records, not rating estimates.

The free practice board is on **Today** and under **Train → Free practice board**. Lessons and sessions keep separate positions and never overwrite it.

## Board controls

- Click a piece and a destination, or drag a piece with a mouse. Touch users can tap.
- Arrow keys move keyboard focus. Enter/Space selects a piece or destination; Escape clears selection and arrows.
- Promotion offers queen, rook, bishop, or knight.
- Use the toolbar to flip, toggle legal destinations, reset, or replay. Clicking a history move jumps to that position.
- Right-drag draws an arrow; right-click a square or press Escape to clear arrows. Arrows are temporary annotations.
- Moving from an earlier position creates a new branch and replaces the later continuation.

The practice board is for user-entered continuations, with no bot or in-app competitive play. Game-over positions require a reset or replay to an earlier position.

## Persistence

IndexedDB schema v2 preserves the full practice history, replay cursor, timestamp, and local profile, and adds learning runs, immutable attempts, and completion records. The additive v1 migration retains existing data. Full history preserves castling rights, en passant, move counters, and repetition. Commits are serialized; “Saved locally” appears only after a transaction completes. Small board preferences use localStorage. Practice storage failure leaves the current board usable and displays a retry notice. Learning saves commit the progress and its attempt/completion together before advancing; failed learning writes preserve the last committed step and offer retry. Malformed learning data is preserved and learning writes are blocked.

The profile button (or top-right information button on mobile) lets you edit your name and self-reported blitz rating/target and request persistent storage. Normal saving does not depend on the browser granting that request. Clearing browser data removes progress. Backups and offline reload are future milestones.

## Verify

```sh
npm test
npx playwright install chromium webkit
npm run test:e2e
```

Unit tests cover chess rules, lesson transitions, content validation, accepted alternatives, timed drills, immutable learning records, IndexedDB restoration, and v1 migration. Browser tests cover board input, refresh, profiles, navigation, themes, lessons, multi-position sessions, save recovery, timers, and mobile keyboard use in Chromium and WebKit. WebKit tests provide engine coverage; manual Safari and real touch-device checks remain part of release hardening.

## Repository hygiene

The repository includes app source, tests, configuration, the dependency lockfile, and project documentation. `.gitignore` excludes local AI assistant state/instructions, environment secrets, private keys, dependencies, build output, test artifacts, and editor/runtime files. Use sanitized `.env.example` files for any future documented environment settings.
