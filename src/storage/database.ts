import { replay } from "../chess/adapter";
export const DATABASE_NAME = "tempo-chess";
export const SCHEMA_VERSION = 2;
export interface Workspace {
  id: "practice";
  moves: string[];
  cursor: number;
  updatedAt: string;
}
export interface Profile {
  id: "local";
  name: string;
  rating: number;
  target: number;
}
export const defaultProfile: Profile = {
  id: "local",
  name: "Chess learner",
  rating: 600,
  target: 1500,
};
export function newWorkspace(): Workspace {
  return {
    id: "practice",
    moves: [],
    cursor: 0,
    updatedAt: new Date().toISOString(),
  };
}
let database: Promise<IDBDatabase> | undefined;
export function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, SCHEMA_VERSION);
      request.onupgradeneeded = () => {
        // Additive migrations preserve the foundation workspace and profile.
        const db = request.result;
        if (!db.objectStoreNames.contains("workspaces"))
          db.createObjectStore("workspaces", { keyPath: "id" });
        if (!db.objectStoreNames.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "id" });
        for (const name of ["learningRuns", "attempts", "completions"])
          if (!db.objectStoreNames.contains(name))
            db.createObjectStore(name, { keyPath: "id" });
      };
      request.onblocked = () =>
        reject(new Error("Close other Tempo tabs, then retry storage."));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}
export async function loadLocalData(): Promise<{
  workspace: Workspace;
  profile: Profile;
}> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["workspaces", "profiles"], "readonly");
    const workspace = transaction.objectStore("workspaces").get("practice");
    const profile = transaction.objectStore("profiles").get("local");
    transaction.oncomplete = () => {
      try {
        const saved: Workspace = workspace.result ?? newWorkspace();
        replay(saved.moves, saved.cursor);
        resolve({
          workspace: saved,
          profile: profile.result ?? defaultProfile,
        });
      } catch {
        reject(
          new Error(
            "Saved position could not be read. Your stored data has been preserved.",
          ),
        );
      }
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Storage was interrupted."));
  });
}
export async function saveLocalData(
  workspace: Workspace,
  profile: Profile,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["workspaces", "profiles"], "readwrite");
    transaction.objectStore("workspaces").put(workspace);
    transaction.objectStore("profiles").put(profile);
    // A successful request is insufficient: only report saved after the transaction commits.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Storage was interrupted."));
  });
}
