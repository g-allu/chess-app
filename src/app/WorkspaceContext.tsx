import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  defaultProfile,
  loadLocalData,
  newWorkspace,
  saveLocalData,
} from "../storage/database";
import type { Profile, Workspace } from "../storage/database";
interface State {
  workspace: Workspace;
  profile: Profile;
  updateWorkspace: (next: Workspace) => void;
  updateProfile: (next: Profile) => void;
  status: "loading" | "saving" | "saved" | "error";
  error: string;
  retry: () => void;
}
const Context = createContext<State | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(newWorkspace);
  const [profile, setProfile] = useState(defaultProfile);
  const [status, setStatus] = useState<State["status"]>("loading");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const loadFailed = useRef(false);
  useEffect(() => {
    let active = true;
    loadLocalData()
      .then((data) => {
        if (!active) return;
        setWorkspace(data.workspace);
        setProfile(data.profile);
        setReady(true);
      })
      .catch((problem) => {
        if (!active) return;
        loadFailed.current = true;
        setError(String(problem.message ?? problem));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [retryCount]);
  useEffect(() => {
    if (!ready) return;
    const current = ++revision.current;
    setStatus("saving");
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveLocalData(workspace, profile))
      .then(() => {
        if (current === revision.current) {
          setStatus("saved");
          setError("");
        }
      })
      .catch((problem) => {
        if (current === revision.current) {
          setError(String(problem.message ?? problem));
          setStatus("error");
        }
      });
  }, [workspace, profile, ready]);
  function updateWorkspace(next: Workspace) {
    revision.current++;
    if (ready) setStatus("saving");
    setWorkspace(next);
  }
  function updateProfile(next: Profile) {
    revision.current++;
    if (ready) setStatus("saving");
    setProfile(next);
  }
  function retry() {
    if (loadFailed.current) {
      loadFailed.current = false;
      setStatus("loading");
      setRetryCount((n) => n + 1);
    } else setWorkspace((current) => ({ ...current }));
  }
  return (
    <Context.Provider
      value={{
        workspace,
        profile,
        status,
        error,
        retry,
        updateWorkspace,
        updateProfile,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing workspace provider");
  return value;
}
