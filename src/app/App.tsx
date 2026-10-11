import { useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Compass,
  Flag,
  Home,
  Layers3,
  Moon,
  Sun,
  Settings2,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  X,
} from "lucide-react";
import { Piece } from "../components/Piece";
import { LearningArea } from "../features/LearningArea";
import { BoardWorkspace } from "../features/BoardWorkspace";
import { DailyStudy, SpacedReviews } from "../features/DailyStudy";
import { useWorkspace } from "./WorkspaceContext";
import { useTheme } from "./useTheme";
import { useLearning } from "./LearningContext";
const nav = [
  { path: "/", label: "Today", icon: Home },
  { path: "/learn", label: "Learn", icon: BookOpen },
  { path: "/openings", label: "Openings", icon: Layers3 },
  { path: "/train", label: "Train", icon: Target },
  { path: "/review", label: "Review", icon: Swords },
];
const future = {
  learn: {
    week: "Week 2",
    label: "Learn",
    heading: "Understanding comes first.",
    description:
      "A home for clear explanations, interactive lessons, and the ideas you can use in your next game.",
    icon: BookOpen,
    items: [
      "Beginner lessons",
      "Feedback on your decisions",
      "Progress through the essentials",
    ],
  },
  openings: {
    week: "Stage 4",
    label: "Openings",
    heading: "Know the plan behind the move.",
    description:
      "Build a practical repertoire with explanations for both sides, common replies, and meaningful alternatives.",
    icon: Layers3,
    items: [
      "Italian Game with White",
      "Caro-Kann against 1.e4",
      "Queen’s Gambit Declined against 1.d4",
    ],
  },
  review: {
    week: "Stages 5–6",
    label: "Review",
    heading: "Your games are your best teacher.",
    description:
      "Bring in completed games, revisit your decisions, and turn verified mistakes into useful practice.",
    icon: Swords,
    items: [
      "Chess.com blitz imports",
      "Game replay and self-analysis",
      "Engine findings and a mistake notebook",
    ],
  },
};
function PlannedArea({ area }: { area: keyof typeof future }) {
  const page = future[area];
  const Icon = page.icon;
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">
          YOUR CHESS JOURNEY / {page.label.toUpperCase()}
        </span>
        <h1>{page.heading}</h1>
        <p>{page.description}</p>
      </div>
      <section className="future-card">
        <span className="future-icon">
          <Icon size={36} />
        </span>
        <span className="pill">Planned · {page.week}</span>
        <h2>This part of your journey is coming next.</h2>
        <p>The foundation is ready. Here’s what this area will grow into.</p>
        <div className="future-items">
          {page.items.map((item) => (
            <div key={item}>
              <Compass size={19} />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <Link className="primary" to="/train/free">
          Explore the practice board <ChevronRight size={17} />
        </Link>
      </section>
    </>
  );
}
function Today({ train = false }: { train?: boolean }) {
  const { workspace } = useWorkspace();
  return (
    <>
      <div className="page-heading heading-with-badge">
        <div>
          <span className="eyebrow">
            {train ? "MAKE ROOM FOR PRACTICE" : "YOUR NEXT CHAPTER STARTS HERE"}
          </span>
          <h1>{train ? "Explore. Try. Repeat." : "One move at a time."}</h1>
          <p>
            {train
              ? "A little space to test your ideas and get to know the board."
              : "Welcome to your personal chess workspace. Let’s build a stronger game."}
          </p>
        </div>
        <span className="week-badge">
          <Sparkles size={16} /> Stage 3 · Learn & retain
        </span>
      </div>
      {!train && (
        <div className="overview-row">
          <div>
            <span className="stat-icon">
              <Target size={20} />
            </span>
            <div>
              <span className="stat-label">YOUR FOCUS</span>
              <strong>Build board confidence</strong>
            </div>
          </div>
          <div>
            <span className="stat-icon">
              <Flag size={20} />
            </span>
            <div>
              <span className="stat-label">CURRENT BOARD</span>
              <strong>
                {workspace.moves.length} <span>moves explored</span>
              </strong>
            </div>
          </div>
          <div>
            <span className="stat-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <span className="stat-label">YOUR WORKSPACE</span>
              <strong>Local browser storage</strong>
            </div>
          </div>
        </div>
      )}
      {!train && <DailyStudy />}
      <BoardWorkspace />
      <div className="next-strip">
        <span className="next-icon">
          <BookOpen size={20} />
        </span>
        <div>
          <span className="eyebrow">READY WHEN YOU ARE</span>
          <p>
            Turn exploration into understanding with your first interactive
            lessons.
          </p>
        </div>
        <Link to="/learn" aria-label="Start learning">
          <ChevronRight size={22} />
        </Link>
      </div>
    </>
  );
}
function Settings({ close }: { close: () => void }) {
  const { profile, updateProfile } = useWorkspace();
  const [name, setName] = useState(profile.name);
  const [rating, setRating] = useState(String(profile.rating));
  const [target, setTarget] = useState(String(profile.target));
  const [message, setMessage] = useState("");
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key === "Tab") {
            const elements = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button, input",
              ),
            ];
            const first = elements[0],
              last = elements.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          className="icon-button modal-close"
          aria-label="Close profile settings"
          onClick={close}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">MAKE IT YOURS</span>
        <h2 id="settings-title">Your local profile</h2>
        <p>
          This profile stays in this browser. Ratings are self-reported; your
          target is a personal aspiration.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile({
              ...profile,
              name: name.trim() || "Chess learner",
              rating: Number(rating),
              target: Number(target),
            });
            close();
          }}
        >
          <label>
            Name
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              required
            />
          </label>
          <div className="form-row">
            <label>
              Chess.com blitz rating
              <input
                type="number"
                min="0"
                max="4000"
                step="1"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                required
              />
            </label>
            <label>
              Personal rating target
              <input
                type="number"
                min="0"
                max="4000"
                step="1"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                required
              />
            </label>
          </div>
          <button className="primary" type="submit">
            Save profile <CheckCircle2 size={17} />
          </button>
        </form>
        <div className="storage-settings">
          <h3>Browser storage</h3>
          <p>
            Data belongs to this browser and the address localhost:5173.
            Clearing browser data removes it. Backup tools are planned for Weeks
            9–10.
          </p>
          <button
            className="text-button"
            onClick={async () => {
              try {
                const granted = await navigator.storage?.persist?.();
                setMessage(
                  granted
                    ? "Persistent storage is enabled."
                    : "The browser did not grant persistent storage. Normal saving still works.",
                );
              } catch {
                setMessage(
                  "Persistent storage is unavailable in this browser.",
                );
              }
            }}
          >
            Request persistent storage
          </button>
          <span role="status">{message}</span>
        </div>
      </section>
    </div>
  );
}
export function App() {
  const { theme, toggleTheme } = useTheme();
  const { profile, status, error, retry } = useWorkspace();
  const learning = useLearning();
  const saveStatus =
    status === "error" || learning.status === "error"
      ? "error"
      : status === "loading" || learning.status === "loading"
        ? "loading"
        : status === "saving" || learning.status === "saving"
          ? "saving"
          : "saved";
  const [settings, setSettings] = useState(false);
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Tempo home">
          <span className="brand-mark">
            <Piece type="n" color="w" />
          </span>
          <span>
            tempo<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="sidebar-caption">A STRONGER GAME, EVERY DAY.</p>
        <nav aria-label="Main navigation">
          {nav.map(({ path, label, icon: Icon }) => (
            <NavLink end={path === "/"} key={path} to={path}>
              <Icon size={20} />
              <span>{label}</span>
              <ChevronRight className="nav-chevron" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-card">
            <span className="eyebrow">THE LONG GAME</span>
            <p>
              Good habits.
              <br />
              Better chess.
            </p>
            <span>Learn at your own pace.</span>
            <div className="journey-art">
              ♙ <span>♘</span> ♙
            </div>
          </div>
          <button
            className="profile-button"
            onClick={() => setSettings(true)}
            aria-label="Open profile settings"
          >
            <span className="avatar">
              {profile.name[0]?.toUpperCase() || "C"}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.rating} blitz · Personal workspace</small>
            </span>
            <Settings2 size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            <span className="topbar-dot" /> Personal learning workspace
          </span>
          <div>
            <span className={`save-status ${saveStatus}`} role="status">
              {saveStatus === "saved" ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className="status-dot" />
              )}
              {saveStatus === "saved"
                ? "Saved locally"
                : saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "loading"
                    ? "Opening workspace…"
                    : "Not saved"}
            </span>
            <button
              className="icon-button theme-toggle"
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="About this workspace"
              onClick={() => setSettings(true)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main id="main">
          {status === "error" && (
            <div className="storage-error" role="alert">
              <strong>Browser storage needs attention.</strong>
              <span>
                {error} Keep this tab open to retain your current position.
              </span>
              <button className="text-button" onClick={retry}>
                Retry storage
              </button>
            </div>
          )}
          {learning.status === "error" && (
            <div className="storage-error" role="alert">
              <strong>Learning progress needs attention.</strong>
              <span>
                {learning.error} Your last committed progress is preserved.
              </span>
              <button className="text-button" onClick={learning.retry}>
                Retry learning storage
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/daily" element={<DailyStudy active />} />
            <Route path="/train/free" element={<Today train />} />
            <Route path="/train/reviews" element={<SpacedReviews />} />
            <Route path="/train" element={<LearningArea kind="session" />} />
            <Route
              path="/train/:courseId"
              element={<LearningArea kind="session" />}
            />
            <Route path="/learn" element={<LearningArea kind="lesson" />} />
            <Route
              path="/learn/:courseId"
              element={<LearningArea kind="lesson" />}
            />
            <Route path="/openings" element={<PlannedArea area="openings" />} />
            <Route path="/review" element={<PlannedArea area="review" />} />
            <Route
              path="*"
              element={
                <section className="future-card">
                  <h1>This page isn’t on the board.</h1>
                  <Link className="primary" to="/">
                    Back to Today
                  </Link>
                </section>
              }
            />
          </Routes>
          <footer>
            <span>
              <CalendarDays size={13} /> Built for steady progress.
            </span>
            <span>Play your games on Chess.com. Learn from them here.</span>
          </footer>
        </main>
      </div>
      {settings && <Settings close={() => setSettings(false)} />}
    </div>
  );
}
