import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Layers3, Target } from "lucide-react";
import { Chess } from "chess.js";
import { useOpenings } from "../app/OpeningContext";
import { useLearning } from "../app/LearningContext";
import { openingChapters, openingCourses } from "../openings/content";
import { openingPositionKey } from "../openings/graph";
import {
  initialOpeningProgress,
  changeOpeningProgress,
  type OpeningAction,
} from "../openings/progress";
import { replay } from "../chess/adapter";
import { Chessboard } from "../components/Chessboard";
import { Player } from "./LearningArea";
import { startRun } from "../learning/engine";
import { branchCourseId } from "../openings/training";

export function OpeningArea() {
  const { chapterId } = useParams();
  const opening = useOpenings();
  const learning = useLearning();
  const [layer, setLayer] = useState<"essential" | "practical" | "advanced">(
    "essential",
  );
  const [mode, setMode] = useState<"study" | "plan" | "recognition">("study");
  const [recognitionIndex, setRecognitionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [problem, setProblem] = useState("");
  const lock = useRef(false);
  const chapter = openingChapters.find((item) => item.id === chapterId);
  const persisted = opening.progress.find(
    (item) => item.chapterId === chapterId,
  );
  const progress = chapter
    ? (persisted ?? initialOpeningProgress(chapter.id))
    : undefined;
  const busy = opening.status !== "saved";
  async function act(action: OpeningAction) {
    if (busy || !chapter || !progress || lock.current) return;
    lock.current = true;
    try {
      setProblem("");
      if (!persisted && !(await opening.save(progress))) return;
      await opening.save(changeOpeningProgress(progress, action));
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      lock.current = false;
    }
  }
  if (opening.status === "loading")
    return <p role="status">Opening your saved repertoire…</p>;
  if (chapterId && !chapter)
    return (
      <section className="lesson-panel">
        <h1>This chapter is unavailable.</h1>
        <Link to="/openings">All opening chapters</Link>
      </section>
    );
  if (!chapter || !progress)
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">OPENINGS / UNDERSTAND YOUR REPERTOIRE</span>
          <h1>Know the plan behind the move.</h1>
          <p>
            Three starter chapters. Learn both sides' plans, explore replies,
            and bring the critical choices back in spaced reviews.
          </p>
        </div>
        <div className="scan-banner">
          <Layers3 size={26} />
          <p>
            <strong>Ideas before long lines</strong>
            <br />
            Study a branch, name its plan, then try an unfamiliar reply.
            Coverage is deliberately limited and shown in every chapter.
          </p>
        </div>
        <div className="learning-library">
          {openingChapters.map((item) => {
            const saved = opening.progress.find(
              (value) => value.chapterId === item.id,
            );
            const completed = learning.data.completions.filter(
              (value) => value.courseId === `opening-${item.id}`,
            ).length;
            return (
              <article className="learning-card" key={item.id}>
                <span className="eyebrow">
                  {item.color === "w" ? "WITH WHITE" : "WITH BLACK"} · CHAPTER v
                  {item.version}
                </span>
                <span className="card-icon">
                  <BookOpen size={22} />
                </span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span className="learning-note">
                  {item.exercises.length} move exercises · {completed} completed
                  chapter runs{saved ? " · study saved" : ""}
                </span>
                <Link className="primary" to={`/openings/${item.id}`}>
                  {saved ? "Resume chapter" : "Study chapter"}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="learning-back">
          <Link to="/train/opening-mixed">Train mixed opening branches</Link> ·{" "}
          <Link to="/train/reviews">View spaced reviews</Link>
        </p>
      </>
    );
  const path = chapter.paths.find((item) => item.id === progress.pathId)!;
  const game = replay(path.moves, progress.cursor);
  const positionKey = openingPositionKey(game.fen());
  const currentCaption = path.captions?.[progress.cursor - 1];
  const sharedAnnotations =
    chapter.graph.nodes.find((node) => node.id === positionKey)?.annotations ??
    [];
  const matchingPaths = chapter.paths.filter((item) => {
    const board = new Chess();
    if (openingPositionKey(board.fen()) === positionKey) return true;
    return item.moves.some((move) => {
      board.move(move);
      return openingPositionKey(board.fen()) === positionKey;
    });
  });
  const recognition =
    chapter.recognition[recognitionIndex % chapter.recognition.length];
  const repertoire = chapter.paths.find(
    (item) => item.id === progress.repertoirePathId,
  );
  const planCorrect = chapter.planQuestions.filter(
    (question) =>
      [...progress.answers]
        .reverse()
        .find(
          (answer) =>
            answer.kind === "plan" && answer.questionId === question.id,
        )?.correct,
  ).length;
  const question = (
    item: (typeof chapter.planQuestions)[number],
    kind: "plan" | "recognition",
  ) => {
    const latest = [...progress.answers]
      .reverse()
      .find((answer) => answer.questionId === item.id && answer.kind === kind);
    const choice = item.choices.find((value) => value.id === latest?.choiceId);
    return (
      <section className="opening-question" key={item.id}>
        <h3>{item.prompt}</h3>
        <div className="opening-choices">
          {item.choices.map((value) => (
            <button
              className="secondary"
              key={value.id}
              disabled={busy}
              aria-pressed={choice?.id === value.id}
              onClick={() =>
                void act({
                  type: "answer",
                  kind,
                  questionId: item.id,
                  choiceId: value.id,
                })
              }
            >
              {value.text}
            </button>
          ))}
        </div>
        {choice && (
          <p
            className={`learning-feedback ${choice.correct ? "success" : ""}`}
            role="status"
          >
            <strong>
              {choice.correct ? "Correct. " : "Revisit the idea. "}
            </strong>
            {choice.explanation}
          </p>
        )}
      </section>
    );
  };
  return (
    <>
      <Link className="learning-back" to="/openings">
        <ArrowLeft size={16} />
        All opening chapters
      </Link>
      <div className="page-heading">
        <span className="eyebrow">
          OPENINGS / {chapter.color === "w" ? "WHITE" : "BLACK"}
        </span>
        <h1>{chapter.title}</h1>
        <p>{chapter.description}</p>
      </div>
      <div className="opening-status">
        <span role="status">
          {opening.status === "saved"
            ? "Opening progress saved"
            : opening.status === "saving"
              ? "Saving opening progress…"
              : "Opening progress not saved"}
        </span>
        <span>
          Repertoire: {repertoire?.title ?? "Choose a studied branch"}
        </span>
      </div>
      <div className="learning-actions opening-launch">
        <Link className="primary" to={`/openings/${chapter.id}/lesson`}>
          Complete guided chapter
        </Link>
        <Link className="secondary" to={`/train/opening-train-${chapter.id}`}>
          <Target size={16} />
          Guess the move & unfamiliar replies
        </Link>
        <Link className="text-button" to="/train/reviews">
          Spaced reviews
        </Link>
      </div>
      <section className="lesson-panel opening-layers">
        <div className="opening-tabs" role="group" aria-label="Reference layer">
          {(
            [
              ["essential", "Essential plan"],
              ["practical", "Practical branches"],
              ["advanced", "Advanced reference"],
            ] as const
          ).map(([id, title]) => (
            <button
              className="secondary"
              key={id}
              aria-pressed={layer === id}
              onClick={() => setLayer(id)}
            >
              {title}
            </button>
          ))}
        </div>
        <p>{chapter.layers[layer]}</p>
      </section>
      <div className="opening-tabs" role="group" aria-label="Study mode">
        {(
          [
            ["study", "Explore branches"],
            ["plan", "Plan questions"],
            ["recognition", "Recognize a position"],
          ] as const
        ).map(([id, title]) => (
          <button
            className="secondary"
            key={id}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {mode === "study" && (
        <div className="workspace-grid learning-workspace opening-workspace">
          <section className="board-panel">
            <div className="panel-heading">
              <h2>{path.title}</h2>
              <span className="pill">
                {progress.cursor}/{path.moves.length}
              </span>
            </div>
            <Chessboard
              game={game}
              flipped={chapter.color === "b" ? !flipped : flipped}
              showLegal={false}
              disabled
              onMove={() => {}}
            />
            <div className="learning-actions">
              <button
                className="secondary"
                disabled={busy || progress.cursor === 0}
                onClick={() =>
                  void act({
                    type: "study",
                    pathId: path.id,
                    cursor: progress.cursor - 1,
                  })
                }
              >
                Previous move
              </button>
              <button
                className="primary"
                disabled={busy || progress.cursor === path.moves.length}
                onClick={() =>
                  void act({
                    type: "study",
                    pathId: path.id,
                    cursor: progress.cursor + 1,
                  })
                }
              >
                Next opening move
              </button>
              <button
                className="text-button"
                onClick={() => setFlipped((value) => !value)}
              >
                Flip opening board
              </button>
            </div>
            <p className="learning-line">
              {game.history().join(" · ") || "Starting position"}
            </p>
          </section>
          <section className="lesson-panel">
            <label className="opening-path-label">
              Study branch
              <select
                value={path.id}
                disabled={busy}
                onChange={(event) =>
                  void act({
                    type: "study",
                    pathId: event.target.value,
                    cursor: 0,
                  })
                }
              >
                {chapter.paths.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.kind}
                  </option>
                ))}
              </select>
            </label>
            <p className="learning-feedback" role="status">
              {currentCaption ??
                "Advance the board and read the reason behind each move."}
            </p>
            <button
              className="secondary"
              disabled={
                busy ||
                path.kind === "model" ||
                progress.repertoirePathId === path.id
              }
              onClick={() => void act({ type: "repertoire", pathId: path.id })}
            >
              Use this repertoire branch
            </button>
            {repertoire && (
              <Link
                className="primary opening-repertoire-train"
                to={`/train/${branchCourseId(repertoire.id)}`}
              >
                Train saved repertoire branch
              </Link>
            )}
            <p className="learning-note">
              Your selected branch and its course version stay saved. Full move
              history is replayed for play; shared graph positions keep the same
              annotations across move orders.
            </p>
            <details className="opening-identity">
              <summary>
                Shared position reference · {matchingPaths.length} branches
              </summary>
              <p>
                Reached by: {matchingPaths.map((item) => item.title).join("; ")}
              </p>
              <code>{positionKey}</code>
            </details>
            {sharedAnnotations.length > 0 && (
              <div className="opening-shared-ideas">
                <h3>Ideas at this position</h3>
                {sharedAnnotations.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
            {path.kind === "model" && (
              <p className="learning-note">
                Original illustrative model-game excerpt. Commentary is authored
                for teaching and checked against legal moves; it is not a
                historical game or engine evaluation.
              </p>
            )}
          </section>
        </div>
      )}
      {mode === "plan" && (
        <section className="lesson-panel">
          <span className="eyebrow">PLAN UNDERSTANDING</span>
          <h2>Explain the idea, not just the move.</h2>
          <p>
            {planCorrect}/{chapter.planQuestions.length} latest plan answers
            correct. These records are separate from move recall; they do not
            certify mastery.
          </p>
          {chapter.planQuestions.map((item) => question(item, "plan"))}
        </section>
      )}
      {mode === "recognition" && (
        <div className="workspace-grid learning-workspace">
          <section className="board-panel">
            <div className="panel-heading">
              <h2>Read the structure</h2>
              <span className="pill">
                Position {(recognitionIndex % chapter.recognition.length) + 1}
              </span>
            </div>
            <Chessboard
              game={replay(recognition.moves)}
              flipped={chapter.color === "b"}
              showLegal={false}
              disabled
              onMove={() => {}}
            />
          </section>
          <section className="lesson-panel">
            <span className="eyebrow">POSITION RECOGNITION</span>
            {question(recognition, "recognition")}
            <button
              className="secondary"
              onClick={() => setRecognitionIndex((value) => value + 1)}
            >
              Next recognition position
            </button>
            <p className="learning-note">
              Recognition choices have their own saved evidence. Train move
              responses separately.
            </p>
          </section>
        </div>
      )}
      {problem && <p role="alert">{problem}</p>}
      <section className="lesson-panel opening-coverage">
        <h2>What this chapter covers</h2>
        <ul>
          {chapter.coverage.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3>Outside this starter chapter</h3>
        <ul>
          {chapter.uncovered.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details>
          <summary>Quick reference for common deviations</summary>
          {chapter.deviations.map((item) => (
            <p key={item.reply}>
              <strong>{item.reply}</strong> — {item.advice}
            </p>
          ))}
        </details>
        <details>
          <summary>Authored PGN with variations and annotations</summary>
          <pre>{chapter.pgn}</pre>
        </details>
        <p className="learning-source">
          {chapter.source.author} · {chapter.source.source} ·{" "}
          {chapter.source.license} · v{chapter.version}
        </p>
      </section>
    </>
  );
}

export function OpeningLesson() {
  const { chapterId } = useParams();
  const learning = useLearning();
  const course = openingCourses.find(
    (item) => item.id === `opening-${chapterId}`,
  );
  const run = learning.data.runs
    .filter((item) => item.courseId === course?.id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const returnTo = `/openings/${chapterId}`;
  return (
    <>
      <Link className="learning-back" to={returnTo}>
        <ArrowLeft size={16} />
        Back to opening chapter
      </Link>
      <div className="page-heading">
        <span className="eyebrow">GUIDED OPENING STUDY</span>
        <h1>{course?.title ?? "Chapter unavailable"}</h1>
        <p>{course?.description}</p>
      </div>
      {learning.status === "loading" ? (
        <p role="status">Opening your chapter progress…</p>
      ) : (
        course &&
        (run ? (
          <Player course={course} run={run} returnTo={returnTo} />
        ) : (
          <section className="lesson-panel">
            <h2>Learn the plan and try the branches.</h2>
            <button
              className="primary"
              disabled={learning.status !== "saved"}
              onClick={() => void learning.apply({ run: startRun(course) })}
            >
              Start opening chapter
            </button>
          </section>
        ))
      )}
    </>
  );
}
