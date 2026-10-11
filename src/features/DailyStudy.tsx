import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock3, Target } from "lucide-react";
import { useLearning } from "../app/LearningContext";
import { getCourse, getExercise, lessons } from "../learning/content";
import { startRun } from "../learning/engine";
import { getReviewQueue } from "../review/engine";
import {
  createDailySession,
  loadCurrentDailySession,
  localDay,
  recommendedLesson,
  saveDailySession,
  targetedExercise,
} from "../storage/daily";
import type { DailySession, DailyTask } from "../storage/daily";
import { Player } from "./LearningArea";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
function useDailySession(day: string) {
  const [session, setSession] = useState<DailySession>();
  const [status, setStatus] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    setSession(undefined);
    loadCurrentDailySession(day)
      .then((value) => {
        if (active) {
          setSession(value);
          setError("");
          setStatus("saved");
        }
      })
      .catch((problem) => {
        if (active) {
          setError(String(problem.message ?? problem));
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [day, reload]);
  async function save(value: DailySession) {
    if (lock.current || status !== "saved") return;
    lock.current = true;
    setStatus("saving");
    try {
      const stored = await saveDailySession(value);
      setSession(stored);
      setStatus("saved");
      return stored;
    } catch (problem) {
      setError(String((problem as Error).message ?? problem));
      setStatus("error");
    } finally {
      lock.current = false;
    }
  }
  return {
    session,
    status,
    error,
    save,
    retry: () => setReload((value) => value + 1),
  };
}
export function DailyStudy({ active = false }: { active?: boolean }) {
  const learning = useLearning(),
    now = useNow();
  const daily = useDailySession(localDay(now)),
    navigate = useNavigate();
  const [problem, setProblem] = useState("");
  const queue = getReviewQueue(learning.cards, now, learning.reviewConfig);
  const completed =
    daily.session?.tasks.filter((task) =>
      learning.data.runs.some((run) => run.id === task.runId && run.completed),
    ) ?? [];
  const task = daily.session?.tasks.find((task) => !completed.includes(task));
  const run = task && learning.data.runs.find((item) => item.id === task.runId);
  const allDone =
    !!daily.session && completed.length === daily.session.tasks.length;
  const busy = learning.status !== "saved" || daily.status !== "saved";
  async function begin() {
    const session =
      daily.session ??
      (await daily.save(createDailySession(learning.data, queue.cards, now)));
    if (session) navigate("/daily");
  }
  async function startTask(task: DailyTask) {
    if (busy) return;
    try {
      setProblem("");
      await learning.apply({
        run: startRun(getCourse(task.courseId), Date.now(), task.runId),
      });
    } catch (error) {
      setProblem((error as Error).message);
    }
  }
  const ownAttempts = learning.data.attempts.filter((attempt) =>
    daily.session?.tasks.some((task) => task.runId === attempt.runId),
  );
  const solved = ownAttempts.filter(
    (attempt) => attempt.firstUnassisted,
  ).length;
  if (daily.status === "loading" || learning.status === "loading")
    return <p role="status">Opening your daily plan…</p>;
  if (daily.status === "error")
    return (
      <div className="storage-error" role="alert">
        <strong>Daily plan needs attention.</strong>
        <span>{daily.error}</span>
        <button className="text-button" onClick={daily.retry}>
          Retry daily storage
        </button>
      </div>
    );
  if (active && !daily.session)
    return (
      <section className="lesson-panel">
        <h1>Your daily study session</h1>
        <p>Save a plan of due reviews, one lesson, and targeted practice.</p>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void begin()}
        >
          Start daily session
        </button>
      </section>
    );
  if (active && task)
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">TODAY / {task.kind.toUpperCase()}</span>
          <h1>{getCourse(task.courseId).title}</h1>
          {daily.session!.day !== localDay(now) && (
            <p>Resuming your session from {daily.session!.day}.</p>
          )}
          <p>
            Part {completed.length + 1} of {daily.session!.tasks.length}. Your
            session stays saved as you go.
          </p>
        </div>
        <Link className="learning-back" to="/">
          Back to Today
        </Link>
        {problem && <p role="alert">{problem}</p>}
        {run ? (
          <Player
            key={run.id}
            course={getCourse(task.courseId)}
            run={run}
            returnTo="/daily"
          />
        ) : (
          <section className="lesson-panel">
            <p>{getCourse(task.courseId).description}</p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void startTask(task)}
            >
              Start{" "}
              {task.kind === "review"
                ? "review"
                : task.kind === "lesson"
                  ? "daily lesson"
                  : "targeted practice"}
            </button>
          </section>
        )}
      </>
    );
  const lesson = recommendedLesson(learning.data, queue.cards),
    practice = targetedExercise(learning.data, queue.cards);
  return (
    <section className="daily-study" aria-labelledby="daily-title">
      <div className="daily-heading">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE, BUILT AROUND YOU</span>
          <h2 id="daily-title">
            {allDone ? "Daily session complete" : "Your study plan"}
          </h2>
        </div>
        <Clock3 size={25} />
      </div>
      {allDone ? (
        <>
          <p>
            You completed{" "}
            {completed.filter((item) => item.kind === "review").length}{" "}
            {completed.filter((item) => item.kind === "review").length === 1
              ? "review"
              : "reviews"}
            , one lesson, and targeted practice.
          </p>
          <div className="learning-metrics">
            <div>
              <strong>{solved}</strong>
              <span>First unassisted solutions</span>
            </div>
            <div>
              <strong>
                {ownAttempts.filter((item) => item.outcome === "hint").length}
              </strong>
              <span>Hints used in this session</span>
            </div>
          </div>
          <p>
            These are practice records. Move recall and understanding a plan
            need separate evidence.
          </p>
          <Link className="text-button" to="/learn">
            Explore another lesson
          </Link>
          {daily.session!.day !== localDay(now) && (
            <button className="primary" onClick={daily.retry}>
              Open today's plan
            </button>
          )}
        </>
      ) : (
        <>
          <p>
            {queue.totalDue
              ? `${queue.totalDue} due reviews. Begin with up to ${queue.cards.length}; the remaining cards stay queued.`
              : "No reviews are due. Learn an idea and practice it; your recall cards will return later."}
          </p>
          {daily.session ? (
            <ol className="daily-tasks">
              {daily.session.tasks.map((item) => (
                <li key={item.runId}>
                  <span>
                    {completed.includes(item) ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Target size={18} />
                    )}
                  </span>
                  <span>
                    {getCourse(item.courseId).title}
                    <small>
                      {item.kind}
                      {completed.includes(item)
                        ? " · completed"
                        : " · saved in your plan"}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="daily-options">
              <div>
                <Clock3 size={20} />
                <strong>Due reviews</strong>
                <span>
                  {queue.totalDue} ready · {queue.backlog} beyond this session
                </span>
              </div>
              <div>
                <BookOpen size={20} />
                <strong>{lesson.title}</strong>
                <span>Recommended lesson</span>
              </div>
              <div>
                <Target size={20} />
                <strong>{practice.title}</strong>
                <span>
                  Targeted practice
                  {queue.totalDue
                    ? " · based on due reviews"
                    : learning.data.attempts.some((attempt) =>
                          ["wrong", "timeout"].includes(attempt.outcome),
                        )
                      ? " · based on a recent miss"
                      : " · start with piece safety"}
                </span>
              </div>
            </div>
          )}
          {queue.teaching > 0 && (
            <p className="inline-notice">
              Repeated misses are a cue to revisit the explanation. Your session
              starts with teaching.
            </p>
          )}
          <div className="learning-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void begin()}
            >
              {daily.session ? "Resume daily session" : "Start daily session"}
            </button>
            <Link className="secondary" to="/train/reviews">
              View spaced reviews
            </Link>
          </div>
          {daily.status === "saving" && <p role="status">Saving daily plan…</p>}
        </>
      )}
      {active && (
        <p>
          <Link to="/">Back to Today</Link>
        </p>
      )}
    </section>
  );
}

export function SpacedReviews() {
  const { cards, data, status, apply, reviewConfig } = useLearning(),
    now = useNow();
  const [selected, setSelected] = useState<string | null>(null),
    [problem, setProblem] = useState("");
  const queue = getReviewQueue(cards, now, reviewConfig);
  const activeRun = data.runs.find((run) => run.id === selected);
  const unfinished = data.runs
    .filter(
      (run) =>
        run.courseId.startsWith("review-") &&
        !run.completed &&
        !run.id.startsWith("daily-"),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  async function open(exerciseId: string) {
    const course = getCourse(`review-${exerciseId}`);
    const previous = data.runs.find(
      (run) =>
        run.courseId === course.id &&
        !run.completed &&
        !run.id.startsWith("daily-"),
    );
    if (previous) {
      setSelected(previous.id);
      return;
    }
    try {
      const run = startRun(course);
      if (await apply({ run })) setSelected(run.id);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TRAIN / SPACED REVIEWS</span>
        <h1>Bring the idea back.</h1>
        <p>
          Recall moves from your own practice, then revisit the explanation when
          you need it.
        </p>
      </div>
      <Link className="learning-back" to="/train">
        All practice sessions
      </Link>
      {status === "loading" ? (
        <p role="status">Opening your review queue…</p>
      ) : activeRun ? (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            Back to review queue
          </button>
          <Player
            key={activeRun.id}
            course={getCourse(activeRun.courseId)}
            run={activeRun}
            canRestart={false}
          />
        </>
      ) : (
        <>
          {unfinished && (
            <div className="scan-banner">
              <p>A saved review is ready to resume.</p>
              <button
                className="primary"
                disabled={status !== "saved"}
                onClick={() => setSelected(unfinished.id)}
              >
                Resume review
              </button>
            </div>
          )}
          <p>
            {queue.totalDue} due · {queue.backlog} remaining after this batch.
            At most {reviewConfig.maxDuePerSession} due cards per study session.
          </p>
          {!queue.totalDue && (
            <section className="lesson-panel">
              <h2>You're up to date.</h2>
              <p>
                {cards.length
                  ? "Your next review is scheduled below. Try a lesson while you wait."
                  : "Solve a lesson or miss a practice position to start your review queue."}
              </p>
              <Link className="primary" to="/learn">
                Learn an idea
              </Link>
            </section>
          )}
          <div className="learning-library">
            {queue.cards.map((card) => {
              const lesson = lessons.find((course) =>
                course.steps.some(
                  (step) =>
                    step.kind === "exercise" &&
                    step.exerciseId === card.exerciseId,
                ),
              );
              return (
                <article className="learning-card" key={card.id}>
                  <span className="eyebrow">MOVE RECALL · DUE</span>
                  <h2>{getExercise(card.exerciseId).title}</h2>
                  <p>
                    Due {new Date(card.dueAt).toLocaleString()} · v
                    {card.contentVersion}
                  </p>
                  {card.needsTeaching && (
                    <p className="inline-notice">
                      Several review runs needed help. Revisit the explanation
                      before retrying.
                    </p>
                  )}
                  <div className="learning-actions">
                    {card.needsTeaching && lesson && (
                      <Link className="secondary" to={`/learn/${lesson.id}`}>
                        Revisit the lesson
                      </Link>
                    )}
                    <button
                      className="primary"
                      disabled={status !== "saved"}
                      onClick={() => void open(card.exerciseId)}
                    >
                      Review position
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {cards.some((card) => Date.parse(card.dueAt) > now) && (
            <details className="review-schedule">
              <summary>Upcoming reviews</summary>
              <ul>
                {cards
                  .filter((card) => Date.parse(card.dueAt) > now)
                  .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
                  .map((card) => (
                    <li key={card.id}>
                      {getExercise(card.exerciseId).title} ·{" "}
                      {new Date(card.dueAt).toLocaleString()}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          <p className="learning-note">
            Unassisted recall returns after{" "}
            {reviewConfig.intervalDays.join(", ")} days. Help or a miss returns
            after {reviewConfig.failureDelayHours} hours. Up to{" "}
            {reviewConfig.newCardsPerDay} new cards are admitted per local day.
            Move recall and plan understanding need separate evidence.
          </p>
          <ReviewSettings />
          {problem && <p role="alert">{problem}</p>}
        </>
      )}
    </>
  );
}

function ReviewSettings() {
  const { reviewConfig, updateReviewConfig, status } = useLearning();
  const [intervals, setIntervals] = useState(
    reviewConfig.intervalDays.join(", "),
  );
  const [delay, setDelay] = useState(String(reviewConfig.failureDelayHours));
  const [cap, setCap] = useState(String(reviewConfig.newCardsPerDay));
  const [batch, setBatch] = useState(String(reviewConfig.maxDuePerSession));
  const [message, setMessage] = useState("");
  return (
    <details className="review-schedule">
      <summary>Review settings</summary>
      <form
        className="review-settings"
        onSubmit={async (event) => {
          event.preventDefault();
          const intervalDays = intervals
            .split(",")
            .map((item) => Number(item.trim()));
          if (
            !intervalDays.length ||
            intervalDays.some(
              (value, index) =>
                !Number.isFinite(value) ||
                value <= 0 ||
                (index > 0 && value <= intervalDays[index - 1]),
            )
          ) {
            setMessage(
              "Use positive, increasing day intervals, separated by commas.",
            );
            return;
          }
          const success = await updateReviewConfig({
            ...reviewConfig,
            intervalDays,
            failureDelayHours: Number(delay),
            newCardsPerDay: Number(cap),
            maxDuePerSession: Number(batch),
          });
          setMessage(
            success
              ? "Review settings saved. Changes apply to future scheduling; existing due dates stay saved."
              : "Review settings were not saved. Retry learning storage above.",
          );
        }}
      >
        <label>
          Successful review intervals (days)
          <input
            value={intervals}
            onChange={(event) => setIntervals(event.target.value)}
            required
          />
        </label>
        <label>
          Return after help or a miss (hours)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={delay}
            onChange={(event) => setDelay(event.target.value)}
            required
          />
        </label>
        <label>
          New cards per day
          <input
            type="number"
            min="1"
            max="20"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            required
          />
        </label>
        <label>
          Due cards per session
          <input
            type="number"
            min="1"
            max="20"
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
            required
          />
        </label>
        <button className="secondary" disabled={status !== "saved"}>
          Save review settings
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
