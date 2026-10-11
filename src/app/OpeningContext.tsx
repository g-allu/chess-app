import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadOpeningProgress,
  commitOpeningProgress,
} from "../storage/openings";
import type { OpeningProgress } from "../openings/progress";
import { validateOpeningContent } from "../openings/validation";

interface State {
  progress: OpeningProgress[];
  status: "loading" | "saved" | "saving" | "error";
  error: string;
  save: (progress: OpeningProgress) => Promise<boolean>;
  retry: () => void;
}
const Context = createContext<State | null>(null);
export function OpeningProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<OpeningProgress[]>([]);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const lock = useRef(false),
    ready = useRef(false);
  const pending = useRef<OpeningProgress | null>(null);
  useEffect(() => {
    let active = true;
    ready.current = false;
    Promise.resolve()
      .then(() => {
        validateOpeningContent();
        return loadOpeningProgress();
      })
      .then((value) => {
        if (active) {
          setProgress(value);
          ready.current = true;
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
  }, [reload]);
  async function save(input: OpeningProgress) {
    if (lock.current || !ready.current) return false;
    lock.current = true;
    const value = structuredClone(input);
    pending.current = value;
    setStatus("saving");
    try {
      await commitOpeningProgress(value);
      setProgress((current) => [
        ...current.filter((item) => item.id !== value.id),
        value,
      ]);
      pending.current = null;
      setError("");
      setStatus("saved");
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
    if (pending.current) void save(pending.current);
    else {
      setStatus("loading");
      setReload((value) => value + 1);
    }
  }
  return (
    <Context.Provider value={{ progress, status, error, save, retry }}>
      {children}
    </Context.Provider>
  );
}
export function useOpenings() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing openings provider");
  return state;
}
