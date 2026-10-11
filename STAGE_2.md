# Stage 2 — Interactive lessons and puzzle practice

## Delivered workflow

Learn contains five original starter lessons: threats, hanging pieces, check/mate, basic notation, and knight forks. Each lesson has an explanation, a guided board example, an exercise, and a completion summary. Guided moves advance individually and survive refresh.

Train contains a six-position untimed calculation session and an optional three-position recognition drill with 30 seconds per position. Begin with the untimed session. Every position reminds the learner to scan threats, checks, captures, and piece safety. The fork includes an automatic illustrated opponent reply followed by another user move; both mating positions accept all legal mate-in-one alternatives.

Wrong legal answers show idea-specific feedback and leave the position ready to try again. Illegal moves leave the board unchanged and show a visible notice. Hints reveal progressively; retry resets the puzzle continuation while retaining prior help and mistakes. A timed-out position records the expiry once and continues untimed. The deadline survives navigation, refresh, and tab suspension.

Progress is committed before a step changes. Resume from the library or refresh the active URL. Completion summaries show first unassisted success, success after help or another try, hints, wrong legal moves, and timeouts using actual records. An intermediate correct move in a multi-move answer is not counted as a completed exercise.

The free practice board remains on Today and at **Train → Free practice board**. Its history, replay cursor, and preferences are separate from lesson/session positions.

## Data contracts and recovery

- Bundled content schema v1 defines courses, lesson steps, exercises, accepted answer lines, stable IDs, skill tags, and source/license metadata. A course version governs its steps; an exercise version governs its accepted answers and explanations.
- IndexedDB schema v2 adds `learningRuns`, `attempts`, and `completions` without deleting or resetting v1 `workspaces` or `profiles`.
- Progress schema v1 retains each run's course/version, step index, legal continuation, hint/mistake counts, optional absolute deadline, revision, and timestamps.
- Attempts are immutable events with exercise/version, step, skills, position, move where applicable, hint count, outcome, and first-unassisted flag. Hint/retry/timeout events are preserved alongside answer events.
- Progress, attempt, and completion changes commit in one transaction. Stable event IDs and revision checks prevent duplicate retries and reject stale changes from another tab. Repeating a completed transaction does not append another event.
- A failed save leaves the last committed state visible and offers **Retry learning storage**. A failed load or malformed record blocks learning writes and preserves stored records. The free practice workspace keeps its independent error/recovery behavior.
- Each repeat creates a new run; earlier attempts and completion records remain. Backups and restoration are Stage 7 work.

## Content provenance and validation

All six exercise positions and explanations are original Tempo content, marked `CC0-1.0`; no provider data or external service is used. The content validator checks FEN, legal continuations, required explanations, IDs, references, deterministic opponent replies, and source/license metadata. Tests enumerate the available legal mate-in-one moves for both mating positions and compare them with the accepted alternatives.

This is a small starter library. Curriculum expansion, independent editorial review, engine analysis, spaced repetition, opening courses, and rating/skill estimation remain later-stage work. Practice results do not certify mastery or a playing rating.

## Verification

Run `npm test`, `npm run build`, and `npm run test:e2e`. Focused tests cover content validation, course completion, feedback, hint/retry accounting, alternative mates, fork continuation restoration, timer boundaries, database migration, immutable records, and atomic recovery. Browser workflows cover real board input, refresh, completion, free-board isolation, timers, failed writes, and narrow-screen keyboard use in Chromium and WebKit.

See the Stage 2 completion record in `STAGES.md` for final results. WebKit automation is not a manual Safari test. No offline reload guarantee is made.
