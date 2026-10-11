import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LearningData, Transition } from "../learning/contracts";
import { courses, exercises } from "../learning/content";
import { validateContent } from "../learning/validation";
import { commitLearning, loadLearning } from "../storage/learning";
import {
  loadReviewCards,
  loadReviewConfig,
  saveReviewConfig,
} from "../storage/reviews";
import type { ReviewCard, ReviewConfig } from "../review/contracts";
import { defaultReviewConfig } from "../review/engine";
interface State {
  data: LearningData;
  cards: ReviewCard[];
  reviewConfig: ReviewConfig;
  updateReviewConfig: (config: ReviewConfig) => Promise<boolean>;
  status: "loading" | "saved" | "saving" | "error";
  error: string;
  apply: (change: Transition) => Promise<boolean>;
  retry: () => void;
}
const Context = createContext<State | null>(null);
export function LearningProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LearningData>({
    runs: [],
    attempts: [],
    completions: [],
  });
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [reviewConfig, setReviewConfig] =
    useState<ReviewConfig>(defaultReviewConfig);
  const pendingConfig = useRef<ReviewConfig | null>(null);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const lock = useRef(false),
    ready = useRef(false),
    pending = useRef<Transition | null>(null);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        validateContent(exercises, courses);
        return Promise.all([
          loadLearning(),
          loadReviewCards(),
          loadReviewConfig(),
        ]);
      })
      .then(([value, savedCards, config]) => {
        if (active) {
          setData(value);
          setCards(savedCards);
          setReviewConfig(config);
          ready.current = true;
          setStatus("saved");
          setError("");
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
  }, [reload]);
  async function apply(change: Transition): Promise<boolean> {
    if (lock.current || !ready.current) return false;
    lock.current = true;
    pending.current = change;
    setStatus("saving");
    try {
      await commitLearning(change);
      const savedCards = await loadReviewCards();
      setCards(savedCards);
      setData((current) => ({
        runs: [
          ...current.runs.filter((r) => r.id !== change.run.id),
          change.run,
        ],
        attempts:
          change.attempt &&
          !current.attempts.some((a) => a.id === change.attempt!.id)
            ? [...current.attempts, change.attempt]
            : current.attempts,
        completions:
          change.completion &&
          !current.completions.some((c) => c.id === change.completion!.id)
            ? [...current.completions, change.completion]
            : current.completions,
      }));
      pending.current = null;
      setStatus("saved");
      setError("");
      return true;
    } catch (problem) {
      setError(String((problem as Error).message ?? problem));
      setStatus("error");
      return false;
    } finally {
      lock.current = false;
    }
  }
  async function updateReviewConfig(input: ReviewConfig): Promise<boolean> {
    if (lock.current || !ready.current) return false;
    lock.current = true;
    const config = structuredClone(input);
    pendingConfig.current = config;
    setStatus("saving");
    try {
      await saveReviewConfig(config);
      setReviewConfig(config);
      pendingConfig.current = null;
      setStatus("saved");
      setError("");
      return true;
    } catch (problem) {
      setError(String((problem as Error).message ?? problem));
      setStatus("error");
      return false;
    } finally {
      lock.current = false;
    }
  }
  function retry() {
    if (pending.current) void apply(pending.current);
    else if (pendingConfig.current)
      void updateReviewConfig(pendingConfig.current);
    else {
      setStatus("loading");
      setReload((n) => n + 1);
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        cards,
        reviewConfig,
        updateReviewConfig,
        status,
        error,
        apply,
        retry,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLearning() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing learning provider");
  return value;
}
