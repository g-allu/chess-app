# Tempo — personal chess workspace

Tempo is a local chess learning workspace with a legal practice board, ten foundational/endgame lessons, three opening chapters, saved practice sessions, and spaced reviews. Learn covers threats, hanging pieces, checkmate, notation, forks, and five endgame essentials. Today builds a saved session of due reviews, a lesson, and targeted practice. Game imports, analysis, and backups remain planned.

Keep AI-generated planning documents, roadmaps, stage records, and implementation notes in the local `planning/` folder, which is excluded from Git. Place future documents of this kind there as well. Keep `README.md` at the repository root and tracked in Git.

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

The five endgame lessons cover queen/rook mating finishes, king activity, distant opposition, and promotion decisions. **Train → Spaced reviews** brings exercises back after a miss or successful solution. Delayed unassisted reviews follow 1, 3, 7, 14, and 30-day intervals; help or a miss returns after four hours. Defaults admit five new cards per local day and include up to ten due cards per session. Review settings can change future scheduling; saved due dates remain intact. Repeated failures prompt the relevant lesson. Due dates display in your browser's local time.

On **Today**, start or resume your daily session. The plan saves its exact review/lesson/practice choices and run IDs. Refresh and crossing midnight retain unfinished sessions; the final summary counts real completed tasks, unassisted solutions, and hints. An empty queue recommends a lesson and practice. Recall records do not certify plan understanding, mastery, or a playing rating.

Refresh or return from the library to resume your saved step. Completion summaries distinguish first unassisted success from success after hints or another try. A timer expiry is recorded once, then you can continue untimed. These are practice records, not rating estimates.

The free practice board is on **Today** and under **Train → Free practice board**. Lessons and sessions keep separate positions and never overwrite it.

## Opening study and repertoire

Open **Openings** for the Italian with White, Caro-Kann against 1.e4, and Queen's Gambit Declined against 1.d4. Each chapter includes essential plans, practical branches, advanced reference, both sides' ideas, explicit coverage limits, and compact advice for common deviations. **Complete guided chapter** walks through the main line, a sideline, move exercises, and an annotated model excerpt. These are original illustrative excerpts with reviewed commentary, rather than a complete historical-game library.

Use **Study branch** to replay annotated main lines and recursive sidelines. Different move orders share the same position and explanations while retaining their own full histories. Choose **Use this repertoire branch**, then **Train saved repertoire branch** to recall your side's moves from that saved path. **Guess the move & unfamiliar replies**, mixed branches, and structure recognition offer further practice. Wrong answers to the taught exercise goal retain the position for another try. Documented sound alternatives are accepted; documented sound choices outside the goal are recorded as repertoire deviations. Other legal moves in exact branch-recall tasks are explicitly unassessed, so their records do not declare them chess errors. Deviations do not add a failure or alter review scheduling.

Move exercises feed the existing spaced-review queue. Plan-question and position-recognition answers have separate saved evidence; none certify mastery or rating improvement. Replay cursor, selected repertoire, question submissions, and active chapter/practice runs survive refresh. Repeated failures offer the relevant chapter explanation. Model excerpts can be studied but cannot be selected as repertoire branches.

Authored PGN imports preserve nested variations, comments, and annotation glyphs. Graph/content validation checks legal histories, annotations, references, versions, and answer sets before loading opening progress. Concrete choices and model excerpts received separate AI editorial review and finite offline checks using [Stockfish 18](https://github.com/official-stockfish/Stockfish/releases/tag/sf_18), with 150,000 nodes per search, one thread, and 32 MiB hash. The structured audit in `src/openings/engine-review.json` retains engine provenance, content fingerprint, scores, and legal principal variations. This budget does not establish optimal play or complete repertoire coverage; independent human editorial review remains a release-hardening task.

To repeat the optional content audit, supply a separately downloaded official Stockfish 18 executable:

```sh
node scripts/check-opening-content.mjs /absolute/path/to/stockfish src/openings/engine-review.json
```

The app does not bundle or execute Stockfish; browser game analysis remains a later milestone.

## Board controls

- Click a piece and a destination, or drag a piece with a mouse. Touch users can tap.
- Arrow keys move keyboard focus. Enter/Space selects a piece or destination; Escape clears selection and arrows.
- Promotion offers queen, rook, bishop, or knight.
- Use the toolbar to flip, toggle legal destinations, reset, or replay. Clicking a history move jumps to that position.
- Right-drag draws an arrow; right-click a square or press Escape to clear arrows. Arrows are temporary annotations.
- Moving from an earlier position creates a new branch and replaces the later continuation.

The practice board is for user-entered continuations, with no bot or in-app competitive play. Game-over positions require a reset or replay to an earlier position.

## Persistence

IndexedDB schema v4 preserves the full practice history, replay cursor, timestamp, local profile, learning runs, immutable attempts, and completion records, with review cards/settings and daily sessions, and adds opening study/repertoire/question records. Additive v1/v2/v3 migrations retain existing data; existing attempts seed reviews without rewriting their records. Full history preserves castling rights, en passant, move counters, and repetition. Commits are serialized; “Saved locally” appears only after a transaction completes. Small board preferences use localStorage. Practice storage failure leaves the current board usable and displays a retry notice. Learning saves commit progress, its attempt/completion, and review effects together before advancing; failed writes preserve the last committed step and offer retry. Malformed learning/review/daily/opening data is preserved and affected writes are blocked. Opening saves use revision-checked transactions; failed writes leave the last committed cursor, repertoire, and answers visible until retry.

The profile button (or top-right information button on mobile) lets you edit your name and self-reported blitz rating/target and request persistent storage. Normal saving does not depend on the browser granting that request. Clearing browser data removes progress. Backups and offline reload are future milestones.

## Verify

```sh
npm test
npx playwright install chromium webkit
npm run test:e2e
```

Unit tests cover opening graphs/transpositions, recursive PGN variations, engine-audit provenance, repertoire deviations, opening persistence, chess rules, lesson transitions, content validation, accepted alternatives, timed drills, immutable records, deterministic scheduling, queue limits, daily plans, IndexedDB restoration, and v1/v2/v3 migrations. Browser tests cover three complete opening chapters, selected-branch training, shared transposition annotations, plan/recognition evidence, repertoire refresh/recovery, and board input, refresh, profiles, themes, lessons, sessions, daily review/lesson/practice completion, endgame recall, save recovery, settings, midnight resumption, timers, and mobile keyboard use in Chromium and WebKit. WebKit tests provide engine coverage; manual Safari and real touch-device checks remain part of release hardening.

## Repository hygiene

The repository includes app source, tests, configuration, the dependency lockfile, and project documentation. `.gitignore` excludes local AI assistant state/instructions, environment secrets, private keys, dependencies, build output, test artifacts, and editor/runtime files. Use sanitized `.env.example` files for any future documented environment settings.
