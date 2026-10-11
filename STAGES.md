# Tempo implementation stages

This is the authoritative implementation roadmap. Build by completion gates, not dates or estimated duration. It replaces the delivery schedule and milestone ordering in `BUILD_PLAN.md`; that file remains the detailed product and technical specification. `WEEK_1.md` is the historical foundation acceptance record.

The objective is a personal chess trainer that completes this loop:

**Import completed games → identify verified mistakes → learn the idea → practice → review later → measure application in later games.**

## Current status and stage order

Stages 1 and 2 are complete. Learn contains five interactive starter lessons; Train offers a six-position untimed session and an optional timed recognition drill. Learning progress, attempts, and completions persist independently of the free practice board on Today and Train → Free practice board. Openings and Review remain planned. The Stage 2 completion record below reflects fresh automated verification.

| Stage | Deliverable | Depends on | Status |
| --- | --- | --- | --- |
| 1 | Application, navigation, legal board, local persistence | — | Complete |
| 2 | Interactive lessons and puzzle practice | 1 | Complete |
| 3 | Spaced repetition, essential endgames, daily plan | 2 | Next |
| 4 | Detailed opening courses and repertoire training | 2, 3 | Planned |
| 5 | Completed-game imports and game viewer | 1; integrate with 2–4 | Planned |
| 6 | Browser engine analysis and mistake notebook | 3, 5 | Planned |
| 7 | Versioned backups and restoration | 2–6 data contracts | Planned |
| 8 | Integrated personal beta | 1–7 | Planned |
| 9 | Evidence-based coaching and personalization | 8 | Planned |
| 10 | Content expansion, correction, and learning progress | 4, 8, 9 | Planned |
| 11 | Release hardening and stable personal release | 7–10 | Planned |
| 12 | Optional installation and offline reload | 11 | Deferred |
| 13 | Optional public product and broader learning tracks | 11 | Deferred |

Work in this order by default. Dependencies are prerequisites for completion, not reasons to build an entire later feature early. Data protection, accessibility, content validation, and recovery apply throughout; their dedicated stages finish and verify those capabilities.

## Instructions for the AI implementing a stage

1. Read applicable `AGENTS.md` instructions, this file, the relevant parts of `BUILD_PLAN.md`, and the actual implementation. Inspect the working tree and preserve unrelated changes.
2. State the selected stage, what already exists, and the remaining acceptance criteria. A placeholder screen or declared TypeScript interface is not a delivered feature.
3. Build the smallest complete user workflow first, then finish every required item in that stage. For example, deliver one playable lesson with saved progress before expanding the lesson library.
4. Reuse the existing board, chess adapter, navigation, theme, and storage patterns. Add focused modules instead of putting every feature into `App.tsx` or replacing the foundation.
5. Define and version the relevant content/data contracts before persisting new records. Migrate existing data without silently deleting or resetting it. Keep lesson/exercise state separate from the free practice workspace.
6. Implement loading, empty, invalid-data, interrupted, and error states alongside the main path. Show saved status only after a successful storage transaction.
7. Add meaningful checks for the new behavior, run applicable existing checks (`npm test`, `npm run build`, and `npm run test:e2e` for affected browser workflows), and verify the actual user workflow. Do not claim Safari was tested based only on WebKit automation.
8. Update this file's stage status and append completion evidence when the entire gate passes. If only part passes, mark the stage `In progress` and list remaining work. Record blockers precisely without marking incomplete work complete.
9. Report what changed, validation results, and any material limitations. Do not start the next stage merely to disguise an unfinished gate.

When asked to “build Stage N,” implement that stage and any missing prerequisites needed for it, without automatically implementing unrelated later stages. Resolve ordinary implementation decisions using the specification and repository conventions.

### Shared product constraints

- React/TypeScript browser app, desktop first with usable narrow-screen layouts; Today, Learn, Openings, Train, Review, and local profile/settings remain the main areas.
- Personal, local-first use with $0 incremental spending. Core learning must work without cloud accounts, paid APIs, subscriptions, or an always-on backend.
- Games are played externally. In-app competitive games, matchmaking, and training bots are outside the current scope.
- Begin around the user's approximately 600 Chess.com blitz level. A 1500–2000 goal is an aspiration, never a promised outcome or completion criterion.
- Keep 3-minute and 5-minute results distinct when data permits. Do not fabricate clock findings, learning statistics, mastery, or rating improvement.
- Retain full position/history information for legal play and draw rules. Validate all instructional move sequences and accepted answers.
- Track content IDs, versions, sources, and licenses. Verify current provider documentation and dependency/license requirements when integrating external services or packages.
- Preserve keyboard use, readable text, visible focus, promotion choices, color-safe feedback, and light/dark themes as features grow.

## Stage 1 — Application foundation

**Status: Complete.** React/TypeScript/Vite, React Router, five-area navigation, legal chessboard, and browser persistence are implemented.

Existing capabilities:

- Click/tap, mouse drag, keyboard movement, promotion, orientation, legal destinations, check and last-move indicators, and temporary arrows.
- Move history, replay cursor, branching continuations, and reset.
- IndexedDB schema v1 for the practice workspace and local profile, serialized saves, visible storage errors, and retry.
- Responsive layouts and a saved system-aware light/dark preference.

Completion gate: legal moves work; illegal moves do not change the position; full history, replay cursor, and profile survive refresh; desktop and narrow-screen navigation work.

Evidence: `WEEK_1.md` records a passing production build, 11 unit checks, and 14 Chromium/WebKit browser checks after the theme update. Source is in `src/app`, `src/components`, `src/features/BoardWorkspace.tsx`, `src/chess/adapter.ts`, and `src/storage/database.ts`.

Do not rebuild this stage. Extend its tested behavior. Manual Safari and real-device touch checks remain in Stage 11; offline reload is deferred to Stage 12.

## Stage 2 — Interactive lessons and puzzle practice

**Status: Complete.** See the completion record below and `STAGE_2.md` for workflow and data details.

**Outcome:** The learner completes a lesson and a practice session, receives useful feedback, and resumes saved progress.

Required work:

- Define versioned lesson, lesson-step, exercise, accepted-answer, attempt, and completion contracts with stable IDs and skill tags.
- Support explanation steps, legal board interaction, guided examples, answer checking, hints, retries, and a completion summary.
- Author a starter set covering threats, hanging pieces, check/mate, basic notation, and simple tactics. Use enough reviewed examples to exercise the complete workflow; Stage 10 expands to release content targets.
- Add a curated puzzle session with setup positions, validated solution lines, opponent replies, accepted alternatives where appropriate, and feedback explaining the idea.
- Begin with untimed calculation and add optional short timed recognition drills. Teach the threat/checks/captures/piece-safety routine; track accuracy and hint reliance before increasing speed pressure.
- Save immutable attempts, hint use, outcome, content version, and resumable lesson/session position. Distinguish first unassisted success from success after help.
- Add content validation for FEN, legal continuations, IDs, required explanations, and source/license metadata. If using Lichess puzzle records, apply the first listed opponent move before presenting the user's turn.

Completion gate:

- Finish at least one complete authored lesson and a multi-exercise session through Learn/Train.
- Wrong legal moves, illegal moves, hints, retries, completion, and accepted alternatives produce appropriate feedback.
- Refresh mid-lesson and mid-session restores progress without duplicating attempts or completion records.
- A lesson or puzzle does not overwrite the saved free practice board.
- Invalid content fails validation; automated checks cover feedback and persisted progress.

## Stage 3 — Spaced review, essential endgames, daily plan

**Outcome:** Missed exercises return when due and Today offers an actionable study session.

Required work:

- Define review cards and scheduling state linked to source exercise IDs/content versions and immutable attempts.
- Start with configurable successful-review intervals such as 1, 3, 7, 14, and 30 days. Failures and heavily hinted attempts return sooner; document the exact initial rule.
- Keep move recall and plan understanding separate. Record due timestamps consistently and show dates in the learner's local time.
- Cap new cards and handle overdue backlogs. Repeated failures should prompt teaching, not an endless unbounded queue.
- Add starter endgame lessons/drills: basic king-and-queen/rook mating ideas, king activity, opposition, and simple pawn promotion decisions with validated positions.
- Populate Today with due reviews, a recommended lesson, targeted practice, and a session summary using real records.

Completion gate:

- A failed exercise becomes a scheduled card; successful unassisted recall advances it according to the configured rules.
- Deterministic time-controlled checks verify due boundaries, hinted/failed outcomes, overdue cards, and duplicate prevention.
- Refresh retains the queue and active session; completed cards are not immediately repeated by mistake.
- Complete a daily session containing due review, a lesson, and practice; an empty queue has a useful next action.
- Complete at least one endgame lesson and its review exercise.

## Stage 4 — Detailed openings and repertoire training

**Outcome:** The learner studies the reasons behind opening moves and practices branches, plans, and accepted alternatives.

Required work:

- Model courses/chapters as a position graph supporting move-order transpositions, annotated edges, sidelines, repertoire choices, and content versions. Preserve full history for play separately from normalized opening lookup identity.
- Preserve recursive PGN variations when importing authored course material; a main-line-only loader is insufficient.
- Provide essential-plan, practical-branch, and advanced-reference layers. Explain both sides' plans, threats, pawn breaks, piece placement, common errors, and when precision matters.
- Start with authored Italian, Caro-Kann, and Queen's Gambit Declined chapters. Publish covered and uncovered replies; add compact references for common deviations.
- Support guided study, guess-the-move, plan questions, mixed branches, position recognition, unfamiliar replies, and spaced review.
- Store multiple sound answers when justified. Label a sound non-repertoire choice as a repertoire deviation rather than automatically a chess mistake.
- Include reviewed model-game examples and retain provenance for concrete analysis.

Completion gate:

- Complete a chapter in each starter opening, including a practical sideline and an explanation of both sides' plans.
- Reach the same opening position through two valid move orders without losing annotations or repertoire identity.
- Train a branch, accept a documented alternative, reject an actual error, and schedule its review.
- Answer an unfamiliar-reply exercise using the taught idea rather than only memorized moves.
- Refresh preserves course progress and repertoire choices; validation checks graph legality, variations, and answer sets.

## Stage 5 — Completed-game imports and viewer

**Outcome:** Import, filter, and replay completed blitz games without requiring engine analysis.

Required work:

- Add a saved Chess.com username preference, public archive discovery, and bounded recent imports; never request a Chess.com password.
- Verify current Published-Data API behavior and browser access. Serialize requests and handle throttling, caching/stale data, missing users/archives, and network failures.
- Provide manual PGN file/paste import. If direct browser access fails, keep that path usable; add an allowlisted localhost proxy only if needed.
- Parse games and store stable source IDs, original PGN, players/colors, dates, results, exact time controls, available clocks, and legal move history. Report invalid games without discarding valid ones silently.
- Deduplicate repeated imports. Filter blitz and distinguish relevant time controls without guessing missing data.
- Add replay, move navigation, orientation, annotations, and a self-analysis step before engine findings.

Completion gate:

- Import a bounded sample of completed Chess.com games and a PGN file/paste fixture, then filter and replay them.
- Reimporting the same sample creates no duplicates; refresh preserves games and annotations.
- Missing clock data produces no invented time-use conclusions.
- Check invalid PGN, unsupported/missing metadata, no games, and provider failure with understandable outcomes.
- Verify provider-specific behavior using actual access where available and repeatable fixtures; record any unavailable live verification.

## Stage 6 — Browser analysis and mistake notebook

**Outcome:** Convert a verified mistake from an imported game into a usable scheduled exercise.

Required work:

- Integrate a compatible Stockfish WebAssembly build in a lazily loaded Web Worker, initially single-threaded and bounded to one analysis task at a time.
- Serve matching engine assets locally and retain applicable notices and exact source/build provenance from integration onward.
- Define analysis jobs, checkpoints, compatible cache keys, search provenance, findings, and notebook entries. Normalize evaluation perspective and handle mate scores separately.
- Run an initial scan followed by deeper checks of selected critical positions. Compare moves under consistent settings; record uncertainty and avoid treating every small score change as a verified mistake.
- Support cancellation, timeouts, retry, worker failure, stale-result rejection, and refresh/tab interruption with completed work checkpointed.
- Present a few useful findings: played move, missed threat/idea, verified alternatives, and a legal explanatory continuation. Treat thematic classifications as heuristics where necessary.
- Create replay exercises from verified positions, preserve valid alternatives, and link notebook entries to the game, analysis, attempts, and Stage 3 review queue.

Completion gate:

- Analyze an imported game while board/navigation interactions remain responsive.
- Validate known material-loss and forced-mate fixtures, including evaluation signs for both player colors.
- Cancel or interrupt analysis, refresh, and resume without losing completed findings or accepting stale results.
- Turn a selected verified mistake into a notebook entry, solve its exercise, and find it scheduled for later review.
- Engine unavailability leaves game replay, lessons, and existing exercises usable.

## Stage 7 — Backups and reliable restoration

**Outcome:** Personal progress and game data can be exported and safely restored before relying on the beta.

Required work:

- Export a documented, versioned archive covering profile/preferences, practice state, lesson/course progress, attempts, review state, repertoire choices, games/annotations, notebook entries, and analysis checkpoints/results where supported.
- Preserve bundled content identity/version references and include user-authored data. Declare any excluded reproducible caches explicitly.
- Validate archive structure, versions, references, and chess data before applying changes. Reject unsupported future versions without touching current data.
- Define restore modes and conflict/duplicate behavior. Make restoration atomic or provide a staged rollback path so failure cannot leave a partially restored database.
- Add migrations and representative earlier-version fixtures; provide useful storage/quota errors and backup reminders in settings.

Completion gate:

- Export representative populated data, restore into an isolated clean browser database, and compare progress, due cards, repertoire, games, notebook links, and replay state.
- Restoring again follows the documented duplicate/conflict policy.
- Corrupt, truncated, incompatible, and failed-write imports preserve existing usable data.
- Restore data written by earlier implemented schemas; retain backup format/version documentation.

## Stage 8 — Integrated personal beta

**Outcome:** The entire learning loop works using the learner's own games.

Required work:

- Connect game findings to relevant lessons, puzzles, opening chapters, and due reviews using shared skill/content references.
- Make Today guide a coherent session: due review, targeted tactics, concept study, and a personal-game position.
- Add real progress summaries for delayed accuracy, hint reliance, recurring errors, and reviewed-game sample sizes.
- Resolve integration gaps, broken links, mismatched positions, duplicate scheduling, and confusing transitions.
- Provide a documented walkthrough and keep backup/restore accessible.

Completion gate:

- Import a personal game → inspect it → analyze a mistake → study a related idea → practice → complete a delayed review → inspect a later game for recurrence.
- Include an opening chapter, an unfamiliar reply, and its delayed review in the walkthrough.
- Refresh at major boundaries and resume; no workflow depends on demo-only records.
- Back up and restore the walkthrough's data successfully.
- A browser integration check covers the core loop with deterministic games/analysis fixtures; actual browser engine execution is also verified separately.

## Stage 9 — Coaching and personalization

**Outcome:** Explanations and recommendations reflect verified weaknesses and remain useful without a generative model.

Required work:

- Add reviewed structured answers to “What did I miss?”, “Why does this lose material?”, and “What plan should I follow?” using exact positions and verified lines.
- Use transparent recommendation rules based on due reviews, repeated mistakes, hint reliance, delayed recall, encountered openings, and preferences. Show evidence/sample size and handle sparse data.
- Adjust daily allocations and new-card limits without overwhelming the learner. Do not equate course completion or puzzle performance with playing strength.
- Optionally add a local Ollama coach only after measuring device resources, speed, licensing, and answer quality. Keep this optional subtask separately recorded; it is not required for the core stage gate.
- If adding a bridge, bind to localhost, restrict origins, require a session token, validate input and every suggested move sequence, and fall back to reviewed feedback if validation fails. No paid API fallback.

Completion gate:

- Repeated recorded weaknesses change recommendations; sparse or absent evidence does not invent conclusions.
- Explanations reference the correct position, legal moves, and verified continuations.
- Training and structured coaching work when the optional model is absent or fails.
- If a local coach is implemented, verify rejection of invalid lines, unavailable-service fallback, and reconnection.

## Stage 10 — Content expansion, corrections, learning progress

**Outcome:** The personal release has a reviewed curriculum of useful breadth, with safe corrections to saved learning data.

Required work:

- Expand toward the original first-release targets: 15–20 foundational lessons, 6–10 opening chapters, 300–500 curated puzzles, and 6–10 essential endgame lessons. Count validated, reviewed items rather than placeholders.
- Expand common White 1.e4 replies and Black deviations based on encountered games. Keep an explicit repertoire coverage list and incomplete areas visible.
- Track tactics, calculation, openings, strategy, and endgames separately; support placement skips and reference access.
- Use configurable progression criteria based on unassisted success, delayed retests, and unfamiliar examples. Keep thresholds provisional and learning tracks distinct from official titles.
- Add a correction process: version content, retain attempt provenance, migrate/revalidate affected review cards, and retire invalid exercises without destroying history.
- Check explanation clarity, answer equivalence, legal lines, source/license records, and correction effects across the content library.

Completion gate:

- Meet the stated content ranges or record a user-approved scope adjustment; every released item passes validation and has reviewed feedback.
- Correct an answer/lesson in a test fixture while retaining historical attempts and keeping active reviews meaningful.
- Demonstrate separate skill progress, delayed checks, and placement/reference access without unsupported mastery claims.
- Course descriptions match actual branch coverage; no broken references or undocumented source/license gaps remain.

## Stage 11 — Release hardening and stable personal release

**Outcome:** A stable personal app passes browser, accessibility, storage, recovery, and performance checks.

Required work:

- Test actual Safari and Chrome plus automated Chromium/WebKit checks. Check narrow layouts and touch interaction, keyboard-only workflows, focus management, readable notation, contrast, text scaling, reduced motion, and error announcements.
- Exercise blocked migrations/multiple tabs, unavailable storage, quota failures, malformed saved data, large imports, backup failures, and restored databases.
- Exercise worker asset failure, timeouts, cancellation, tab suspension, refresh, and interrupted-analysis recovery.
- Measure initial loading, lesson interaction, large game-library filtering, storage operations, and bounded engine jobs on the target device. Record practical budgets and observed results; keep expensive work off the UI thread.
- Verify production serving at a stable origin, migration behavior across app updates, dependency checks, content validation, and applicable engine/source/license distribution requirements.
- Fix release-blocking defects and document remaining limitations and recovery steps. A contingency is concrete unresolved work, not another time estimate.

Completion gate:

- Production build and relevant unit/integration/browser checks pass; manual Safari/Chrome and accessibility evidence is recorded.
- The Stage 8 walkthrough works on the hardened production build.
- Storage and interrupted-analysis failures preserve committed data and offer a usable recovery path.
- Backup restoration passes after the final schema/content changes; measured performance meets recorded budgets.
- No unresolved blocker prevents the agreed personal workflow. Offline reload is promised only if Stage 12 is delivered.

## Stage 12 — Optional installation and offline reload

Deferred until the core personal release is stable. Add a service worker/PWA, app-shell and selected content/engine caching, explicit downloaded-content status, and safe cache updates.

Completion gate: after an initial successful download, reload offline and complete lessons, drills, due reviews, and supported browser analysis; reconnect and upgrade app/content/engine caches without losing progress. Explain unavailable network imports and uncached material clearly.

## Stage 13 — Optional public product and broader learning tracks

Deferred; select concrete scope before implementation. Possible work includes static hosting, privacy/export/delete flows, authenticated accounts and synchronization, optional hosted services with explicit spending limits, additional clients, and expanded intermediate-to-grandmaster study material.

Before public distribution, verify current hosting/provider requirements, content and engine licenses, privacy obligations, operational costs, and migration from local archives. Preserve adapters and formats that let the personal app evolve without forcing cloud use.

Completion gate must be agreed for the selected extension. Public launch and comprehensive advanced instruction are separate projects beyond the personal-release gate; learning-track names never certify titles or playing strength.

## Completion record

Append one entry when each stage gate passes:

```markdown
### Stage N — Completed YYYY-MM-DD
- Delivered: user-visible capabilities and content included.
- Data: schema/content/backup changes and migration behavior.
- Verification: commands, results, manual workflows, browsers/devices.
- Limitations: explicit exclusions or optional work still deferred.
- Evidence: relevant source, tests, and documentation paths.
```

For Stage 1, the existing evidence remains in `WEEK_1.md`. The next implementation task is **Stage 3: spaced review, essential endgames, and daily plan**.


### Stage 2 — Completed 2026-10-10
- Delivered: five original starter lessons with explanation, guided example, legal board exercises, hints/retries, and completion summaries; six-position untimed calculation and three-position optional timed recognition sessions; alternative mating answers and a multi-move fork with opponent reply. Resumption works mid-example, mid-lesson, and after the fork reply. Free practice remains independent.
- Data: bundled content schema v1 and progress schema v1; IndexedDB schema v2 adds runs, immutable attempts, and completions while retaining v1 history/profile. Atomic revision-checked writes, verified idempotent retries, completion deduplication, malformed-data protection, and visible save/load recovery.
- Verification: `npm test` — 51 tests passed; `npm run build` — passed; `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/tempo-playwright npm run test:e2e` — 28 tests passed across Chromium and WebKit; TypeScript and `git diff --check` — passed. Desktop library/exercise and mobile light/dark screenshots inspected. Browser workflows cover illegal/wrong moves, hint/retry accounting, refresh, alternative mates, fork replies, completion, timers after suspension, failed writes, malformed records, and practice isolation.
- Limitations: small original starter library, no engine analysis or independent editorial review; no mastery/rating claims. Spaced reviews, endgames, daily planning, expansion, backups, manual Safari/real-device verification, and offline reload remain in their respective later stages.
- Evidence: `src/learning/`, `src/features/LearningArea.tsx`, `src/app/LearningContext.tsx`, `src/storage/learning.ts`, `tests/learning.test.ts`, `tests/learning-storage.test.ts`, `tests/migration.test.ts`, `tests/browser/learning.spec.ts`, and `STAGE_2.md`. Work was built on `codex/stage-2-lessons-puzzles`.
