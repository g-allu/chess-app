# Chess mastery app: web personal trainer

Prepared October 10, 2026. This document specifies the application. Week 1 foundation is implemented; see WEEK_1.md for its scope and acceptance checks.

## Confirmed requirements

- Responsive web frontend using React and TypeScript, desktop browser first with mobile-friendly layouts.
- Personal learning first, with a future path to a public product.
- Current Chess.com blitz rating: approximately 600; usual games: 3–5 minutes.
- Long-term target: 1500–2000 Chess.com blitz. This is an aspiration, not a promised result or delivery milestone.
- Core features: detailed opening instruction, game analysis, puzzles, coaching, training, spaced repetition, and Chess.com game imports.
- Games remain on Chess.com or other chess platforms. No in-app matches, bots, or matchmaking are required.
- Current incremental spending budget: $0. Assume use of the user's existing computer, browser, and internet connection; electricity, existing equipment, and development time are not literally free.
- Specifications and routine implementation choices are delegated to the developer. Offline capability should support learning without becoming a costly initial engineering requirement.

## Product objective

The app turns completed games into a personal learning program:

**Import games → identify recurring mistakes → teach the underlying idea → practice it → review later → measure application in subsequent games.**

At approximately 600 blitz, the initial curriculum emphasizes avoiding hanging pieces, noticing threats, elementary tactics, basic mates, and usable opening plans. Deep opening material remains a core feature, presented in progressive layers rather than requiring large amounts of theory before the player can benefit.

Track platform and time-control ratings separately. Do not equate puzzle rating, course completion, or a short winning streak with playing strength. Show sample sizes and trends rather than promising a date for reaching 1500 or 2000.

## Curriculum and stages

| Stage | Main material | Evidence for progression |
| --- | --- | --- |
| Beginner | Rules, notation, check and mate, safe moves, undefended pieces, basic checkmates | Reliable rules knowledge and threat recognition |
| Developing | Forks, pins, skewers, discovered attacks, short calculation, development and king safety | Unassisted solving and fewer repeated tactical errors |
| Intermediate | Candidate moves, calculation, pawn structures, opening plans, elementary pawn and rook endings | Transfer to unfamiliar positions and delayed recall |
| Advanced | Positional exchanges, prophylaxis, sacrifices, defense, complex middlegames, repertoire depth | Consistent decisions across varied structures |
| Expert | Difficult calculation, strategic imbalances, practical endings, repertoire repair, self-annotation | Strong independent analysis and reduced recurring errors |
| Master study | Precise move orders, deep analysis, difficult endgames, tournament preparation | Reviewed analysis projects and demanding practical exercises |
| Grandmaster study | Critical theoretical positions, opponent preparation, novelty research, elite model games | Advanced study portfolio and expert feedback when available |

These are learning tracks, not official titles or certified rating bands. Grandmaster study content does not confer a title or establish Grandmaster strength.

Maintain separate progress for tactics, calculation, openings, strategy, and endgames. Allow placement skips and reference access. Promotion uses unassisted performance, delayed retests, and unseen examples; initial thresholds are configurable hypotheses to tune during personal use.

For the user's first month, use a provisional study allocation of roughly 40% tactics/threat recognition, 25% review of personal games, 20% opening understanding and repetition, and 15% essential endings. Adjust using actual mistakes and preferences. These are product defaults, not scientifically established optimal proportions.

## Deep opening learning specification

Each important position should explain:

1. Why the move is played and what it threatens or prevents.
2. Main replies, practical sidelines, and reasonable alternatives.
3. Relevant move orders and transpositions.
4. Plans for both sides, not just the repertoire owner's moves.
5. Pawn structures, thematic breaks, favorable piece placements, and weak squares.
6. Typical tactical motifs, common mistakes, and verified punishments.
7. Annotated model games and the middlegames/endgames the opening creates.
8. Which moves require exact recall and which allow several sound choices.

Use three depth layers: essential plans, practical branches, and advanced reference theory. Branch length follows the position's needs rather than a fixed rule such as always memorizing twenty moves.

Provisional repertoire: White 1.e4, with the Italian Game against 1...e5; Black Caro-Kann against 1.e4 and Queen's Gambit Declined structures against 1.d4. These are development defaults selected for teaching recurring plans. White courses must eventually cover other common replies such as the Sicilian, French, Caro-Kann, and Scandinavian. Black courses must handle common deviations such as the London. Publish an explicit coverage list so a course is never described as a complete repertoire when it covers only one main line.

Initial authored chapters focus on the Italian, Caro-Kann, and Queen's Gambit Declined. Add compact reference explanations for common uncovered replies, then expand them from the user's actual games. Do not make incomplete side-line coverage block tactics and game review.

Lesson modes: guided explanation, guess the move, explain the plan, spaced review, mixed branches, position recognition, and evaluate an unfamiliar reply. In-app competitive play and training bots are excluded; user-entered continuations remain available on analysis boards.

Example Italian lesson: after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5, explain development, central influence, plans with c3/d4 versus slower d3 setups, conditions for a pawn break, and responses to changed move orders. Concrete continuations require engine checks and editorial review.

A sound move outside the chosen repertoire should be labeled a repertoire deviation, not automatically a chess mistake. Opening popularity, engine strength, and instructional preference must remain distinct.

## Blitz-specific training

Use untimed calculation practice to establish understanding, then short timed exercises to practice recognition. Include threat checks, forcing moves, hanging pieces, basic mating patterns, and simple defensive decisions.

Teach a brief decision routine: inspect the opponent's threat, consider checks/captures/threats, check piece safety, then choose a move. Measure hint reliance and accuracy before increasing speed pressure.

Maintain separate 3-minute and 5-minute game summaries where data permits. Prefer 5-minute games for initial application and review, while retaining 3-minute training. An occasional slower practice game is a useful recommendation, not a mandatory feature or a replacement for the user's blitz goal.

Clock analysis is conditional on recorded clock data. If PGN clock annotations are missing, the app must not invent time-use findings or claim a mistake was caused by time pressure.

## Core screens and first usable release

Five primary areas: Today, Learn, Openings, Train, and Review. Use a sidebar on desktop and compact navigation on mobile. Detailed progress and settings live under the profile; the personal version needs no cloud account.

- Today: due reviews, one recommended lesson, targeted puzzles, and a game position to revisit.
- Learn: stages, lessons, skill assessments, and reference material.
- Openings: repertoire, annotated branches, explanation depth, and review queue.
- Train: tactics, calculation, threat recognition, and essential endings.
- Review: Chess.com imports, self-analysis, engine findings, and mistake notebook.

The reusable board supports click/tap-to-move, optional dragging, promotion, orientation, legal moves, arrows, replay, and hints. Place explanations alongside the board on desktop and below it on narrow screens. Include keyboard interaction, accessible square labels, visible focus, text scaling, color-safe indicators, and reduced motion.

First-release content targets: 15–20 concise foundational lessons, 6–10 carefully reviewed opening chapters, a curated 300–500-puzzle set, and 6–10 essential endgame lessons. These are scoping targets, not full coverage through advanced stages.

A typical 20–25-minute study session contains due reviews, targeted tactics, one short concept lesson, and replay of a few mistakes. Actual games are played externally.

## Architecture within a $0 spending budget

| Component | Initial implementation |
| --- | --- |
| Frontend | React + TypeScript + Vite + React Router; standard responsive CSS |
| Chess rules | chess.js behind an application-owned adapter |
| Board | Reusable React web board with SVG pieces and pointer/keyboard input |
| Persistence | IndexedDB in the browser, versioned bundled lesson data; localStorage only for small preferences |
| Personal identity | Local profile; optional Chess.com username stored as a preference |
| Imports | Public Chess.com completed-game archives; manual PGN file/paste fallback |
| Engine | Stockfish.js WebAssembly in a Web Worker, initially the lite single-threaded build |
| Analysis queue | Browser-side queue with IndexedDB checkpoints and cached results |
| Optional local bridge | Small Node/TypeScript service only for local-model coaching or an import proxy if needed |
| Coach | Reviewed instructional explanations and engine evidence; optional local model through Ollama |
| Backups | Export/import a versioned archive of progress, games, and repertoire |
| Content authoring | Versioned JSON/Markdown plus validator scripts; editor UI later |

Run the first version locally on the existing computer with Vite. Use a production build served locally for stable personal use. Pin the local origin/port because browser data belongs to its origin. No native build, app signing, app store account, cloud account, or always-on backend is required for the core learning loop.

Load the engine lazily when analysis is requested and run it off the UI thread. The single-threaded lite build avoids the cross-origin isolation headers required by multithreaded builds. Keep engine files on the same origin and preserve their matching versions and licenses. Validate real performance in Safari and Chromium before choosing search budgets. The lite build trades some engine strength for a smaller download; use deeper/full-engine verification for critical authored course analysis when appropriate.

The core application does not need a separate Mac engine gateway: analysis runs on the device using the browser. The optional coaching bridge can connect to Ollama on the existing computer. Bind it to localhost initially, allow only the application's explicit origin, require a session token, validate input, and keep the engine/model service off the public internet. If mobile access is added, treat LAN pairing and HTTPS-to-local-service browser restrictions as an explicit integration task rather than assuming a publicly hosted page can call localhost.

Lessons, drills, attempts, saved reviews, and browser analysis work independently of the optional coaching bridge once their assets are loaded. Initial offline reload is not promised: add a service worker/PWA milestone after the core loop works, caching the app shell, selected content, and engine assets and testing upgrades. Browser tabs may be suspended or closed; checkpoint completed positions and resume analysis instead of promising background execution.

Browser storage can be cleared or evicted. Request persistent storage where supported, handle quota failures, and include export/import backups early. Data remains specific to the browser profile and origin; cross-device synchronization is a later feature.

Avoid paid cloud APIs, subscriptions, cloud databases, cloud build dependencies, and always-on hosted servers during the personal phase. Free vendor tiers may change and are not a reliable basis for a strict zero-spending requirement.

## Data model and technical correctness

Store local profiles; skill estimates; courses/chapters/lessons/content versions; positions/legal move edges; repertoire choices; puzzles/exercises; immutable attempts; spaced-review state; imported games/moves; analysis jobs/findings; mistake notebook entries; and study sessions.

Represent openings as a graph so different move orders can reach the same position. Store full FEN and move history for legal play and draw rules. Use a separate normalized identity for opening lookup, retaining castling and relevant en-passant rights. Do not erase repetition or fifty-move state in analysis caches.

Use unique IDs for imports and attempts to prevent duplicate records. Preserve content versions so existing reviews remain meaningful after lessons change. Use a schema version and database migrations from the first release.

A dedicated PGN parser should preserve recursive annotation variations for opening material. Do not assume a basic game loader preserves an entire course variation tree. Display SAN notation; store engine moves in UCI where appropriate.

Suggested repository layout: src/app; src/features; src/chess; src/storage; src/workers; content/courses; scripts/content-validation; services/local-coach (optional). Start with one Vite application and shared TypeScript contracts. Extract reusable chess/content modules later if a second client needs them.

## Chess.com import and review pipeline

1. Enter a username and fetch available public game archives.
2. Import completed games, initially a bounded recent sample such as 20–50 games.
3. Filter blitz, retain exact time control, deduplicate by source identifier, and parse PGN.
4. Let the user inspect/annotate the game before revealing engine assistance.
5. Run a fast scan, then deeper analysis at a small number of critical decisions.
6. Explain a few useful findings: what happened, what threat was missed, and what alternative works.
7. Create a verified replay exercise for a selected mistake.
8. Schedule delayed review and watch for similar errors in subsequent games.

Chess.com's Published-Data API is read-only public data and may be cached. Import is not live account synchronization, account ownership verification, or guaranteed instant access to a just-finished game. Serialize provider requests and handle throttling, absent archives, stale responses, and network failures. Never ask for the user's Chess.com password.

Verify browser access to the selected archive endpoints in the technical spike. If CORS prevents a browser request, retain file/paste PGN import and use an optional allowlisted local proxy; do not assume an API being public guarantees arbitrary browser access. Restrict any proxy to known Chess.com endpoints.

Analysis should separate material oversights, missed tactics, opening-plan errors, and endgame errors. Some thematic classification is heuristic and must be labeled cautiously. Do not infer a psychological cause from an engine score alone.

Normalize evaluation perspective consistently; handle mate scores separately. Use consistent search settings for comparisons and show engine/search provenance. Store alternative continuations when several moves are sound. Ignore stale job results after the user changes position.

The browser worker runs one bounded analysis task at a time initially and handles cancellation, timeouts, retries, and job identifiers. Cache compatible analyses and precompute lesson positions. Persist progress after each analyzed position. Closing or suspending the tab produces a recoverable interrupted job rather than losing the game or completed findings.

## Coaching specification

Provide reviewed lesson explanations and structured feedback immediately. This baseline is an instructional coach, not unrestricted generative AI.

Add an optional local generative model through Ollama after measuring the Mac's memory, response speed, and answer quality. Use a locally available model with a suitable license; do not assume every model hosted through Ollama runs locally or is appropriate for public redistribution. No paid API fallback is allowed under the current budget.

Give the coach exact FEN, legal candidates, verified engine lines, reviewed lesson snippets, and the user's level. Validate every suggested move sequence. Use focused questions such as 'What did I miss?', 'Why does this move lose material?', and 'What plan should I follow?'.

The model does not determine legality or override verified chess facts. If its explanation fails validation or lacks evidence, display the structured engine/lesson explanation instead. Training remains usable when the local model is unavailable.

## Repetition and personalization

Create cards for critical opening choices, thematic plans, previously missed puzzles, essential endgames, and personal game mistakes. Keep move recall and plan understanding as separate evidence.

Begin with a simple configurable review schedule such as 1, 3, 7, 14, and 30 days after successful unassisted recall. Failed or heavily hinted attempts return sooner. These are initial defaults, not a proven optimized learning algorithm.

Prioritize due cards, repeated personal errors, and frequently encountered opening branches. Limit daily new cards to avoid an unmanageable backlog. Require delayed success on varied examples before declaring a skill mastered.

Use straightforward recommendation rules first. Machine-learning personalization is unnecessary for a single-user launch.

## Content sources and quality

Lichess's open database provides CC0 puzzle/game exports and is suitable for seed data under those published terms. Track source/license metadata separately for games, annotations, images, and code.

For Lichess puzzle imports, the supplied FEN precedes the opponent's first listed move. Apply that move before showing the puzzle; the second move begins the answer. Validate the sequence and permit legitimate equivalent solutions where appropriate.

Course explanations should be authored, engine-checked, and reviewed for clarity. Paid books/courses/video annotations must not be copied without permission. The zero-budget beta uses a limited original course set; comprehensive master-level instruction and qualified editorial review are future resource requirements.

Stockfish and the chosen Stockfish.js browser package are GPLv3. Serving browser engine assets distributes them. Include applicable notices and exact matching source/build provenance from the outset, and review the integration's obligations before public release. Do not assume delivering WebAssembly exempts it from the license.

## Delivery roadmap

The confirmed weekly schedule is:

| Timing | Deliverable | Completion criteria |
| --- | --- | --- |
| Week 1 | React/TypeScript foundation, navigation, interactive board, browser storage | Legal moves work; progress survives refresh |
| Week 2 | Lesson player, initial beginner lessons, puzzles | Complete a lesson and practice session with feedback |
| Week 3 | Spaced repetition, basic endgames, daily study plan | Missed exercises return on schedule |
| Weeks 4–5 | Detailed opening courses and repertoire training | Study explanations, sidelines, plans, and accepted alternatives |
| Week 6 | Chess.com imports and game viewer | Import, filter, and replay completed blitz games |
| Week 7 | Browser Stockfish analysis and mistake notebook | Turn a verified game mistake into a review exercise |
| Week 8 | Integrated personal beta | Complete the entire learning loop using your games |
| Weeks 9–10 | Coaching explanations, personalization, backups, content corrections | Recommendations reflect your weaknesses; data restores correctly |
| Weeks 11–12 | Release hardening and contingency | Safari/Chrome checks, accessibility, interrupted-analysis recovery, storage handling, and performance pass |

The milestones below group related work across that schedule.

| Milestone | Deliverable and acceptance gate |
| --- | --- |
| 1: Learning foundation | Responsive browser board, IndexedDB, one complete interactive lesson, saved/resumable progress |
| 2: Training | Tactics, basic endgames, hint tracking, timed/untimed modes, spaced reviews |
| 3: Detailed openings | Annotated course graph, explanations, sidelines, accepted alternatives, repertoire review |
| 4: Personal game loop | Chess.com imports, browser Stockfish worker, critical positions, mistake exercises |
| 5: Coaching and refinement | Evidence-based explanations, optional local-model coach, adaptive daily plan, backups |
| 6: Personal beta | Safari/Chromium and mobile-layout QA, content corrections, recovery behavior, learning metrics |

Optional follow-up: PWA installation/offline reload and broader mobile-browser support. Neither should delay the first usable desktop learning loop.

Planning range: retain the provisional 8–12 full-time developer weeks for a focused personal beta with limited content, now using browser analysis. This is an estimate, not a commitment. Web removes native build and signing work, but content authoring, engine integration, and learning features still need implementation and validation. Refine the estimate after the technical spike; the usable learning foundation should arrive well before the complete beta.

First complete vertical milestone: study one opening chapter in the browser, answer an unfamiliar reply, complete a delayed review, import a sample game, and convert one verified error into a scheduled exercise. Expand content after this works.

## Verification and improvement metrics

Verify legal-move edge cases, promotions, draw/history behavior, PGN variations, opening transpositions, alternative answers, score perspective, forced mates, interrupted jobs, duplicate imports, database migrations, backups, and content revisions.

Verify Safari and Chromium, desktop and narrow-screen layouts, keyboard/touch accessibility, browser refresh and tab suspension, worker asset loading, storage quota failures, backup restoration, and optional bridge reconnection. Add browser integration tests for the lesson-to-review loop. Test offline reload only after service-worker caching is implemented, including content/engine cache upgrades.

Measure delayed puzzle accuracy, hint reliance, retained opening knowledge, success on unfamiliar positions, repeated one-move oversights per sampled games, basic endgame decisions, and Chess.com blitz trends. Show sample sizes and distinguish 3-minute from 5-minute play where possible. Streaks and lesson counts are secondary.

## Future public launch

Keep data access, analysis, and coaching behind adapters so a hosted backend can be introduced later. A public web release can begin as static assets with browser analysis; choose hosting only after checking current limits and requirements. Later additions may include authenticated accounts, Supabase/PostgreSQL, cross-device sync, optional hosted analysis, and cloud coaching with explicit spending limits. Native mobile clients remain optional future work.

Before public release, budget for distribution, hosting, backups, monitoring, content review, privacy/export/delete flows, and any billing. Preserve the lesson schema and local export format so the personal data can migrate. Reassess licenses, provider policies, and prices at that point.

## Primary references

- [Vite React/TypeScript setup and builds](https://vite.dev/guide/)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Stockfish.js builds and browser workers](https://github.com/nmrugg/stockfish.js)
- [chess.js documentation](https://jhlywa.github.io/chess.js/)
- [Stockfish licensing](https://stockfishchess.org/about/)
- [Lichess database and puzzle format](https://database.lichess.org/)
- [Chess.com Published-Data API](https://www.chess.com/news/view/published-data-api)
- [Ollama local model setup](https://docs.ollama.com/quickstart)
