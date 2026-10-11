# Stage 3 — Spaced reviews, endgames, and daily study

## Delivered workflow

Today offers a saved plan of due reviews, one recommended lesson, and one targeted practice exercise. With no due cards it offers the lesson and practice. Recommendations use incomplete lessons, due exercises, and recent wrong/timeout attempts; the initial fallback is piece safety. A card with repeated failures puts its relevant lesson first. A daily plan fixes its choices and exact run IDs so navigation, refresh, concurrent plan creation, and midnight do not replace an unfinished task. The summary derives completed tasks, unassisted final solutions, and hints from actual saved records.

Train → Spaced reviews shows due cards, backlog size, upcoming local dates, and review settings. Resume an unfinished standalone review after refresh. A completed card disappears from the due queue until its next timestamp. The personal-game Review navigation remains planned for Stages 5–6.

Learn adds five original CC0 lessons: queen/rook mating finishes, king activity supporting a pawn, distant opposition, and promotion to suitable mating material. Train adds a five-position untimed endgame session. The queen finish accepts all four mating moves; promotion accepts queen and rook. These lessons introduce basic ideas using final setups and precise goals; they do not claim complete forced conversion instruction. Existing starter exercises, step IDs, and versions remain unchanged.

## Exact initial scheduling rule

The settings are initial product defaults, not a proven optimized learning algorithm:

- One deterministic move-recall card per exercise ID/content version. Immutable attempt IDs link the card to its evidence and prevent replaying an effect twice. Intermediate correct moves do not create or advance a card.
- A new exercise solved first without hints/misses returns in one day. Its review interval index starts at −1. Ordinary lesson/practice successes on an existing card do not advance its recall interval or change its saved due date.
- A delayed, first unassisted success in the dedicated review course advances the index and schedules 1, 3, 7, 14, then 30 days from that success. Further successes repeat the 30-day interval. Early reviews do not advance the interval.
- A wrong answer, any hint, retry, timeout, or assisted final success resets the index to −1 and schedules four hours from the event. Several such events in the same run count as one failed encounter. After three consecutive failed encounters, the card prompts teaching. Delayed unassisted recall clears that prompt and consecutive count, retaining total failures.
- Admit at most five new cards per learner-local calendar day. Excess cards are reserved for later local midnights without discarding their attempt history. A due date never precedes admission. The default daily session includes up to ten due cards in oldest-due order; the remaining backlog stays queued.
- Timestamps are ISO UTC instants; the browser displays dates in the learner's local time. Successful intervals use elapsed 24-hour days, while admission boundaries use local calendar days (including daylight-saving changes).
- Review settings change future scheduling events, admission counts, and queue limits. Existing saved due timestamps remain intact. Daily plans already saved keep their task choices.

Cards identify their evidence as `move-recall`. Lesson completion, hinted success, and move recall remain distinct records; no plan-understanding outcome, mastery, or rating gain is inferred.

## Contracts and storage recovery

IndexedDB v3 adds `reviewCards`, `reviewSettings`, and `dailySessions` through additive migration. The free workspace, profile, and Stage 2 stores retain their records. Review and daily data use schema v1. Cards store source exercise/version, immutable attempt references, due/admission timestamps, schedule index, failure history, and teaching status. A daily snapshot stores its local day, creation timestamp, task kinds, course versions, and deterministic run IDs; completion comes from learning records.

Learning progress, attempt/completion records, and corresponding review changes share a revision-checked transaction. Duplicate retries do not append attempts or shift schedules. Loading reviews backfills existing Stage 2 attempts after validation, recognizing the final accepted move of multi-move solutions. Malformed records block affected writes and remain stored. A failed learning save retains the last committed position and offers retry. A failed daily-plan save offers retry before any task starts; the plan is displayed as saved only after commit. Unfinished plans remain available across midnight and the next reload.

## Verification

`npm test`: 88 checks passed. `npm run build`: passed. `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/tempo-playwright npm run test:e2e`: 40 browser checks passed in Chromium and WebKit. `git diff --check`: passed.

Scheduling tests control time for exact due boundaries, interval progression, help/failure outcomes, early reviews, multi-move answers, caps, backlog order, and duplicate prevention. Storage tests cover atomic attempt/card writes, historical backfill, concurrent revisions, invalid settings/cards, v1/v2 migration, immutable daily plans, content versions, and midnight recovery. Browser tests complete due review → lesson → practice, refresh tasks and endgame reviews, recover failed daily writes, persist configurable settings, and resume an exercise across local midnight. Existing legal-board, theme, promotion, keyboard, timer, and learning recovery tests remain green.

WebKit automation does not replace manual Safari or real touch-device verification. Independent editorial review, engine analysis, richer endgame conversions, backups, and offline reload remain later-stage work.
