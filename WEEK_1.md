# Week 1: learning workspace foundation

Scope confirmed by the user: **React/TypeScript foundation, navigation, interactive board, browser storage.** Acceptance: **legal moves work; progress survives refresh.**

## Deliverables

- React + TypeScript + Vite application with React Router.
- Responsive navigation for Today, Learn, Openings, Train, and Review; local profile settings.
- Reusable board backed by an application-owned chess.js adapter.
- Legal click/tap, mouse drag, and keyboard moves; promotion choices; orientation; optional legal destinations; check/last-move indicators; temporary arrows.
- Move history, replay, continuation branching, and confirmed reset.
- Versioned IndexedDB for the board and local profile; committed-save status, storage-failure notice, and retry.
- Unit and Chromium/WebKit integration checks for chess rules and persistence.

## Acceptance procedure

1. On Today, play e2–e4 and e7–e5. Try an illegal move and confirm the board is unchanged.
2. Wait for “Saved locally,” refresh, and confirm both the position and history return.
3. Replay an earlier move, refresh, and confirm the cursor returns with the full continuation available.
4. Navigate to Train and confirm it shares the saved practice board.
5. Edit the local profile, wait for save, and refresh to confirm it returns.
6. At a narrow width, use navigation and the board without horizontal scrolling.

Lessons and puzzles begin in Week 2; spaced repetition in Week 3; opening courses in Weeks 4–5; imports in Week 6; engine analysis in Week 7. Roadmap screens intentionally carry no invented learning statistics or completed content.

## Verification completed

- Production TypeScript/Vite build: passed.
- Unit checks: 11 passed.
- Browser checks: 10 passed across Chromium and WebKit, including refresh restoration, profile persistence, replay, promotion, keyboard movement, mouse drag, temporary arrows, narrow layout, and unavailable storage.
- Desktop (1440px) and mobile (390px) screenshots inspected.
- Dependency audit after installing patched tooling: zero known vulnerabilities.

Manual testing in the Safari application and on real touch devices remains part of release hardening. No offline reload guarantee is made in Week 1.

## Appearance update

Added system-aware light/dark mode with a top-bar toggle, saved preference, and theme application before first paint. Verified both palettes at desktop and mobile sizes. Updated browser suite: 14 checks passed across Chromium and WebKit; the 11 unit tests and production build also passed.
