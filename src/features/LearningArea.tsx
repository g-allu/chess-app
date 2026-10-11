import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Lightbulb,
  RotateCcw,
  Target,
} from "lucide-react";
import type { MoveInput } from "../chess/adapter";
import { positionStatus } from "../chess/adapter";
import { Chessboard } from "../components/Chessboard";
import { useLearning } from "../app/LearningContext";
import { getExercise, lessons, sessions } from "../learning/content";
import { advance, runBoard, startRun, summarize } from "../learning/engine";
import type { Action } from "../learning/engine";
import type { Course, Run } from "../learning/contracts";
function Player({ course, run }: { course: Course; run: Run }) {
  const { data, status, apply } = useLearning();
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(Date.now());
  const [flipped, setFlipped] = useState<boolean | null>(null);
  const step = course.steps[run.index],
    board = runBoard(run);
  const exercise =
    step.kind === "exercise" ? getExercise(step.exerciseId) : null;
  const busy = status !== "saved";
  async function act(action: Action) {
    if (busy) return;
    try {
      setProblem("");
      await apply(advance(run, action));
    } catch (error) {
      setProblem((error as Error).message);
    }
  }
  useEffect(() => {
    if (run.deadline === null || run.completed) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [run.deadline, run.completed]);
  useEffect(() => {
    if (run.deadline !== null && now >= run.deadline && !busy)
      void act({ type: "timeout" });
  }, [now, run.deadline, busy]);
  useEffect(() => {
    setFlipped(null);
    setProblem("");
  }, [run.index]);
  if (run.completed) {
    const summary = summarize(run, data.attempts);
    return (
      <section className="learning-summary" aria-labelledby="summary-title">
        <CheckCircle2 size={38} />
        <span className="eyebrow">SESSION COMPLETE</span>
        <h2 id="summary-title">An idea to carry into your next game.</h2>
        <p>
          {course.title} · {summary.exerciseCount}{" "}
          {summary.exerciseCount === 1 ? "exercise" : "exercises"} completed.
        </p>
        <div className="learning-metrics">
          <div>
            <strong>
              {summary.firstSuccesses}/{summary.exerciseCount}
            </strong>
            <span>First unassisted success</span>
          </div>
          <div>
            <strong>{summary.assisted}</strong>
            <span>Solved after help or another try</span>
          </div>
          <div>
            <strong>{summary.hints}</strong>
            <span>Hints used</span>
          </div>
          <div>
            <strong>{summary.wrong}</strong>
            <span>Wrong legal moves</span>
          </div>
        </div>
        {summary.timeouts > 0 && (
          <p>
            {summary.timeouts} time limit{summary.timeouts === 1 ? "" : "s"}{" "}
            reached. Keep calculating untimed until recognition feels
            comfortable.
          </p>
        )}
        <p>
          In your next game: identify the threat, scan checks and captures, then
          check your piece safety. This session records practice; it does not
          measure a playing rating.
        </p>
        <div className="learning-actions">
          <Link
            className="primary"
            to={course.kind === "lesson" ? "/train" : "/learn"}
          >
            {course.kind === "lesson" ? "Practice the ideas" : "Study an idea"}
          </Link>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void apply({ run: startRun(course) })}
          >
            Practice again
          </button>
        </div>
      </section>
    );
  }
  const title =
    exercise?.title ?? (step.kind !== "exercise" ? step.title : "Exercise");
  const canContinue =
    step.kind === "explanation" ||
    (step.kind === "exercise"
      ? run.solved
      : run.moves.length === step.line.length);
  return (
    <>
      <div className="learning-progress">
        <span>
          Step {run.index + 1} of {course.steps.length} ·{" "}
          {step.kind === "example"
            ? "Guided example"
            : step.kind === "exercise"
              ? "Your turn"
              : "Understand"}
        </span>
        <progress
          aria-label="Session progress"
          value={run.index}
          max={course.steps.length}
        />
        <span role="status">
          {status === "saved"
            ? "Progress saved"
            : status === "saving"
              ? "Saving progress…"
              : "Progress not saved"}
        </span>
      </div>
      <div
        className={
          board ? "workspace-grid learning-workspace" : "learning-reading"
        }
      >
        {board && (
          <section className="board-panel">
            <div className="panel-heading">
              <h2>{positionStatus(board)}</h2>
              <span className="pill">
                {exercise ? "Find the idea" : "Guided example"}
              </span>
            </div>
            <Chessboard
              key={step.id}
              game={board}
              flipped={
                flipped ??
                (exercise
                  ? getExercise(exercise.id).fen.split(" ")[1] === "b"
                  : false)
              }
              showLegal={false}
              disabled={busy || !exercise || run.solved}
              onMove={(from, to, promotion) =>
                void act({
                  type: "move",
                  input: { from, to, promotion } as MoveInput,
                })
              }
            />
            <div className="learning-actions">
              <button
                className="secondary"
                onClick={() =>
                  setFlipped(!(flipped ?? exercise?.fen.split(" ")[1] === "b"))
                }
              >
                Flip lesson board
              </button>
              <span className="learning-note">
                Tap or use arrow keys + Enter.
              </span>
            </div>
            {run.moves.length > 0 && (
              <p className="learning-line">
                Played: {board.history().join(" · ")}
              </p>
            )}
          </section>
        )}
        <section className="lesson-panel">
          <span className="eyebrow">
            {exercise ? exercise.skills.join(" · ") : "LEARN THE IDEA"}
          </span>
          <h2>{title}</h2>
          <p>
            {exercise?.prompt ?? (step.kind !== "exercise" ? step.text : "")}
          </p>
          {exercise && (
            <div className="scan-routine">
              <strong>Before you move</strong>
              <span>Threat → checks → captures → piece safety</span>
            </div>
          )}
          {run.deadline !== null && (
            <p className="drill-timer" role="timer">
              <Clock3 size={17} />
              {Math.max(0, Math.ceil((run.deadline - now) / 1000))} seconds left
              · then continue untimed
            </p>
          )}
          {run.feedback && (
            <div
              className={`learning-feedback ${run.solved ? "success" : ""}`}
              role="status"
            >
              {run.feedback}
            </div>
          )}
          {exercise && run.hints > 0 && (
            <div className="revealed-hints">
              <strong>
                Hints revealed ({run.hints}/{exercise.hints.length})
              </strong>
              {exercise.hints.slice(0, run.hints).map((h) => (
                <p key={h}>{h}</p>
              ))}
            </div>
          )}
          {problem && (
            <p role="alert" className="inline-notice">
              {problem}
            </p>
          )}
          <div className="learning-actions">
            {exercise && !run.solved && (
              <>
                <button
                  className="secondary"
                  disabled={busy || run.hints === exercise.hints.length}
                  onClick={() => void act({ type: "hint" })}
                >
                  <Lightbulb size={16} />
                  Hint
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void act({ type: "retry" })}
                >
                  <RotateCcw size={16} />
                  Retry position
                </button>
              </>
            )}
            {step.kind === "example" && !canContinue && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void act({ type: "example" })}
              >
                Show next move
              </button>
            )}
            {canContinue && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void act({ type: "next" })}
              >
                {run.index === course.steps.length - 1
                  ? "Finish session"
                  : "Continue"}
              </button>
            )}
          </div>
          {exercise && (
            <p className="learning-note">
              Wrong legal moves leave the position ready to try again. Hints and
              retries stay in your record.
            </p>
          )}
          <p className="learning-source">
            {course.source.author} · original content · {course.source.license}{" "}
            · v{course.version}
          </p>
        </section>
      </div>
    </>
  );
}
export function LearningArea({ kind }: { kind: "lesson" | "session" }) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data, status, apply } = useLearning();
  const list = kind === "lesson" ? lessons : sessions;
  const root = kind === "lesson" ? "/learn" : "/train";
  const course = list.find((c) => c.id === courseId);
  const latest = (id: string) =>
    data.runs
      .filter((r) => r.courseId === id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .at(0);
  const run = course ? latest(course.id) : undefined;
  async function open(c: Course) {
    if (latest(c.id) || (await apply({ run: startRun(c) })))
      navigate(`${root}/${c.id}`);
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">
          {kind === "lesson"
            ? "UNDERSTAND, THEN APPLY"
            : "MAKE ROOM FOR PRACTICE"}
        </span>
        <h1>
          {course?.title ??
            (kind === "lesson"
              ? "Understanding comes first."
              : "Pause. Scan. Calculate.")}
        </h1>
        <p>
          {course?.description ??
            (kind === "lesson"
              ? "Five short lessons. See the idea, follow an example, then try it yourself."
              : "Begin without a clock. Build accuracy before trying faster recognition.")}
        </p>
      </div>
      {status === "loading" ? (
        <p role="status">Opening your saved learning progress…</p>
      ) : (
        <>
          {courseId && (
            <Link className="learning-back" to={root}>
              <ArrowLeft size={16} />
              All {kind === "lesson" ? "lessons" : "practice sessions"}
            </Link>
          )}
          {courseId && !course && (
            <section className="lesson-panel">
              <h2>This content isn't available.</h2>
              <p>Choose a lesson or session from the library.</p>
            </section>
          )}
          {course &&
            (run ? (
              <Player key={run.id} course={course} run={run} />
            ) : (
              <section className="lesson-panel">
                <h2>Ready to begin?</h2>
                <button
                  className="primary"
                  disabled={status !== "saved"}
                  onClick={() => void open(course)}
                >
                  Start {kind}
                </button>
              </section>
            ))}
          {!courseId && (
            <>
              {kind === "session" && (
                <div className="scan-banner">
                  <Target size={24} />
                  <p>
                    <strong>A useful habit for every position</strong>
                    <br />
                    What is the threat? What checks and captures are available?
                    Are my pieces safe?
                  </p>
                </div>
              )}
              <div className="learning-library">
                {list.map((c, i) => {
                  const r = latest(c.id),
                    count = data.completions.filter(
                      (x) => x.courseId === c.id,
                    ).length;
                  return (
                    <article className="learning-card" key={c.id}>
                      <span className="eyebrow">
                        {kind === "lesson"
                          ? `LESSON ${String(i + 1).padStart(2, "0")}`
                          : c.secondsPerExercise
                            ? "OPTIONAL · TIMED RECOGNITION"
                            : "UNTIMED · CALCULATION"}
                      </span>
                      <span className="card-icon">
                        {kind === "lesson" ? (
                          <BookOpen size={22} />
                        ) : (
                          <Target size={22} />
                        )}
                      </span>
                      <h2>{c.title}</h2>
                      <p>{c.description}</p>
                      <span className="learning-note">
                        {c.steps.filter((s) => s.kind === "exercise").length}{" "}
                        {kind === "lesson" ? "practice position" : "positions"}
                        {count
                          ? ` · ${count} completed ${count === 1 ? "run" : "runs"}`
                          : r
                            ? ` · saved at step ${r.index + 1}`
                            : " · Ready to start"}
                      </span>
                      <button
                        className="primary"
                        disabled={status !== "saved"}
                        onClick={() => void open(c)}
                      >
                        {r?.completed
                          ? "View summary"
                          : r
                            ? "Resume"
                            : kind === "lesson"
                              ? "Start lesson"
                              : "Start session"}
                      </button>
                    </article>
                  );
                })}
              </div>
              {kind === "session" && (
                <div className="next-strip">
                  <RotateCcw size={24} />
                  <div>
                    <strong>Space to explore</strong>
                    <p>
                      Your free practice board keeps its own saved position.
                    </p>
                  </div>
                  <Link className="text-button" to="/train/free">
                    Free practice board
                  </Link>
                </div>
              )}
              {!list.length && (
                <p>
                  No content is available yet. Your existing progress is
                  preserved.
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
